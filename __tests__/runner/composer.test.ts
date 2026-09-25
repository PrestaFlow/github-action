const execMock = jest.fn().mockResolvedValue(0);
jest.mock('@actions/exec', () => ({ exec: (...a: unknown[]) => execMock(...a) }));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, existsSync: jest.fn() };
});

import * as fs from 'fs';
import { runComposer } from '../../src/runner/composer';

describe('runComposer', () => {
  beforeEach(() => { execMock.mockClear(); (fs.existsSync as jest.Mock).mockReset(); });

  it('skips when execute=false', async () => {
    await runComposer({ execute: false, env: {} });
    expect(execMock).not.toHaveBeenCalled();
  });

  it('skips when composer.json missing', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    await runComposer({ execute: true, env: {} });
    expect(execMock).not.toHaveBeenCalled();
  });

  it('runs composer with env when composer.json present', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    await runComposer({ execute: true, env: { PRESTAFLOW_SUITES: 'A' } });
    expect(execMock).toHaveBeenCalledWith(
      'composer',
      ['run', 'prestaflow:json:file'],
      expect.objectContaining({
        env: expect.objectContaining({ PRESTAFLOW_SUITES: 'A' }),
      }),
    );
  });

  it('strips keys that are provided through .env.local from the child env', async () => {
    // Under variables_order=GPCS the process env lands in $_SERVER only, and
    // phpdotenv (immutable) then refuses to load the same key from .env.local:
    // the key would end up missing from $_ENV. So these keys must not be
    // inherited by the composer process.
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const orig = process.env.PRESTAFLOW_BO_EMAIL;
    process.env.PRESTAFLOW_BO_EMAIL = 'from-step-env@x';
    try {
      await runComposer({
        execute: true,
        env: { PRESTAFLOW_SUITES: 'A', PRESTAFLOW_FO_URL: 'http://x/' },
        stripEnv: ['PRESTAFLOW_BO_EMAIL', 'PRESTAFLOW_FO_URL'],
      });
    } finally {
      if (orig === undefined) delete process.env.PRESTAFLOW_BO_EMAIL; else process.env.PRESTAFLOW_BO_EMAIL = orig;
    }
    const env = execMock.mock.calls[0][2].env as Record<string, string>;
    expect(env.PRESTAFLOW_SUITES).toBe('A');
    expect(env).not.toHaveProperty('PRESTAFLOW_BO_EMAIL');
    expect(env).not.toHaveProperty('PRESTAFLOW_FO_URL');
  });
});
