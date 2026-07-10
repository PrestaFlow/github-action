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
  });

  it('uploads with structured name', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    await uploadArtifacts();
    expect(uploadArtifactMock).toHaveBeenCalledWith(
      'prestaflow-report-100-2',
      ['/w/prestaflow/results.json'],
      '/w',
      expect.any(Object),
    );
  });

  it('skips when no files found', async () => {
    globMock.mockReturnValue([]);
    await uploadArtifacts();
    expect(uploadArtifactMock).not.toHaveBeenCalled();
  });

  it('does not throw on upload error', async () => {
    globMock.mockReturnValue(['/w/prestaflow/results.json']);
    uploadArtifactMock.mockRejectedValueOnce(new Error('boom'));
    await expect(uploadArtifacts()).resolves.toBeUndefined();
  });
});
