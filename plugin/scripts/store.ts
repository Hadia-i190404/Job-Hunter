// Data-folder commands for the skills. Prints one JSON object; exit 0 on success.
// Usage: sh run.sh store.ts <status|init|pause|resume>
import { DataFileError } from '../src/store/json-file.ts';
import { folderStatus, initDataFolder } from '../src/store/folder.ts';
import { migrate } from '../src/store/migrations.ts';
import { dataDir } from '../src/store/paths.ts';
import { setPaused } from '../src/store/settings.ts';

const dir = dataDir();
const command = process.argv[2] ?? '';

async function run(): Promise<unknown> {
  switch (command) {
    case 'status':
      return { dir, ...(await folderStatus(dir)) };
    case 'init': {
      const { created } = await initDataFolder(dir);
      return { dir, created, migration: await migrate(dir) };
    }
    case 'pause':
    case 'resume': {
      const migration = await migrate(dir);
      if (migration.status === 'not-set-up') return { dir, error: 'not-set-up' };
      if (migration.status === 'too-new') return { dir, error: 'plugin-too-old', migration };
      await setPaused(dir, command === 'pause');
      return { dir, paused: command === 'pause' };
    }
    default:
      return { error: `unknown command "${command}"`, usage: 'status|init|pause|resume' };
  }
}

run().then(
  (result) => {
    console.log(JSON.stringify(result, null, 2));
    if (typeof result === 'object' && result !== null && 'error' in result) process.exitCode = 1;
  },
  (error: unknown) => {
    const message = error instanceof DataFileError ? error.message : String(error);
    console.log(JSON.stringify({ dir, error: message }, null, 2));
    process.exitCode = 1;
  },
);
