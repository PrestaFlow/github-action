import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';

export interface RunComposerParams {
  execute: boolean;
  env: Record<string, string>;
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
  await exec.exec('composer', ['run', 'prestaflow:json:file'], {
    env: { ...process.env, ...p.env } as Record<string, string>,
  });
}
