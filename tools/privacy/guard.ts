// Privacy guard: stops personal data from reaching the git repo (spec R9).
// Pure functions only; the CLI that feeds it files is tools/privacy-guard.ts.

export interface Finding {
  path: string;
  line: number;
  rule: string;
  message: string;
}

interface ContentRule {
  id: string;
  pattern: RegExp;
  message: string;
  allow?: (match: string) => boolean;
}

// Emails on these domains are placeholders or machine addresses, never a person.
const SAFE_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net', 'anthropic.com'];
const SAFE_EMAIL_SUFFIXES = ['.example', '.test', '.invalid', 'users.noreply.github.com'];

function isSafeEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return (
    SAFE_EMAIL_DOMAINS.includes(domain) ||
    SAFE_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix))
  );
}

const CONTENT_RULES: readonly ContentRule[] = [
  {
    id: 'email',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    message: 'Real email address. Use an @example.com placeholder.',
    allow: isSafeEmail,
  },
  {
    id: 'cnic',
    pattern: /\b\d{5}-\d{7}-\d\b/g,
    message: 'Looks like a CNIC number.',
  },
  {
    id: 'pk-mobile',
    pattern: /(?:\+92|0092|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b/g,
    message: 'Looks like a Pakistani mobile number.',
  },
  {
    id: 'home-path',
    pattern: /(?:\/Users|\/home)\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/g,
    message: 'Absolute home-folder path leaks a username. Use ~ or a relative path.',
  },
];

// Files that only ever belong in the user's data folder (~/JobHunter/).
const DATA_FILE_NAMES = new Set([
  'profile.json',
  'searches.json',
  'answers.json',
  'pipeline.json',
  'cards.json',
  'assessments.jsonl',
  'jobs.jsonl',
  'log.jsonl',
]);
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const DOCUMENT_ALLOWED_DIRS = ['plugin/templates/', 'tests/fixtures/'];

export function checkPath(path: string): Finding[] {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  if (DATA_FILE_NAMES.has(name) && !path.startsWith('tests/fixtures/')) {
    return [
      {
        path,
        line: 0,
        rule: 'data-file',
        message: `${name} belongs in ~/JobHunter/, not the repo.`,
      },
    ];
  }
  const isDocument = DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (isDocument && !DOCUMENT_ALLOWED_DIRS.some((dir) => path.startsWith(dir))) {
    return [
      {
        path,
        line: 0,
        rule: 'document',
        message:
          'CVs and documents stay in ~/JobHunter/. Only plugin/templates/ and tests/fixtures/.',
      },
    ];
  }
  return [];
}

export function checkContent(path: string, content: string): Finding[] {
  if (content.includes('\u0000')) return []; // binary; path rules already applied
  const findings: Finding[] = [];
  content.split('\n').forEach((text, index) => {
    for (const rule of CONTENT_RULES) {
      for (const match of text.matchAll(rule.pattern)) {
        if (rule.allow?.(match[0]) === true) continue;
        findings.push({ path, line: index + 1, rule: rule.id, message: rule.message });
      }
    }
  });
  return findings;
}

export function checkFile(path: string, content: string): Finding[] {
  return [...checkPath(path), ...checkContent(path, content)];
}
