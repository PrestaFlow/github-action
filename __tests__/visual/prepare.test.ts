const getMock = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { get: (...a: unknown[]) => getMock(...a) } }));

const restoreCacheMock = jest.fn();
const saveCacheMock = jest.fn();
jest.mock('@actions/cache', () => ({
  restoreCache: (...a: unknown[]) => restoreCacheMock(...a),
  saveCache: (...a: unknown[]) => saveCacheMock(...a),
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prepareVisualBaselines } from '../../src/visual/prepare';

describe('prepareVisualBaselines', () => {
  let tmpDir: string;

  beforeEach(() => {
    getMock.mockReset();
    restoreCacheMock.mockReset();
    saveCacheMock.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-prepare-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('is a no-op when disabled', async () => {
    await prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: false,
      visualBaselineDir: tmpDir,
    });
    expect(getMock).not.toHaveBeenCalled();
  });

  it('warns and returns on 404', async () => {
    getMock.mockResolvedValue({ status: 404, data: {} });
    await expect(prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    })).resolves.toBeUndefined();
    expect(restoreCacheMock).not.toHaveBeenCalled();
  });

  it('warns and returns on 501', async () => {
    getMock.mockResolvedValue({ status: 501, data: {} });
    await prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    });
    expect(restoreCacheMock).not.toHaveBeenCalled();
  });

  it('throws an actionable error on other non-2xx', async () => {
    getMock.mockResolvedValue({ status: 500, data: { message: 'boom' } });
    await expect(prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    })).rejects.toThrow(/500/);
  });

  it('is a no-op when manifest has no baselines', async () => {
    getMock.mockResolvedValue({ status: 200, data: { baselines: [], manifest_sha256: 'abc' } });
    await prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    });
    expect(restoreCacheMock).not.toHaveBeenCalled();
  });

  it('skips downloads on cache hit', async () => {
    getMock.mockResolvedValueOnce({
      status: 200,
      data: {
        baselines: [
          { id: '1', name: 'home', tag: 'auto-v9', sha256: 'abc', download_url: '/ci/visual/baselines/1' },
        ],
        manifest_sha256: 'deadbeef',
      },
    });
    restoreCacheMock.mockResolvedValue('visual-baseline-p1-deadbeef');

    await prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    });

    expect(restoreCacheMock).toHaveBeenCalledWith([tmpDir], 'visual-baseline-p1-deadbeef');
    // only the manifest GET, no baseline-file GET
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).not.toHaveBeenCalled();
  });

  it('happy path: downloads files, writes them, then saves cache', async () => {
    const { Readable } = jest.requireActual('stream');

    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: {
          baselines: [
            { id: '1', name: 'home', tag: 'auto-v9', sha256: 'abc', download_url: '/ci/visual/baselines/1' },
            { id: '2', name: 'listing', tag: 'auto-v9', sha256: 'def', download_url: '/ci/visual/baselines/2' },
          ],
          manifest_sha256: 'deadbeef',
        },
      })
      .mockImplementation(async () => ({
        status: 200,
        data: Readable.from([Buffer.from('PNGDATA')]),
      }));

    restoreCacheMock.mockResolvedValue(undefined);
    saveCacheMock.mockResolvedValue(1);

    await prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      branch: 'feature/x',
      enabled: true,
      visualBaselineDir: tmpDir,
    });

    expect(getMock).toHaveBeenCalledWith(
      'https://api.test/ci/visual/baselines?branch=feature%2Fx',
      expect.objectContaining({ headers: { 'X-Api-Token': 't' } }),
    );
    expect(fs.existsSync(path.join(tmpDir, 'home--auto-v9.png'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'listing--auto-v9.png'))).toBe(true);
    expect(saveCacheMock).toHaveBeenCalledWith([tmpDir], 'visual-baseline-p1-deadbeef');
  });

  it('logs a warning and continues when one download fails', async () => {
    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: {
          baselines: [
            { id: '1', name: 'home', tag: 'auto-v9', sha256: 'abc', download_url: '/ci/visual/baselines/1' },
          ],
          manifest_sha256: 'deadbeef',
        },
      })
      .mockRejectedValueOnce(new Error('network down'));

    restoreCacheMock.mockResolvedValue(undefined);
    saveCacheMock.mockResolvedValue(1);

    await expect(prepareVisualBaselines({
      apiBaseUrl: 'https://api.test',
      token: 't',
      projectId: 'p1',
      enabled: true,
      visualBaselineDir: tmpDir,
    })).resolves.toBeUndefined();

    expect(fs.existsSync(path.join(tmpDir, 'home--auto-v9.png'))).toBe(false);
    expect(saveCacheMock).toHaveBeenCalled();
  });
});
