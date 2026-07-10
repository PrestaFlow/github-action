import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { DefaultArtifactClient } from '@actions/artifact';

export async function uploadArtifacts(): Promise<void> {
  const patterns = ['**/prestaflow/results.json', '**/prestaflow/screens/errors/*.png'];
  const globber = await glob.create(patterns.join('\n'));
  const files = await globber.glob();

  if (!files.length) {
    core.info('No PrestaFlow output files found — skipping artifact upload.');
    return;
  }

  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
  const name = `prestaflow-report-${runId}-${attempt}`;
  const rootDir = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const client = new DefaultArtifactClient();
  try {
    await client.uploadArtifact(name, files, rootDir, {});
    core.info(`Uploaded artifact ${name} (${files.length} files)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`Artifact upload failed: ${msg}`);
  }
}
