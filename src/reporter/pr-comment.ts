import * as core from '@actions/core';
import * as github from '@actions/github';

export interface PostParams {
  token: string;
  body: string;
}

const MARKER_PATTERNS = ['<!-- prestaflow-run:', '<!-- prestaflow-report -->'];
const MAX_PAGES = 5;
const PER_PAGE = 100;

function isPrestaflowComment(body: string | null | undefined): boolean {
  const b = body ?? '';
  return MARKER_PATTERNS.some((p) => b.startsWith(p));
}

async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issue_number: number,
): Promise<{ id: number } | null> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.issues.listComments({
      owner, repo, issue_number, per_page: PER_PAGE, page,
    });
    const hit = data.find((c: { body?: string | null }) => isPrestaflowComment(c.body));
    if (hit) return { id: hit.id as number };
    if (data.length < PER_PAGE) return null;
  }
  return null;
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

    const existing = await findExistingComment(octokit, owner, repo, issueNumber);
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
