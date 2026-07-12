import * as core from '@actions/core';
import type { MountMode } from './flashlight/mount';

export interface Inputs {
  token: string;
  projectId: string;
  execute: boolean;
  suites: string[];
  flashlight: boolean;
  psVersion: string;
  flashlightMount: MountMode;
  flashlightInitScripts: string;
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

const VALID_MOUNT_MODES: MountMode[] = ['auto', 'root', 'modules', 'themes'];

function getMountMode(): MountMode {
  const raw = core.getInput('flashlight-mount').trim().toLowerCase();
  if (!raw) return 'auto';
  if (!VALID_MOUNT_MODES.includes(raw as MountMode)) {
    throw new Error(
      `Input \`flashlight-mount\` must be one of ${VALID_MOUNT_MODES.join(', ')} (got: ${raw})`,
    );
  }
  return raw as MountMode;
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
    flashlightMount: getMountMode(),
    flashlightInitScripts: core.getInput('flashlight-init-scripts').trim(),
    prComment: getBool('pr-comment', prCommentDefault),
    githubToken: core.getInput('github-token'),
    uploadArtifacts: getBool('upload-artifacts', true),
  };
}
