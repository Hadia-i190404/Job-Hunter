// Run one connector and print what it found (normalised). Saving and dedup come in T6.
// Usage: sh run.sh fetch.ts --source remotive|mustakbil|greenhouse
//          --q "react developer" [--q …] [--city lahore …] [--board gitlab …] [--show 5]
import { parseArgs } from 'node:util';
import { createHttpClient } from '../src/connectors/http.ts';
import { connectors } from '../src/connectors/registry.ts';
import { normalizeJob } from '../src/pipeline/normalize.ts';

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    q: { type: 'string', multiple: true, default: [] },
    city: { type: 'string', multiple: true, default: [] },
    board: { type: 'string', multiple: true, default: [] },
    show: { type: 'string', default: '5' },
  },
});

const connector = connectors({ greenhouseBoards: values.board }).find(
  (c) => c.id === values.source,
);
if (connector === undefined) {
  console.log(
    JSON.stringify({ error: 'unknown --source', sources: ['remotive', 'mustakbil', 'greenhouse'] }),
  );
  process.exit(1);
}

const started = Date.now();
const result = await connector.search(
  { keywords: values.q, cities: values.city.map((city) => city.toLowerCase()) },
  { http: createHttpClient() },
);
const jobs = result.jobs.map((raw) => normalizeJob(raw));
console.log(
  JSON.stringify(
    {
      source: connector.label,
      status: result.status,
      notes: result.notes,
      found: jobs.length,
      seconds: Math.round((Date.now() - started) / 1000),
      sample: jobs.slice(0, Number(values.show)).map((job) => ({
        title: job.title,
        company: job.company,
        where: job.locationText,
        cities: job.cities,
        mode: job.workMode,
        pkrPerMonth: job.salary?.pkrPerMonth,
        url: job.url,
      })),
    },
    null,
    2,
  ),
);
if (result.status === 'broken') process.exitCode = 1;
