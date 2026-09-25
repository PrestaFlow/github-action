import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { DefaultArtifactClient } from '@actions/artifact';
import { randomBytes } from 'crypto';

export interface ArtifactParams {
  /** PS version when Flashlight is on, null otherwise. */
  psVersion?: string | null;
  suites?: string[];
}

function slug(s: string): string {
  // Keep clear of the characters the artifact service rejects (" : < > | * ? \ / CR LF).
  return s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Artifact names must be unique within a workflow run and @actions/artifact v2
// cannot overwrite: in a matrix, every leg used to upload the same name and
// all but the first got a 409 Conflict. The matrix values themselves are not
// exposed to actions, so the name is built from what distinguishes the usual
// legs (job id, Flashlight PS version, suites), with a random fallback below.
export function artifactName(p: ArtifactParams = {}): string {
  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
  const parts = [`prestaflow-report-${runId}-${attempt}`];
  const job = slug(process.env.GITHUB_JOB ?? '');
  if (job) parts.push(job);
  if (p.psVersion) parts.push(`ps${slug(p.psVersion)}`);
  if (p.suites?.length) parts.push(slug(p.suites.join('_')));
  return parts.join('-');
}

export async function uploadArtifacts(p: ArtifactParams = {}): Promise<void> {
  const patterns = ['**/prestaflow/results.json', '**/prestaflow/screens/errors/*.png'];
  const globber = await glob.create(patterns.join('\n'));
  const files = await globber.glob();

  if (!files.length) {
    core.info('No PrestaFlow output files found — skipping artifact upload.');
    return;
  }

  const name = artifactName(p);
  const rootDir = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const client = new DefaultArtifactClient();
  try {
    await client.uploadArtifact(name, files, rootDir, {});
    core.info(`Uploaded artifact ${name} (${files.length} files)`);
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.info(`Artifact upload as ${name} failed (${msg}); retrying with a unique suffix.`);
  }
  // Two legs of a matrix can still share job/PS version/suites (e.g. a matrix
  // on the PHP version): retry once under a random suffix.
  const fallback = `${name}-${randomBytes(3).toString('hex')}`;
  try {
    await client.uploadArtifact(fallback, files, rootDir, {});
    core.info(`Uploaded artifact ${fallback} (${files.length} files)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`Artifact upload failed: ${msg}`);
  }
}
