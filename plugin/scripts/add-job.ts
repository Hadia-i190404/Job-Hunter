// Add a job by hand (S2.3). Prints one JSON object.
// Usage: sh run.sh add-job.ts <command>
//   url <link>            read the job's page; if blocked, says so (then use manual)
//   manual <job.json>     {url, title, company, location?, description?, salaryText?, source?}
import { readFile } from 'node:fs/promises';
import { createHttpClient } from '../src/connectors/http.ts';
import { addJob, readJobPage, type ManualJob } from '../src/hunt/add-job.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { dataDir } from '../src/store/paths.ts';

const dir = dataDir();
const [command = '', arg] = process.argv.slice(2);

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  if (command === 'url' && arg !== undefined) {
    if (!/^https?:\/\//.test(arg)) return { error: 'not a link' };
    const job = await readJobPage(createHttpClient(), arg);
    if (job === undefined)
      return {
        error: 'unreadable',
        hint: 'the site blocks reading or has no job data: paste the job text and use manual',
      };
    return addJob(dir, job);
  }
  if (command === 'manual' && arg !== undefined) {
    const job = JSON.parse(await readFile(arg, 'utf8')) as ManualJob;
    if (typeof job.url !== 'string' || !/^https?:\/\//.test(job.url) || !job.title)
      return { error: 'manual job needs url and title' };
    return addJob(dir, job);
  }
  return { error: 'usage', commands: 'url <link> | manual <job.json>' };
}

run().then(
  (result) => {
    console.log(JSON.stringify(result, null, 2));
    if (typeof result === 'object' && result !== null && 'error' in result) process.exitCode = 1;
  },
  (error: unknown) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  },
);
