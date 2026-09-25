const uploadArtifactMock = jest.fn().mockResolvedValue({ id: 1 });
jest.mock('@actions/artifact', () => ({
  DefaultArtifactClient: class { uploadArtifact = uploadArtifactMock; },
}));

const globMock = jest.fn();
jest.mock('@actions/glob', () => ({
  create: async () => ({ glob: async () => globMock() }),
}));

import { uploadArtifacts } from '../../src/upload/artifacts';

describe('uploadArtifacts', () => {
  beforeEach(() => {
    uploadArtifactMock.mockClear();
    globMock.mockReset();
    process.env.GITHUB_RUN_ID = '100';
    process.env.GITHUB_RUN_ATTEMPT = '2';
    process.env.GITHUB_WORKSPACE = '/w';
    process.env.GITHUB_JOB = 'e2e';
  });

  it('uploads with structured name', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    await uploadArtifacts();
    expect(uploadArtifactMock).toHaveBeenCalledWith(
      'prestaflow-report-100-2-e2e',
      ['/w/prestaflow/results.json'],
      '/w',
      expect.any(Object),
    );
  });

  it('makes the name unique per matrix leg (job, PS version, suites)', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    await uploadArtifacts({ psVersion: '8.1.7', suites: ['BackOffice', 'FrontOffice'] });
    await uploadArtifacts({ psVersion: '9.0.0', suites: ['BackOffice', 'FrontOffice'] });
    expect(uploadArtifactMock.mock.calls.map(c => c[0])).toEqual([
      'prestaflow-report-100-2-e2e-ps8.1.7-BackOffice_FrontOffice',
      'prestaflow-report-100-2-e2e-ps9.0.0-BackOffice_FrontOffice',
    ]);
  });

  it('replaces characters rejected by the artifact service', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    process.env.GITHUB_JOB = 'a/b:c';
    await uploadArtifacts({ psVersion: 'x"y', suites: [] });
    expect(uploadArtifactMock.mock.calls[0][0]).toBe('prestaflow-report-100-2-a-b-c-psx-y');
  });

  it('retries once with a random suffix when the name is taken', async () => {
    // @actions/artifact v2 has no overwrite: a second CreateArtifact with the
    // same name in the run is rejected (409 Conflict) and the upload throws.
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    uploadArtifactMock.mockRejectedValueOnce(new Error('Conflict: an artifact with this name already exists'));
    await uploadArtifacts();
    expect(uploadArtifactMock).toHaveBeenCalledTimes(2);
    expect(uploadArtifactMock.mock.calls[1][0]).toMatch(/^prestaflow-report-100-2-e2e-[0-9a-f]{6}$/);
  });

  it('skips when no files found', async () => {
    globMock.mockReturnValue([]);
    await uploadArtifacts();
    expect(uploadArtifactMock).not.toHaveBeenCalled();
  });

  it('does not throw on upload error', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    uploadArtifactMock.mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom'));
    await expect(uploadArtifacts()).resolves.toBeUndefined();
  });
});
