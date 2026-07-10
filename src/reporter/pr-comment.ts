import * as core from '@actions/core';
import * as github from '@actions/github';
import { MARKER } from './pr-comment-body';

export interface PostParams {
  token: string;
  body: string;
}

export async function postOrUpdatePrComment(p: PostParams): Promise<void> {
  try {
    const ctx = github.context;
    if (ctx.eventName !== 'pull_request' || !ctx.payload.pull_request) {
      core.info('Not a pull_request event — skipping PR comment.');
      return;
    }
    const issueNumber = ctx.payload.pull_request.number as number;
    const { owner, repo } = ctx.repo;
    const octokit = github.getOctokit(p.token);

    const { data: comments } = await octokit.rest.issues.listComments({
      owner, repo, issue_number: issueNumber, per_page: 100,
    });

    const existing = comments.find((c: { body?: string | null }) => (c.body ?? '').includes(MARKER));
    if (existing) {
      await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: p.body });
      core.info(`Updated PR comment #${existing.id}`);
    } else {
      await octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: p.body });
      core.info('Created PR comment');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    core.warning(`Failed to post PR comment: ${msg}`);
  }
}
