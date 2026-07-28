const postMock = jest.fn().mockResolvedValue({
  data: { id: 'r_42', url: 'https://app.prestaflow.io/reports/r_42' },
});
jest.mock('axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => postMock(...a) } }));

let globFiles: string[] = ['/tmp/prestaflow/results.json'];
jest.mock('@actions/glob', () => ({
  create: async () => ({
    globGenerator: async function* () { for (const f of globFiles) yield f; },
  }),
}));

const appendedNames: string[] = [];
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: (field: string, _value: unknown, name?: string) => {
      if (field === 'file[]') appendedNames.push(String(name));
    },
    getHeaders: () => ({ 'content-type': 'multipart/form-data' }),
  }));
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, statSync: () => ({ isFile: () => true }), createReadStream: () => 'STREAM' };
});

import { uploadToApi } from '../../src/upload/api';

describe('uploadToApi', () => {
  beforeEach(() => {
    globFiles = ['/tmp/prestaflow/results.json'];
    appendedNames.length = 0;
    postMock.mockClear();
  });

  it('posts with token header and returns id/url', async () => {
    const r = await uploadToApi({ token: 't', projectId: '42' });
    expect(r).toEqual({ id: 'r_42', url: 'https://app.prestaflow.io/reports/r_42' });
    expect(postMock).toHaveBeenCalledWith(
      'https://api.prestaflow.io/ci/github-action',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Token': 't' }),
      }),
    );
  });

  it('maps results.json and errors screenshots to unchanged names', async () => {
    globFiles = [
      '/tmp/prestaflow/results.json',
      '/tmp/prestaflow/screens/errors/foo.png',
    ];
    await uploadToApi({ token: 't', projectId: '42' });
    expect(appendedNames).toEqual(['results.json', 'screens/foo.png']);
  });

  it('maps screens/actual and screens/diff to visual/actual and visual/diff', async () => {
    globFiles = [
      '/tmp/prestaflow/screens/actual/foo.png',
      '/tmp/prestaflow/screens/diff/foo.png',
    ];
    await uploadToApi({ token: 't', projectId: '42' });
    expect(appendedNames).toEqual(['visual/actual/foo.png', 'visual/diff/foo.png']);
  });
});
