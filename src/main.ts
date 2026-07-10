import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { parseInputs } from './inputs';
import { resolveMount } from './flashlight/mount';
import { renderCompose } from './flashlight/compose-template';
import { assertDockerAvailable, startFlashlight, pickPort, FlashlightHandle } from './flashlight/docker';
import { suitesEnv } from './runner/suites';
import { runComposer } from './runner/composer';
import { uploadToApi } from './upload/api';
import { uploadArtifacts } from './upload/artifacts';
import { parseResults, TestReport } from './reporter/parse-results';
import { setOutputs } from './reporter/outputs';
import { buildCommentBody } from './reporter/pr-comment-body';
import { postOrUpdatePrComment } from './reporter/pr-comment';

function readComposerJson(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync('composer.json')) return null;
    return JSON.parse(fs.readFileSync('composer.json', 'utf-8')) as Record<string, unknown>;
  } catch { return null; }
}

function findResultsJson(): string | null {
  const candidates = ['tests/prestaflow/results.json', 'prestaflow/results.json'];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

export async function run(): Promise<void> {
  let flashlight: FlashlightHandle | null = null;
  let stepFailed = false;

  try {
    const inputs = parseInputs();
    const env: Record<string, string> = { ...suitesEnv(inputs.suites) };

    if (inputs.flashlight) {
      await assertDockerAvailable();
      const cj = readComposerJson();
      const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
      const mount = resolveMount({
        composerJson: cj as { name?: string; type?: string } | null,
        workspaceBasename: path.basename(workspace),
      });
      if (mount.warning) core.warning(mount.warning);

      const port = await pickPort([8000, 8001, 8002]);
      const composeYaml = renderCompose({
        psVersion: inputs.psVersion,
        port,
        workspace,
        containerPath: mount.containerPath,
      });
      flashlight = await startFlashlight({ composeYaml, port });
      env.PRESTAFLOW_PS_URL = flashlight.url;
      core.info(`Flashlight ready at ${flashlight.url}`);
    }

    try {
      await runComposer({ execute: inputs.execute, env });
    } catch (e) {
      stepFailed = true;
      throw e;
    }

    let report: TestReport = {
      passed: 0, failed: 0, skipped: 0, todos: 0, total: 0, durationMs: 0, failures: [],
    };
    const resultsPath = findResultsJson();
    if (resultsPath) {
      report = parseResults(JSON.parse(fs.readFileSync(resultsPath, 'utf-8')));
    } else {
      core.warning('No results.json found — outputs will be zeros.');
    }

    const uploaded = await uploadToApi({ token: inputs.token, projectId: inputs.projectId });

    if (inputs.uploadArtifacts) {
      await uploadArtifacts();
    }

    setOutputs({ report, reportId: uploaded.id, reportUrl: uploaded.url });

    if (inputs.prComment && process.env.GITHUB_EVENT_NAME === 'pull_request') {
      const body = buildCommentBody({
        report,
        reportUrl: uploaded.url,
        suites: inputs.suites,
        psVersion: inputs.flashlight ? inputs.psVersion : null,
        sha: process.env.GITHUB_SHA ?? '',
      });
      await postOrUpdatePrComment({
        token: inputs.githubToken || process.env.GITHUB_TOKEN || '',
        body,
      });
    }

    if (report.failed > 0) {
      core.setFailed(`${report.failed} test(s) failed`);
    }
  } catch (e) {
    stepFailed = true;
    const msg = e instanceof Error ? e.message : String(e);
    core.setFailed(msg);
  } finally {
    if (flashlight) {
      await flashlight.tearDown({ onFailure: stepFailed });
    }
  }
}

run();
