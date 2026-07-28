import * as core from '@actions/core';
import * as cache from '@actions/cache';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface Baseline {
  id: string;
  name: string;
  tag: string;
  sha256: string;
  download_url: string;
}

export interface BaselinesManifest {
  baselines: Baseline[];
  branch?: string | null;
  manifest_sha256: string;
}

export interface PrepareVisualBaselinesOptions {
  apiBaseUrl: string;
  token: string;
  projectId: string;
  branch?: string;
  visualBaselineDir?: string;
  enabled: boolean;
}

function resolveBaselineDir(dir?: string): string {
  if (dir) return dir;
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  return path.join(workspace, 'visual-baseline');
}

async function downloadBaselineFile(
  apiBaseUrl: string,
  token: string,
  baseline: Baseline,
  destDir: string,
): Promise<void> {
  const dest = path.join(destDir, `${baseline.name}--${baseline.tag}.png`);
  try {
    const res = await axios.get(`${apiBaseUrl}${baseline.download_url}`, {
      responseType: 'stream',
      headers: { 'X-Api-Token': token },
    });
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(dest);
      res.data.pipe(writer);
      writer.on('finish', () => resolve());
      writer.on('error', reject);
      res.data.on('error', reject);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`visual: failed to download baseline ${baseline.name}--${baseline.tag}: ${msg}`);
  }
}

export async function prepareVisualBaselines(opts: PrepareVisualBaselinesOptions): Promise<void> {
  if (opts.enabled === false) {
    core.info('visual regression disabled');
    return;
  }

  const baselineDir = resolveBaselineDir(opts.visualBaselineDir);
  const branch = opts.branch;
  const url = `${opts.apiBaseUrl}/ci/visual/baselines${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`;

  let res;
  try {
    res = await axios.get(url, {
      headers: { 'X-Api-Token': opts.token },
      validateStatus: () => true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`visual: failed to reach ${url}: ${msg}`);
  }

  if (res.status === 404 || res.status === 501) {
    core.warning('API does not support visual baselines yet, skipping download');
    return;
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `visual: failed to fetch baselines manifest (HTTP ${res.status}): ${JSON.stringify(res.data)}`,
    );
  }

  const manifest = res.data as BaselinesManifest;
  const baselines = manifest.baselines ?? [];

  if (!baselines.length) {
    core.info('visual: no baselines in manifest, nothing to prepare');
    return;
  }

  const cacheKey = `visual-baseline-${opts.projectId}-${manifest.manifest_sha256}`;

  let cacheHit: string | undefined;
  try {
    cacheHit = await cache.restoreCache([baselineDir], cacheKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`visual: cache restore failed, will download: ${msg}`);
  }

  if (cacheHit) {
    const count = fs.existsSync(baselineDir) ? fs.readdirSync(baselineDir).length : 0;
    core.info(`visual: cache hit (${cacheKey}), ${count} baseline file(s) restored`);
    return;
  }

  fs.mkdirSync(baselineDir, { recursive: true });

  for (const baseline of baselines) {
    await downloadBaselineFile(opts.apiBaseUrl, opts.token, baseline, baselineDir);
  }

  core.info(`visual: downloaded ${baselines.length} baseline(s) to ${baselineDir}`);

  try {
    await cache.saveCache([baselineDir], cacheKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`visual: cache save failed: ${msg}`);
  }
}
