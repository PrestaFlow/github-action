const listComments = jest.fn();
const updateComment = jest.fn();
const createComment = jest.fn();

const contextPr = {
  repo: { owner: 'o', repo: 'r' },
  payload: { pull_request: { number: 7 } },
  eventName: 'pull_request',
};
const contextPush = { repo: { owner: 'o', repo: 'r' }, payload: {}, eventName: 'push' };

let currentContext: typeof contextPr | typeof contextPush = contextPr;

jest.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      issues: {
        listComments: (...a: unknown[]) => listComments(...a),
        updateComment: (...a: unknown[]) => updateComment(...a),
        createComment: (...a: unknown[]) => createComment(...a),
      },
    },
  }),
  get context() { return currentContext; },
}));

import { postOrUpdatePrComment } from '../../src/reporter/pr-comment';
import { MARKER } from '../../src/reporter/pr-comment-body';

describe('postOrUpdatePrComment', () => {
  beforeEach(() => {
    listComments.mockReset(); updateComment.mockReset(); createComment.mockReset();
    currentContext = contextPr;
  });

  it('skips when not a pull_request event', async () => {
    currentContext = contextPush;
    await postOrUpdatePrComment({ token: 't', body: 'x' });
    expect(listComments).not.toHaveBeenCalled();
    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('creates comment when none exist', async () => {
    listComments.mockResolvedValue({ data: [] });
    await postOrUpdatePrComment({ token: 't', body: `${MARKER}\nhello` });
    expect(createComment).toHaveBeenCalled();
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('updates existing marker comment', async () => {
    listComments.mockResolvedValue({ data: [{ id: 99, body: `${MARKER}\nold` }] });
    await postOrUpdatePrComment({ token: 't', body: `${MARKER}\nnew` });
    expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 99, body: `${MARKER}\nnew` }));
    expect(createComment).not.toHaveBeenCalled();
  });

  it('creates when no comment has marker', async () => {
    listComments.mockResolvedValue({ data: [{ id: 1, body: 'unrelated' }] });
    await postOrUpdatePrComment({ token: 't', body: `${MARKER}\nx` });
    expect(createComment).toHaveBeenCalled();
  });

  it('warns on API error, does not throw', async () => {
    listComments.mockRejectedValue(new Error('boom'));
    await expect(postOrUpdatePrComment({ token: 't', body: 'x' })).resolves.toBeUndefined();
  });
});
