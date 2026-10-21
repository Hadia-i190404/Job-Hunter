import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addApplication,
  setAnswer,
  setStatus,
  updateApplication,
} from '../../plugin/src/apply/applications.ts';
import { prepareAnswers } from '../../plugin/src/apply/prepare.ts';
import { greenhouseQuestions, parseQuestions } from '../../plugin/src/apply/questions.ts';
import type { AnswersFile } from '../../plugin/src/schema/loop.ts';
import { loadDoc } from '../../plugin/src/store/doc.ts';
import { readLog } from '../../plugin/src/store/log.ts';
import { APPLICATIONS } from '../../plugin/src/store/loop.ts';
import { checkProfile } from '../../plugin/src/store/profile.ts';
import { fakeHttp, fixture } from '../connectors/fake-http.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();
const checked = checkProfile(
  JSON.parse(
    readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
  ) as unknown,
);
if (!checked.ok) throw new Error('bad fixture');
const profile = checked.profile;
const questions = parseQuestions(JSON.parse(fixture('greenhouse-questions.json')) as never);
const at = new Date(0).toISOString();
const bank: AnswersFile['answers'] = [
  {
    key: 'hs-math-rank',
    question: 'Math rank',
    answer: 'Top 10% at school',
    kind: 'fact',
    updatedAt: at,
  },
  { key: 'current-country', question: 'Country', answer: 'Pakistan', kind: 'fact', updatedAt: at },
  {
    key: 'willing-to-travel-internationally',
    question: 'Travel?',
    answer: 'Yes',
    kind: 'preference',
    updatedAt: at,
  },
  {
    key: 'gender',
    question: 'Gender',
    answer: 'Prefer not to say',
    kind: 'demographic',
    updatedAt: at,
  },
];

describe('parseQuestions / greenhouseQuestions', () => {
  it('reads labels, types and options', () => {
    expect(questions[0]).toEqual({
      label: 'First Name',
      required: true,
      type: 'text',
      options: [],
    });
    expect(questions.find((q) => q.label === 'Resume/CV')?.type).toBe('file');
    expect(
      questions.find((q) => q.label.startsWith('How did you perform in mathematics'))?.options,
    ).toContain('Top 10% at school');
  });

  it('fetches from the public API, and gives up cleanly', async () => {
    const http = fakeHttp({
      'https://boards-api.greenhouse.io/v1/boards/canonical/jobs/5150422': fixture(
        'greenhouse-questions.json',
      ),
    });
    expect((await greenhouseQuestions(http, 'canonical', '5150422'))?.length).toBe(
      questions.length,
    );
    expect(await greenhouseQuestions(fakeHttp({}), 'x', '1')).toBeUndefined();
    expect(
      await greenhouseQuestions(fakeHttp({ 'https://': 'not json' }), 'x', '1'),
    ).toBeUndefined();
  });
});

