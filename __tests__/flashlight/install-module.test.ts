const execMock = jest.fn();
jest.mock('@actions/exec', () => ({ exec: (...a: unknown[]) => execMock(...a) }));

import * as core from '@actions/core';
import { moduleToInstall, installModule } from '../../src/flashlight/install-module';

type ExecOpts = { listeners?: { stdout?: (b: Buffer) => void; stderr?: (b: Buffer) => void } };

function execPrinting(stdout: string, code = 0) {
  return async (_cmd: string, _args: string[], opts: ExecOpts) => {
    opts.listeners?.stdout?.(Buffer.from(stdout));
    return code;
  };
}

describe('moduleToInstall', () => {
  it('returns the module folder for a prestashop-module mounted under modules/', () => {
    expect(moduleToInstall({
      composerJson: { name: 'acme/mymodule', type: 'prestashop-module' },
      containerPath: '/var/www/html/modules/mymodule',
    })).toBe('mymodule');
  });

  it('returns null for themes, root mounts and unknown composer types', () => {
    expect(moduleToInstall({ composerJson: { type: 'prestashop-theme' }, containerPath: '/var/www/html/themes/t' })).toBeNull();
    expect(moduleToInstall({ composerJson: { type: 'prestashop-module' }, containerPath: '/var/www/html' })).toBeNull();
    expect(moduleToInstall({ composerJson: null, containerPath: '/var/www/html/modules/repo' })).toBeNull();
    expect(moduleToInstall({ composerJson: { type: 'project' }, containerPath: '/var/www/html/modules/repo' })).toBeNull();
  });
});

describe('installModule', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    execMock.mockReset();
    warn = jest.spyOn(core, 'warning').mockImplementation(() => undefined);
    jest.spyOn(core, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('runs prestashop:module install inside the container', async () => {
    execMock.mockImplementation(execPrinting('  Install action on module mymodule succeeded.  \n'));
    await expect(installModule({ composePath: '/tmp/c.yml', name: 'mymodule' })).resolves.toBe(true);
    expect(execMock).toHaveBeenCalledWith(
      'docker',
      ['compose', '-f', '/tmp/c.yml', 'exec', '-T', '-w', '/var/www/html', 'prestashop',
        'php', 'bin/console', 'prestashop:module', 'install', 'mymodule'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('treats an already installed module as success (PrestaShop upgrades it, same message)', async () => {
    execMock.mockImplementation(execPrinting('Install action on module mymodule succeeded.\n'));
    await expect(installModule({ composePath: '/tmp/c.yml', name: 'mymodule' })).resolves.toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns without throwing when the install fails, even with exit code 0', async () => {
    // PS 8.1 / 9.0 print the error and still exit 0.
    execMock.mockImplementation(execPrinting('Cannot install module mymodule. The module is invalid and cannot be loaded.\n', 0));
    await expect(installModule({ composePath: '/tmp/c.yml', name: 'mymodule' })).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/mymodule.*flashlight-install-module/s));
  });

  it('warns without throwing when docker exec itself fails', async () => {
    execMock.mockRejectedValue(new Error('no such service'));
    await expect(installModule({ composePath: '/tmp/c.yml', name: 'mymodule' })).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('refuses a module name that is not a plain folder name', async () => {
    await expect(installModule({ composePath: '/tmp/c.yml', name: '../x' })).resolves.toBe(false);
    expect(execMock).not.toHaveBeenCalled();
  });
});
