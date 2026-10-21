import type { RawJob } from '../pipeline/job.ts';
import type { HttpClient } from './http.ts';

// What a search asks for. Full saved searches arrive in P1; connectors only need this.
interface SearchQuery {
  // Each entry is a phrase; a job matches when its title has every word of one phrase.
  keywords: string[];
  // Pakistani city ids (see PK_CITIES). Empty means anywhere.
  cities: string[];
}

export interface ConnectorContext {
  http: HttpClient;
  // Jobs already in jobs.jsonl: skip fetching their detail pages again.
  isKnown?: (id: string) => boolean;
  // Cap on extra page fetches per run, to stay polite and fast.
  maxDetailFetches?: number;
}

// ok: worked normally. fallback: partly worked (e.g. no detail pages). broken: nothing.
export type ConnectorStatus = 'ok' | 'fallback' | 'broken';

export interface ConnectorResult {
  status: ConnectorStatus;
  jobs: RawJob[];
  notes: string[];
}

export interface Connector {
  id: string;
  label: string;
  kind: 'api' | 'feed' | 'public-html' | 'web-search' | 'paste-only';
  // B: Job Hunter may fill the application form (no login). C: action card only (spec).
  applyLevel: 'B' | 'C';
  // The site's own limit, e.g. Remotive asks for at most 4 fetches a day.
  maxRunsPerDay: number;
  search: (query: SearchQuery, context: ConnectorContext) => Promise<ConnectorResult>;
}
