import * as core from '@actions/core';

export interface Inputs {
  token: string;
  projectId: string;
  execute: boolean;
  suites: string[];
  flashlight: boolean;
  psVersion: string;
  prComment: boolean;
  githubToken: string;
  uploadArtifacts: boolean;
}

function getBool(name: string, defaultVal: boolean): boolean {
  const raw = core.getInput(name);
  if (raw === '') return defaultVal;
  return raw.toLowerCase() === 'true';
}

function getCsv(name: string): string[] {
  const raw = core.getInput(name);
  if (!raw.trim()) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function parseInputs(): Inputs {
  const token = core.getInput('token');
  if (!token) throw new Error('Input `token` is required');

  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const prCommentDefault = eventName === 'pull_request';

  return {
    token,
    projectId: core.getInput('projectId'),
    execute: getBool('execute', true),
    suites: getCsv('suites'),
    flashlight: getBool('flashlight', false),
    psVersion: core.getInput('ps-version') || 'latest',
    prComment: getBool('pr-comment', prCommentDefault),
    githubToken: core.getInput('github-token'),
    uploadArtifacts: getBool('upload-artifacts', true),
  };
}
