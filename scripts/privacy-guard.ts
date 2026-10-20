// Usage: tsx scripts/privacy-guard.ts --staged | --all
// --staged checks what is about to be committed (pre-commit hook).
// --all checks every tracked file (CI).
import { execFileSync } from 'node:child_process';
import { checkFile, type Finding } from '../src/guard/privacy.ts';

const mode = process.argv[2];
if (mode !== '--staged' && mode !== '--all') {
  console.error('Usage: privacy-guard.ts --staged | --all');
  process.exit(2);
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const listArgs =
  mode === '--staged'
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z'];
const paths = git(listArgs).split('\0').filter(Boolean);

// Read the index copy (what is or will be committed), not the working tree.
const findings: Finding[] = paths.flatMap((path) => checkFile(path, git(['show', `:${path}`])));

if (findings.length === 0) {
  console.log(`privacy-guard: ${String(paths.length)} files clean.`);
  process.exit(0);
}

for (const f of findings) {
  console.error(`${f.path}:${String(f.line)}  [${f.rule}] ${f.message}`);
}
console.error(
  `\nprivacy-guard: ${String(findings.length)} problem(s). Nothing personal goes in the repo.`,
);
process.exit(1);
