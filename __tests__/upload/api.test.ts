const postMock = jest.fn().mockResolvedValue({
  data: { id: 'r_42', url: 'https://app.prestaflow.io/reports/r_42' },
});
jest.mock('axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => postMock(...a) } }));
jest.mock('@actions/glob', () => ({
  create: async () => ({
    globGenerator: async function* () { yield '/tmp/prestaflow/results.json'; },
  }),
}));
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, statSync: () => ({ isFile: () => true }), createReadStream: () => 'STREAM' };
});

import { uploadToApi } from '../../src/upload/api';

describe('uploadToApi', () => {
  it('posts with token header and returns id/url', async () => {
    const r = await uploadToApi({ token: 't', projectId: '42' });
    expect(r).toEqual({ id: 'r_42', url: 'https://app.prestaflow.io/reports/r_42' });
    expect(postMock).toHaveBeenCalledWith(
      'https://api.prestaflow.io/ci/github-action/',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Token': 't' }),
      }),
    );
  });
});
