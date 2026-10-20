import { describe, expect, it } from 'vitest';
import { checkContent, checkFile, checkPath } from '../../src/guard/privacy.ts';

// Samples are built from parts so this file never contains a real-looking value itself.
const join = (...parts: string[]): string => parts.join('');
const cnic = join('35202', '-', '1234567', '-', '1');
const mobile = join('0300', '-', '1234567');
const mobileIntl = join('+92', ' 300 ', '1234567');
const realEmail = join('ali.khan', '@', 'gmail.com');
const homePath = join('/Users/', 'ali', '/JobHunter/profile.json');

const rulesIn = (content: string): string[] => checkContent('a.ts', content).map((f) => f.rule);

describe('checkContent', () => {
  it('flags a CNIC', () => {
    expect(rulesIn(`id: ${cnic}`)).toEqual(['cnic']);
  });

  it('flags Pakistani mobile numbers in local and international form', () => {
    expect(rulesIn(`call ${mobile}`)).toEqual(['pk-mobile']);
    expect(rulesIn(`call ${mobileIntl}`)).toEqual(['pk-mobile']);
  });

  it('flags real emails but allows placeholders', () => {
    expect(rulesIn(realEmail)).toEqual(['email']);
    expect(rulesIn('ali@example.com, noreply@anthropic.com, a@b.test')).toEqual([]);
    expect(rulesIn(join('1+me', '@', 'users.noreply.github.com'))).toEqual([]);
  });

  it('flags absolute home-folder paths', () => {
    expect(rulesIn(homePath)).toEqual(['home-path']);
    expect(rulesIn(join('C:\\Users\\', 'ali', '\\cv'))).toEqual(['home-path']);
    expect(rulesIn('~/JobHunter/profile.json')).toEqual([]);
  });

  it('reports the right line number', () => {
    const [finding] = checkContent('a.ts', `one\ntwo\n${cnic}`);
    expect(finding?.line).toBe(3);
  });

  it('does not flag ordinary numbers', () => {
    expect(rulesIn('timestamp 1703001234567, price 300 1234567')).toEqual([]);
  });

  it('skips binary content', () => {
    expect(rulesIn(`\u0000${cnic}`)).toEqual([]);
  });
});

describe('checkPath', () => {
  it('blocks data-folder files outside fixtures', () => {
    expect(checkPath('profile.json')[0]?.rule).toBe('data-file');
    expect(checkPath('src/store/answers.json')[0]?.rule).toBe('data-file');
    expect(checkPath('tests/fixtures/profile.json')).toEqual([]);
  });

  it('blocks documents outside templates and fixtures', () => {
    expect(checkPath('Ali-CV.pdf')[0]?.rule).toBe('document');
    expect(checkPath('docs/cv.DOCX')[0]?.rule).toBe('document');
    expect(checkPath('templates/sample.pdf')).toEqual([]);
    expect(checkPath('tests/fixtures/cv.docx')).toEqual([]);
  });

  it('allows ordinary source files', () => {
    expect(checkPath('src/guard/privacy.ts')).toEqual([]);
  });
});

describe('checkFile', () => {
  it('combines path and content findings', () => {
    const rules = checkFile('cv.pdf', cnic).map((f) => f.rule);
    expect(rules).toEqual(['document', 'cnic']);
  });
});
