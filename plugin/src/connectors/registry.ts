// Every connector Job Hunter knows (spec R4). Sites that block scripts (Rozee, LinkedIn,
// Indeed…) come in through web search and pasted links instead (S2 #3).
import { ashby, lever } from './boards.ts';
import { himalayas, jobicy, remoteOk, weWorkRemotely, workingNomads } from './feeds.ts';
import { greenhouse } from './greenhouse.ts';
import { mustakbil } from './mustakbil.ts';
import { remotive } from './remotive.ts';
import type { Connector } from './types.ts';

export interface Boards {
  greenhouseBoards: readonly string[];
  leverBoards?: readonly string[];
  ashbyBoards?: readonly string[];
}

export function connectors(boards: Boards): Connector[] {
  return [
    remotive,
    remoteOk,
    weWorkRemotely,
    himalayas,
    jobicy,
    workingNomads,
    mustakbil,
    greenhouse(boards.greenhouseBoards),
    lever(boards.leverBoards ?? []),
    ashby(boards.ashbyBoards ?? []),
  ];
}
