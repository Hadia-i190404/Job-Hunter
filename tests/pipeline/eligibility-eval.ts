// Shared by the labelled-set test and tools/eligibility-report.ts.
import { assessEligibility, type Verdict } from '../../plugin/src/pipeline/eligibility.ts';
import { matchPlace } from '../../plugin/src/pipeline/location.ts';
import { detectWorkMode } from '../../plugin/src/pipeline/work-mode.ts';

export interface LabelledJob {
  location: string;
  description: string;
  label: Verdict;
}

interface Mismatch extends LabelledJob {
  expected: Verdict;
  got: Verdict;
}

export interface EvalReport {
  positivePrecision: number;
  negativeRecall: number;
  exact: number;
  mismatches: Mismatch[];
  needsClaude: LabelledJob[];
}

const positive = (v: Verdict): boolean => v === 'eligible' || v === 'likely';

export function evaluateLabelled(jobs: readonly LabelledJob[]): EvalReport {
  const results = jobs.map((job) => {
    const place = matchPlace(job.location);
    const verdict = assessEligibility({
      locationText: job.location,
      description: job.description,
      workMode: detectWorkMode({ location: job.location, description: job.description }),
      cities: place.cities,
      inPakistan: place.inPakistan,
    });
    return { job, got: verdict.verdict, needsClaude: verdict.needsClaude };
  });
  const predictedPositive = results.filter((r) => positive(r.got));
  const actualNegative = results.filter((r) => r.job.label === 'not-eligible');
  return {
    positivePrecision: ratio(
      predictedPositive.filter((r) => positive(r.job.label)).length,
      predictedPositive.length,
    ),
    negativeRecall: ratio(
      actualNegative.filter((r) => r.got === 'not-eligible').length,
      actualNegative.length,
    ),
    exact: ratio(results.filter((r) => r.got === r.job.label).length, results.length),
    mismatches: results
      .filter((r) => r.got !== r.job.label)
      .map((r) => ({ ...r.job, expected: r.job.label, got: r.got })),
    needsClaude: results.filter((r) => r.needsClaude).map((r) => r.job),
  };
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 1 : part / whole;
}
