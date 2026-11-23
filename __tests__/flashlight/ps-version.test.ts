const execMock = jest.fn();
jest.mock('@actions/exec', () => ({ exec: (...a: unknown[]) => execMock(...a) }));

import * as core from '@actions/core';
import { psVersionFromImageTag, readPsVersionFromContainer, resolvePsVersion } from '../../src/flashlight/ps-version';

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
  it('reads the version printed by the shop', async () => {
    execMock.mockImplementation(execPrinting('9.2.1\n'));
    await expect(readPsVersionFromContainer('/tmp/c.yml')).resolves.toBe('9.2.1');
    const args = execMock.mock.calls[0][1] as string[];
    expect(args.slice(0, 6)).toEqual(['compose', '-f', '/tmp/c.yml', 'exec', '-T', 'prestashop']);
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
