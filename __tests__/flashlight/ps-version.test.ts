const execMock = jest.fn();
jest.mock('@actions/exec', () => ({ exec: (...a: unknown[]) => execMock(...a) }));

import * as core from '@actions/core';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { psVersionFromImageTag, readPsVersionFromContainer, readSourceVersionPhp, resolvePsVersion } from '../../src/flashlight/ps-version';

type ExecOpts = { listeners?: { stdout?: (b: Buffer) => void } };

function execPrinting(stdout: string) {
  return async (_cmd: string, _args: string[], opts: ExecOpts) => {
    opts.listeners?.stdout?.(Buffer.from(stdout));
    return 0;
  };
}

beforeEach(() => {
  execMock.mockReset();
  jest.spyOn(core, 'info').mockImplementation(() => undefined);
  jest.spyOn(core, 'warning').mockImplementation(() => undefined);
});

describe('psVersionFromImageTag', () => {
  it.each([
    ['9.0.0', '9.0.0'],
    ['1.7.8.11', '1.7.8.11'],
    ['8.2.8-nginx', '8.2.8'],
    ['8.2.8-8.1-fpm-alpine3.21-nginx', '8.2.8'],
    ['1.7.8.11-7.4-fpm-alpine-nginx', '1.7.8.11'],
    [' 9.2.1-8.2-apache ', '9.2.1'],
  ])('%s → %s', (tag, version) => {
    expect(psVersionFromImageTag(tag)).toBe(version);
  });

  it.each(['latest', 'nightly', 'base-8.2-fpm-alpine3.23-nginx', '8.2', '', '8.2.8nginx'])('%s → null', tag => {
    expect(psVersionFromImageTag(tag)).toBeNull();
  });
});

describe('readPsVersionFromContainer', () => {
  it('reads PS_VERSION from the image environment', async () => {
    execMock.mockImplementation(execPrinting('9.2.1\n'));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBe('9.2.1');
    const args = execMock.mock.calls[0][1] as string[];
    expect(args).toEqual(['compose', '-f', '/tmp/c.yml', 'exec', '-T', 'prestashop', 'printenv', 'PS_VERSION']);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('falls back on the shop sources when PS_VERSION is missing', async () => {
    execMock
      .mockImplementationOnce(execPrinting(''))
      .mockImplementationOnce(execPrinting('8.1.7'));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBe('8.1.7');
    expect((execMock.mock.calls[1][1] as string[]).slice(6, 8)).toEqual(['php', '-r']);
  });

  it('returns null on empty or unexpected output, or when docker fails', async () => {
    execMock.mockImplementation(execPrinting(''));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBeNull();
    execMock.mockImplementation(execPrinting('PHP Warning: nope'));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBeNull();
    execMock.mockRejectedValue(new Error('docker gone'));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBeNull();
  });
});

// The snippet itself, run with the local php on the shapes of the real files
// (checked in the 1.7.8.11, 8.1.7, 8.2.8, 9.0.0 and 9.2.0 Flashlight images).
const hasPhp = (() => { try { execFileSync('php', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();
(hasPhp ? describe : describe.skip)('readSourceVersionPhp', () => {
  function shop(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-src-'));
    for (const [f, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), body);
    }
    return root;
  }
  const run = (root: string): string => execFileSync('php', ['-r', readSourceVersionPhp(root)]).toString();

  it('reads src/Core/Version.php (8.0 and later), where AppKernel only refers to it', () => {
    const root = shop({
      'src/Core/Version.php': "<?php\nclass Version\n{\n    public const VERSION = '8.2.8';\n}\n",
      'app/AppKernel.php': "<?php\nclass AppKernel\n{\n    const VERSION = Version::VERSION;\n}\n",
    });
    expect(run(root)).toBe('8.2.8');
  });

  it('reads app/AppKernel.php on 1.7', () => {
    const root = shop({ 'app/AppKernel.php': "<?php\nclass AppKernel\n{\n    const VERSION = '1.7.8.11';\n}\n" });
    expect(run(root)).toBe('1.7.8.11');
  });

  it('prints nothing when neither declares it', () => {
    expect(run(shop({}))).toBe('');
  });
});

describe('resolvePsVersion', () => {
  it('takes the version from the tag without asking the shop', async () => {
    await expect(resolvePsVersion({ imageTag: '8.2.8-nginx', composePath: '/c' })).resolves.toBe('8.2.8');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('asks the shop for a tag without version', async () => {
    execMock.mockImplementation(execPrinting('9.2.1'));
    await expect(resolvePsVersion({ imageTag: 'latest', composePath: '/c' })).resolves.toBe('9.2.1');
  });

  it('warns and returns null when neither says', async () => {
    execMock.mockImplementation(execPrinting(''));
    await expect(resolvePsVersion({ imageTag: 'latest', composePath: '/c' })).resolves.toBeNull();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('PRESTAFLOW_PS_VERSION is not set'));
  });
});
