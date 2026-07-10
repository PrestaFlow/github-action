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
});
