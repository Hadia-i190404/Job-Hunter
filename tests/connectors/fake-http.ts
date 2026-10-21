import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HttpClient, HttpResult } from '../../plugin/src/connectors/http.ts';

export const fixture = (name: string): string =>
  readFileSync(join(import.meta.dirname, '..', 'fixtures', 'connectors', name), 'utf8');

// Answers by URL prefix; anything else is "not found". Records every URL asked for.
export function fakeHttp(
  routes: Record<string, string | HttpResult>,
): HttpClient & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get: (url) => {
      asked.push(url);
      const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      const route = key === undefined ? undefined : routes[key];
      if (route === undefined) return Promise.resolve({ status: 'not-found', message: 'no route' });
      return Promise.resolve(typeof route === 'string' ? { status: 'ok', text: route } : route);
    },
  };
}
