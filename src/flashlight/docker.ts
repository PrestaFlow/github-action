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

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>(resolve => {
      const req = http.get(url, res => {
        const code = res.statusCode ?? 0;
        resolve(code >= 200 && code < 400);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Flashlight not ready after ${timeoutMs}ms at ${url}`);
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
}

export interface FlashlightHandle {
  url: string;
  tearDown: (opts: { onFailure: boolean }) => Promise<void>;
}

export async function startFlashlight(p: StartParams): Promise<FlashlightHandle> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prestaflow-'));
  const composePath = path.join(tmpDir, 'docker-compose.yml');
  fs.writeFileSync(composePath, p.composeYaml);

  await exec.exec('docker', ['compose', '-f', composePath, 'up', '-d']);

  const url = `http://localhost:${p.port}`;
  await waitFor(url, 120_000);

  const tearDown = async ({ onFailure }: { onFailure: boolean }): Promise<void> => {
    if (onFailure) {
      core.startGroup('Flashlight logs');
      await exec.exec('docker', ['compose', '-f', composePath, 'logs'], { ignoreReturnCode: true });
      core.endGroup();
    }
    await exec.exec('docker', ['compose', '-f', composePath, 'down', '-v'], { ignoreReturnCode: true });
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { url, tearDown };
}
