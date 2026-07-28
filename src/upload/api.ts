import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from '@actions/glob';
import FormData from 'form-data';

const ENDPOINT = 'https://api.prestaflow.io/ci/github-action';

export interface UploadParams {
  token: string;
  projectId: string;
}

export interface UploadResult {
  id: string;
  url: string;
}

export async function uploadToApi(p: UploadParams): Promise<UploadResult> {
  const form = new FormData();
  form.append('projectId', p.projectId);

  const branch = process.env.GITHUB_REF_NAME;
  if (branch) form.append('branch', branch);
  const commitSha = process.env.GITHUB_SHA;
  if (commitSha) form.append('commit_sha', commitSha);
  const ref = process.env.GITHUB_REF;
  if (ref) form.append('ref', ref);
  const ciRunId = process.env.GITHUB_RUN_ID;
  if (ciRunId) form.append('ci_run_id', ciRunId);

  const patterns = [
    '**/prestaflow/results.json',
    '**/prestaflow/screens/errors/*.png',
    '**/prestaflow/screens/actual/*.png',
    '**/prestaflow/screens/diff/*.png',
  ];
  const globber = await glob.create(patterns.join('\n'));

  for await (const file of globber.globGenerator()) {
    const stats = fs.statSync(file);
    if (!stats.isFile()) continue;
    const base = path.basename(file);
    const normalized = file.split(path.sep).join('/');
    let name: string;
    if (normalized.includes('screens/errors/')) {
      name = `screens/${base}`;
    } else if (normalized.includes('screens/actual/')) {
      name = `visual/actual/${base}`;
    } else if (normalized.includes('screens/diff/')) {
      name = `visual/diff/${base}`;
    } else {
      name = base;
    }
    form.append('file[]', fs.createReadStream(file), name);
  }

  const res = await axios.post(ENDPOINT, form, {
    headers: { ...form.getHeaders(), 'X-Api-Token': p.token },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return { id: String(res.data.id), url: String(res.data.url ?? '') };
}
