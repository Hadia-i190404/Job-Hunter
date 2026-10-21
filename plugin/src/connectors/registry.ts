// Every connector Job Hunter knows. P1 adds the rest of the v1 list (spec R4).
import { greenhouse } from './greenhouse.ts';
import { mustakbil } from './mustakbil.ts';
import { remotive } from './remotive.ts';
import type { Connector } from './types.ts';

export function connectors(options: { greenhouseBoards: readonly string[] }): Connector[] {
  return [remotive, mustakbil, greenhouse(options.greenhouseBoards)];
}
