import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { parseInputs } from './inputs';
import { resolveMount } from './flashlight/mount';
import { renderCompose } from './flashlight/compose-template';
import { assertDockerAvailable, startFlashlight, pickPort, FlashlightHandle } from './flashlight/docker';
import { suitesEnv } from './runner/suites';
import { runComposer } from './runner/composer';
import { prepareVisualBaselines } from './visual/prepare';
import { uploadToApi } from './upload/api';
import { uploadArtifacts } from './upload/artifacts';
import { parseResults, TestReport } from './reporter/parse-results';
import { setOutputs } from './reporter/outputs';
import { buildCommentBody } from './reporter/pr-comment-body';
import { postOrUpdatePrComment } from './reporter/pr-comment';

const API_BASE_URL = 'https://api.prestaflow.io';

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

function writeDotEnvLocal(workspace: string, vars: Record<string, string>): void {
  // The PHP library reads env vars through phpdotenv (Dotenv::createImmutable),
  // which only picks up .env / .env.local files — NOT process env, unless PHP
  // is built with variables_order including 'E' (rarely the case in CI).
  // Writing .env.local (loaded before .env, values are immutable so they win)
  // guarantees the lib sees our values regardless of PHP config.
  const path = `${workspace}/.env.local`;
  const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(path, body);
  core.info(`Wrote ${Object.keys(vars).length} vars to ${path}`);
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
        mode: inputs.flashlightMount,
      });
      if (mount.warning) core.warning(mount.warning);
      core.info(`Mounting workspace at ${mount.containerPath} (mode: ${inputs.flashlightMount})`);

      let initScriptsHostPath: string | undefined;
      if (inputs.flashlightInitScripts) {
        const resolved = path.isAbsolute(inputs.flashlightInitScripts)
          ? inputs.flashlightInitScripts
          : path.join(workspace, inputs.flashlightInitScripts);
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
          throw new Error(
            `flashlight-init-scripts: path does not exist or is not a directory: ${resolved}`,
          );
        }
        initScriptsHostPath = resolved;
        core.info(`Mounting init-scripts from ${resolved} → /tmp/init-scripts (read-only)`);
      }

      const port = await pickPort([8000, 8001, 8002]);
      const composeYaml = renderCompose({
        psVersion: inputs.psVersion,
        port,
        workspace,
        containerPath: mount.containerPath,
        initScriptsHostPath,
      });
      flashlight = await startFlashlight({ composeYaml, port });
      env.PRESTAFLOW_FO_URL = `${flashlight.url}/`;
      env.PRESTAFLOW_PS_VERSION = inputs.psVersion;
      writeDotEnvLocal(workspace, {
        PRESTAFLOW_FO_URL: `${flashlight.url}/`,
        PRESTAFLOW_PS_VERSION: inputs.psVersion,
      });
      core.info(`Flashlight ready at ${flashlight.url} (PS ${inputs.psVersion})`);
    }

    try {
      await prepareVisualBaselines({
        apiBaseUrl: API_BASE_URL,
        token: inputs.token,
        projectId: inputs.projectId,
        branch: process.env.GITHUB_REF_NAME,
        enabled: inputs.visual,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      core.warning(`visual: prepare step failed, continuing without baselines: ${msg}`);
    }

    try {
      await runComposer({ execute: inputs.execute, env });
    } catch (e) {
      // Composer exits non-zero when tests fail — that's the normal reporting
      // channel. Do NOT rethrow, or we skip the parse/upload/PR-comment path
      // and lose all observability. The final setFailed() at the end still
      // reflects report.failed > 0. If composer literally could not run
      // (missing binary, missing composer.json handled upstream), the caller
      // will see the message in the log.
      stepFailed = true;
      const msg = e instanceof Error ? e.message : String(e);
      core.warning(`composer exited non-zero — will parse results.json anyway. Reason: ${msg}`);
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

    let uploaded = { id: '', url: '' };
    if (resultsPath) {
      try {
        uploaded = await uploadToApi({ token: inputs.token, projectId: inputs.projectId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        core.warning(`API upload failed: ${msg}`);
      }
    } else {
      core.info('Skipping API upload (no results.json to send).');
    }

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
