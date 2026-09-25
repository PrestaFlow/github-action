import * as core from '@actions/core';
import * as exec from '@actions/exec';
import type { ComposerJson } from './mount';

const MODULES_DIR = '/var/www/html/modules/';
const NAME_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Module to install after boot: only a composer `prestashop-module` mounted
 * under modules/ (never a theme, a root mount, or the modules/<repo> fallback
 * used when composer.json does not say what the repository is).
 */
export function moduleToInstall(p: { composerJson: ComposerJson | null; containerPath: string }): string | null {
  if (p.composerJson?.type !== 'prestashop-module') return null;
  if (!p.containerPath.startsWith(MODULES_DIR)) return null;
  const name = p.containerPath.slice(MODULES_DIR.length);
  return NAME_RE.test(name) ? name : null;
}

/**
 * Run `bin/console prestashop:module install <name>` in the Flashlight
 * container. On an already installed module (e.g. by an init-script)
 * PrestaShop runs an upgrade instead and reports the same success message
 * (checked on the 1.7.8.11, 8.1.7 and 9.0.0 images). The exit code is not
 * reliable (8.1 and 9.0 exit 0 on failure), so success is read from the
 * output. A failure only warns: the tests will tell whether the module is
 * needed.
 */
export async function installModule(p: { composePath: string; name: string }): Promise<boolean> {
  if (!NAME_RE.test(p.name)) {
    core.warning(`flashlight-install-module: invalid module name "${p.name}", skipping install.`);
    return false;
  }
  let output = '';
  const collect = (b: Buffer): void => { output += b.toString(); };
  try {
    core.info(`Installing module ${p.name} in Flashlight (disable with flashlight-install-module: false)`);
    await exec.exec('docker', [
      'compose', '-f', p.composePath, 'exec', '-T', '-w', '/var/www/html', 'prestashop',
      'php', 'bin/console', 'prestashop:module', 'install', p.name,
    ], { ignoreReturnCode: true, listeners: { stdout: collect, stderr: collect } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`Could not install module ${p.name} in Flashlight: ${msg}. Set flashlight-install-module: false to skip this step.`);
    return false;
  }
  if (/succeeded/i.test(output)) return true;
  core.warning(
    `Module ${p.name} was not installed in Flashlight:\n${output.trim() || '(no output)'}\n`
    + 'Set flashlight-install-module: false to skip this step (e.g. if an init-script installs it).',
  );
  return false;
}
