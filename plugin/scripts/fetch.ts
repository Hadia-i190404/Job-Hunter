// Run one connector and print what it found, with each job's Pakistan verdict and scam
// check. --save adds the jobs to the data folder (set up with `store.ts init` first).
// Usage: sh run.sh fetch.ts --source remotive|mustakbil|greenhouse
//          --q "react developer" [--q …] [--city lahore …] [--board gitlab …] [--show 5] [--save]
import { parseArgs } from 'node:util';
import { createHttpClient } from '../src/connectors/http.ts';
import { connectors } from '../src/connectors/registry.ts';
import { groupDuplicates } from '../src/pipeline/dedup.ts';
import { assessEligibility } from '../src/pipeline/eligibility.ts';
import { normalizeJob } from '../src/pipeline/normalize.ts';
import { checkScam } from '../src/pipeline/scam.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { loadJobs, saveJobs } from '../src/store/jobs.ts';
import { dataDir } from '../src/store/paths.ts';

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    q: { type: 'string', multiple: true, default: [] },
    city: { type: 'string', multiple: true, default: [] },
    board: { type: 'string', multiple: true, default: [] },
    show: { type: 'string', default: '5' },
    save: { type: 'boolean', default: false },
  },
});

const dir = dataDir();
const opened = values.save ? await openDataFolder(dir) : 'ok';
if (opened !== 'ok') {
  console.log(JSON.stringify({ error: opened, hint: 'run store.ts init first' }));
  process.exit(1);
}
const known = values.save ? await loadJobs(dir) : new Map();

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
  { http: createHttpClient(), isKnown: (id) => known.has(id) },
);
const jobs = result.jobs.map((raw) => normalizeJob(raw));
const groups = groupDuplicates(jobs);
const saved = values.save ? await saveJobs(dir, jobs) : undefined;
console.log(
  JSON.stringify(
    {
      source: connector.label,
      status: result.status,
      notes: result.notes,
      found: jobs.length,
      afterDuplicates: groups.length,
      saved,
      seconds: Math.round((Date.now() - started) / 1000),
      sample: groups.slice(0, Number(values.show)).map(({ primary: job }) => ({
        title: job.title,
        company: job.company,
        where: job.locationText,
        cities: job.cities,
        mode: job.workMode,
        pkrPerMonth: job.salary?.pkrPerMonth,
        pakistan: assessEligibility(job),
        scam: checkScam(job).level,
        url: job.url,
      })),
    },
    null,
    2,
  ),
);
if (result.status === 'broken') process.exitCode = 1;