describe('prepareAnswers on Canonical’s real form', () => {
  const prepared = prepareAnswers(questions, profile, bank, '/cv.pdf');
  const answerTo = (start: string) => prepared.answers.find((a) => a.question.startsWith(start));

  it('spots the no-AI declaration (D19)', () => {
    expect(prepared.noAi).toBe(true);
  });

  it('fills facts from the profile and the answer bank', () => {
    expect(answerTo('First Name')).toEqual({
      question: 'First Name',
      answer: 'Ayesha',
      from: 'profile',
    });
    expect(answerTo('Last Name')?.answer).toBe('Example');
    expect(answerTo('Email')?.answer).toBe('ayesha@example.com');
    expect(answerTo('Resume/CV')).toMatchObject({ answer: '/cv.pdf', from: 'profile' });
    expect(answerTo('LinkedIn')?.answer).toBe('linkedin.com/in/ayesha-example');
    expect(answerTo('How did you perform in mathematics')).toMatchObject({
      answer: 'Top 10% at school',
      from: 'answers',
    });
    expect(answerTo('In which country do you currently work')?.answer).toBe('Pakistan');
    expect(answerTo('Which gender')?.answer).toBe('Prefer not to say');
  });

  it('leaves declarations, essays and unknowns to the user, saying why', () => {
    expect(prepared.todo).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^Tick yourself: "During this application process I agree/,
        ) as unknown,
        expect.stringMatching(/^Tick yourself: "Please confirm that you have read/) as unknown,
        expect.stringMatching(/^Write in your own words: "Describe your involvement/) as unknown,
        expect.stringMatching(
          /^Answer: "How did you perform in your native language.*\(choose:/,
        ) as unknown,
      ]),
    );
    expect(answerTo('During this application')?.from).toBe('todo');
  });

  it('never uses a non-demographic answer for a demographic question, and only exact options', () => {
    const odd = prepareAnswers(
      [
        {
          label: 'Which gender do you identify as?',
          required: true,
          type: 'select',
          options: ['Female', 'Male'],
        },
      ],
      profile,
      [
        {
          key: 'gender',
          question: 'Gender',
          answer: 'Prefer not to say',
          kind: 'fact',
          updatedAt: at,
        },
      ],
      '/cv.pdf',
    );
    expect(odd.answers[0]?.from).toBe('todo');
    const noOption = prepareAnswers(
      [
        {
          label: 'How did you perform in mathematics at high school?',
          required: true,
          type: 'select',
          options: ['Top 1%'],
        },
      ],
      profile,
      bank,
      '/cv.pdf',
    );
    expect(noOption.answers[0]?.from).toBe('todo');
  });

  it('takes the PKR salary for rupee questions', () => {
    const rupees = prepareAnswers(
      [{ label: 'Expected salary (PKR)', required: true, type: 'text', options: [] }],
      profile,
      [
        {
          key: 'expected-salary-pkr-month',
          question: 'x',
          answer: '300,000',
          kind: 'preference',
          updatedAt: at,
        },
      ],
      '/cv.pdf',
    );
    expect(rupees.answers[0]?.answer).toBe('300,000');
  });
});

describe('applications', () => {
  const input = {
    jobId: 'greenhouse:canonical-5150422',
    searchId: 'search-1',
    jobTitle: 'Web Frontend Engineer',
    company: 'Canonical',
    url: 'https://example.com',
    applyLevel: 'B' as const,
    cvPath: '/cv.pdf',
  };

  it('adds once per job, fills answers, clears to-dos and moves status', async () => {
    const dir = await tempDir();
    const prepared = prepareAnswers(questions, profile, bank, '/cv.pdf');
    const app = await addApplication(dir, { ...input, prepared });
    expect(app).toMatchObject({
      id: 'app-1',
      status: 'needs-you',
      noAi: true,
      note: expect.stringMatching(/forbids AI/) as unknown,
    });
    expect((await addApplication(dir, { ...input, prepared })).id).toBe('app-1');

    const single = await addApplication(dir, {
      ...input,
      jobId: 'x:1',
      prepared: {
        noAi: false,
        answers: [{ question: 'Notice period?', from: 'todo' }],
        todo: ['Answer: "Notice period?"'],
      },
    });
    const filled = await updateApplication(dir, single.id, (a) =>
      setAnswer(a, 0, '1 month', 'user'),
    );
    expect(filled).toMatchObject({
      status: 'prepared',
      todo: [],
      answers: [{ answer: '1 month', from: 'user' }],
    });
    expect(() => setAnswer(filled, 5, 'x', 'user')).toThrow(/doesn't exist/);

    await setStatus(dir, single.id, { status: 'approved', actor: 'user' });
    expect(
      (
        await setStatus(dir, single.id, {
          status: 'submitted',
          actor: 'agent',
          note: 'confirmation page seen',
        })
      ).note,
    ).toBe('confirmation page seen');
    const actions: string[] = [];
    for await (const e of readLog(dir)) actions.push(e.action);
    expect(actions).toEqual([
      'application-prepared',
      'application-prepared',
      'application-approved',
      'application-submitted',
    ]);
    expect((await loadDoc(dir, APPLICATIONS)).applications).toHaveLength(2);
    await expect(updateApplication(dir, 'app-9', (a) => a)).rejects.toThrow(/No application/);
  });
});
