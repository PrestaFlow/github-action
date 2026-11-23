import * as core from '@actions/core';
import * as exec from '@actions/exec';

/**
 * PrestaShop version carried by a Flashlight image tag: `8.2.8-nginx`,
 * `8.2.8-8.1-fpm-alpine3.21-nginx` and `9.0.0` all start with it. Tags without
 * a version (`latest`, `nightly`, `base-8.2-…`) return null.
 *
 * prestaflow/php-library only parses a bare version (`1.7.8.11`, `8.2.8`), and
 * fails the whole run on anything else, so the tag is never passed as is.
 */
export function psVersionFromImageTag(tag: string): string | null {
  const m = /^(\d+\.\d+\.\d+(?:\.\d+)?)(?:-|$)/.exec(tag.trim());
  return m ? m[1] : null;
}

/** Last line of a command run in the PrestaShop container, '' when it fails. */
async function execInShop(composePath: string, command: string[]): Promise<string> {
  let output = '';
  try {
    await exec.exec('docker', ['compose', '-f', composePath, 'exec', '-T', 'prestashop', ...command], {
      ignoreReturnCode: true, silent: true, listeners: { stdout: (b: Buffer) => { output += b.toString(); } },
    });
  } catch {
    return '';
  }
  return output.trim().split('\n').pop()?.trim() ?? '';
}

const isBareVersion = (v: string): boolean => v !== '' && psVersionFromImageTag(v) === v;

// Fallback for an image without PS_VERSION: releases up to 9.1 declare it in AppKernel.
const READ_APPKERNEL_PHP =
  `echo preg_match("/const VERSION = '([0-9.]+)'/", (string) @file_get_contents('/var/www/html/app/AppKernel.php'), $m) ? $m[1] : '';`;

/**
 * Read the version from the running shop, for a tag that does not carry it.
 * Flashlight images declare it in their PS_VERSION environment variable
 * (`latest` is 9.2.1 at the time of writing).
 */
export async function readPsVersionFromContainer(composePath: string): Promise<string | null> {
  const fromEnv = await execInShop(composePath, ['printenv', 'PS_VERSION']);
  if (isBareVersion(fromEnv)) return fromEnv;
  const fromKernel = await execInShop(composePath, ['php', '-r', READ_APPKERNEL_PHP]);
  return isBareVersion(fromKernel) ? fromKernel : null;
}

/**
 * Version given to the library as PRESTAFLOW_PS_VERSION: from the tag, else
 * from the shop. Null when neither says: the variable is then left to the
 * user's dotenv file or step env, with a warning.
 */
export async function resolvePsVersion(p: { imageTag: string; composePath: string }): Promise<string | null> {
  const fromTag = psVersionFromImageTag(p.imageTag);
  if (fromTag) return fromTag;
  const fromShop = await readPsVersionFromContainer(p.composePath);
  if (fromShop) {
    core.info(`Flashlight image ${p.imageTag}: PrestaShop ${fromShop} read from the shop.`);
    return fromShop;
  }
  core.warning(
    `Could not tell the PrestaShop version of Flashlight image "${p.imageTag}": PRESTAFLOW_PS_VERSION is not set by the action. `
    + 'Set it with env: on the step, or use a versioned ps-version (e.g. 8.2.8-nginx).',
  );
  return null;
}
