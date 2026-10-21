// Rule-only accuracy on the labelled set (T6). Usage: node tools/eligibility-report.ts
import { readFileSync } from 'node:fs';
import { evaluateLabelled, type LabelledJob } from '../tests/pipeline/eligibility-eval.ts';

const file = new URL('../tests/fixtures/labelled/eligibility.json', import.meta.url);
const { jobs } = JSON.parse(readFileSync(file, 'utf8')) as { jobs: LabelledJob[] };
const report = evaluateLabelled(jobs);

const pct = (value: number): string => `${(value * 100).toFixed(0)}%`;
console.log(`Labelled jobs: ${String(jobs.length)}`);
console.log(`"Eligible/Likely" precision: ${pct(report.positivePrecision)} (target 90%)`);
console.log(`"Not eligible" recall:       ${pct(report.negativeRecall)} (target 85%)`);
console.log(`Exact verdict matches:       ${pct(report.exact)}`);
console.log(`Sent to the Claude step:     ${String(report.needsClaude.length)}`);
console.log('\nMismatches (expected → got):');
for (const miss of report.mismatches) {
  console.log(
    `  ${miss.expected} → ${miss.got}  ${miss.location}${miss.description ? ` | ${miss.description}` : ''}`,
  );
}
