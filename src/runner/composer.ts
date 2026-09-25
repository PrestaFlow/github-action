import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';

export interface RunComposerParams {
  execute: boolean;
  env: Record<string, string>;
  /** Keys removed from the inherited env (they are provided via .env.local). */
  stripEnv?: string[];
}

export async function runComposer(p: RunComposerParams): Promise<void> {
  if (!p.execute) {
    core.info('execute=false — skipping composer test run.');
    return;
  }
  if (!fs.existsSync('composer.json')) {
    core.info('No composer.json found — skipping composer test run.');
    return;
  }
  const env = { ...process.env, ...p.env } as Record<string, string>;
  for (const k of p.stripEnv ?? []) delete env[k];
  await exec.exec('composer', ['run', 'prestaflow:json:file'], { env });
}
