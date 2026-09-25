import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import * as http from 'http';

export async function pickPort(candidates: number[]): Promise<number> {
  for (const port of candidates) {
    const free = await new Promise<boolean>(resolve => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => s.close(() => resolve(true)));
      s.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error(`No free port among ${candidates.join(', ')}`);
}

function statusOf(url: string): Promise<number> {
  return new Promise<number>(resolve => {
    const req = http.get(url, res => {
      resolve(res.statusCode ?? 0);
      res.resume();
    });
    req.on('error', () => resolve(0));
    req.setTimeout(3000, () => { req.destroy(); resolve(0); });
  });
}

export interface WaitOptions {
  timeoutMs: number;
  intervalMs?: number;
}

// Flashlight's front answers as soon as the web server is up, before the
// post-install scripts are done, so a 2xx on `/` only proves that something
// listens on the port. The admin folder is renamed to the fixed `admin-dev`,
// which redirects (302) to the login page once PHP and PrestaShop are really
// serving; 200 is accepted too in case a future image serves the login page
// directly.
export async function waitForShop(baseUrl: string, opts: WaitOptions): Promise<void> {
  const url = `${baseUrl}/admin-dev/`;
  const interval = opts.intervalMs ?? 2000;
  const start = Date.now();
  let last = 0;
  while (Date.now() - start < opts.timeoutMs) {
    last = await statusOf(url);
    if (last === 200 || last === 302) return;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(
    `Flashlight not ready after ${opts.timeoutMs}ms: ${url} never answered 302/200 (last status: ${last || 'no response'})`,
  );
}

export async function assertDockerAvailable(): Promise<void> {
  try {
    await exec.exec('docker', ['--version'], { silent: true });
  } catch {
    throw new Error('flashlight: true requires Docker (use ubuntu-latest runner)');
  }
}

export interface StartParams {
  composeYaml: string;
  port: number;
  host?: string;
  readyTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface FlashlightHandle {
  url: string;
  composePath: string;
  tearDown: (opts: { onFailure: boolean }) => Promise<void>;
}

export async function startFlashlight(p: StartParams): Promise<FlashlightHandle> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prestaflow-'));
  const composePath = path.join(tmpDir, 'docker-compose.yml');
  fs.writeFileSync(composePath, p.composeYaml);

  await exec.exec('docker', ['compose', '-f', composePath, 'up', '-d']);

  const url = `http://${p.host ?? 'localhost'}:${p.port}`;

  const tearDown = async ({ onFailure }: { onFailure: boolean }): Promise<void> => {
    if (onFailure) {
      core.startGroup('Flashlight logs');
      await exec.exec('docker', ['compose', '-f', composePath, 'logs'], { ignoreReturnCode: true });
      core.endGroup();
    }
    await exec.exec('docker', ['compose', '-f', composePath, 'down', '-v'], { ignoreReturnCode: true });
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  try {
    // 4 min: MySQL healthcheck + PS first-boot install can legitimately take
    // 90-150s on cold GitHub Actions runners.
    await waitForShop(url, { timeoutMs: p.readyTimeoutMs ?? 240_000, intervalMs: p.pollIntervalMs });
  } catch (e) {
    // No handle is returned on failure, so dump the logs and clean up here.
    await tearDown({ onFailure: true });
    throw e;
  }

  return { url, composePath, tearDown };
}
