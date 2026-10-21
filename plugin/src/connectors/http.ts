// Polite fetching (CLAUDE.md "Be polite to sites"): requests to the same host run one at
// a time with a pause between them, every request identifies Job Hunter, and a bot
// check is reported as "blocked", never worked around (spec non-goals).

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type HttpResult =
  { status: 'ok'; text: string } | { status: 'blocked' | 'not-found' | 'error'; message: string };

export interface HttpClient {
  get: (url: string) => Promise<HttpResult>;
}

const USER_AGENT =
  'JobHunter/0.1 (personal job search; +https://github.com/Hadia-i190404/Job-Hunter)';

const BOT_CHECK = /just a moment|cf-chl|captcha|are you a robot|access denied/i;

interface Options {
  fetch?: FetchLike;
  minDelayMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function createHttpClient(options: Options = {}): HttpClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const minDelayMs = options.minDelayMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const queues = new Map<string, Promise<unknown>>();

  const request = async (url: string): Promise<HttpResult> => {
    try {
      const response = await doFetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await classify(response);
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  };

  return {
    get: (url) => {
      const host = new URL(url).host;
      const previous = queues.get(host) ?? Promise.resolve();
      const run = previous.then(async () => {
        const result = await request(url);
        await sleep(minDelayMs);
        return result;
      });
      queues.set(host, run);
      return run;
    },
  };
}

async function classify(response: Response): Promise<HttpResult> {
  const text = await response.text();
  if (response.ok && !looksLikeBotCheck(response.status, text)) return { status: 'ok', text };
  if (looksLikeBotCheck(response.status, text) || response.status === 429) {
    return { status: 'blocked', message: `blocked by the site (HTTP ${String(response.status)})` };
  }
  if (response.status === 404 || response.status === 410) {
    return { status: 'not-found', message: `not found (HTTP ${String(response.status)})` };
  }
  return { status: 'error', message: `HTTP ${String(response.status)}` };
}

// A 200 page can still be a challenge page, so check short bodies too.
function looksLikeBotCheck(status: number, text: string): boolean {
  if (status === 403 || status === 503) return BOT_CHECK.test(text.slice(0, 5000));
  return text.length < 20_000 && /<title>\s*just a moment/i.test(text);
}
