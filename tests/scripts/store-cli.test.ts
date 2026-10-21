import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

// Runs the CLI exactly as the skills do: through the launcher.
function cli(home: string, ...args: string[]): { code: number | null; json: unknown } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/store.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as unknown };
}

// These start real Node processes (the launcher probes several), which is slow on a
// busy 2-core CI runner, so they get more than the default 5 s.
describe('store CLI via run.sh', { timeout: 30_000 }, () => {
  it('goes from not set up to set up, paused and resumed', async () => {
    const home = await tempDir();
    expect(cli(home, 'status').json).toMatchObject({ setUp: false });
    expect(cli(home, 'pause')).toMatchObject({ code: 1, json: { error: 'not-set-up' } });
    expect(cli(home, 'init').json).toMatchObject({ created: true });
    expect(cli(home, 'pause')).toMatchObject({ code: 0, json: { paused: true } });
    expect(cli(home, 'status').json).toMatchObject({ setUp: true, paused: true });
    expect(cli(home, 'resume').json).toMatchObject({ paused: false });
  });

  it('rejects unknown commands', async () => {
    expect(cli(await tempDir(), 'explode')).toMatchObject({ code: 1 });
  });

  it('explains when no suitable Node.js exists', () => {
    const result = spawnSync('/bin/sh', ['plugin/scripts/run.sh', '-v'], {
      encoding: 'utf8',
      env: { PATH: '/nonexistent', HOME: '/nonexistent', JOB_HUNTER_NODE: '/nonexistent/node' },
    });
    if (result.status === 0) return; // a Node lives in a standard location on this machine
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('22.18 or newer');
  });
});
