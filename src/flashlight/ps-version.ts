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

// Every supported release (1.7, 8, 9) declares its version in AppKernel.
const READ_VERSION_PHP =
  `echo preg_match("/const VERSION = '([0-9.]+)'/", (string) @file_get_contents('/var/www/html/app/AppKernel.php'), $m) ? $m[1] : '';`;

/** Read the version from the running shop, for a tag that does not carry it. */
export async function readPsVersionFromContainer(composePath: string): Promise<string | null> {
  let output = '';
  try {
    await exec.exec('docker', [
      'compose', '-f', composePath, 'exec', '-T', 'prestashop', 'php', '-r', READ_VERSION_PHP,
    ], { ignoreReturnCode: true, silent: true, listeners: { stdout: (b: Buffer) => { output += b.toString(); } } });
  } catch {
    return null;
  }
  const version = output.trim();
  return psVersionFromImageTag(version) === version ? version : null;
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
