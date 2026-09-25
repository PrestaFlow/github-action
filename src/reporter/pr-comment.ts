import * as core from '@actions/core';
import * as github from '@actions/github';

export interface PostParams {
  token: string;
  body: string;
}

const LEGACY_MARKER = '<!-- prestaflow-report -->';
const MAX_PAGES = 5;
const PER_PAGE = 100;

// The body built by buildCommentBody starts with its marker line
// (one marker per project and PS version, see markerFor).
function firstLine(body: string | null | undefined): string {
  return (body ?? '').split('\n', 1)[0].trim();
}

async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issue_number: number,
  marker: string,
): Promise<{ id: number } | null> {
  // Exact match on the marker line: a prefix match let a project (or a matrix
  // leg) overwrite another one's comment. A non-versioned marker may still
  // take over the pre-v2 legacy comment, if no exact match exists.
  const mayAdoptLegacy = marker.startsWith('<!-- prestaflow-run:') && !marker.includes(':ps-');
  let legacy: { id: number } | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.issues.listComments({
      owner, repo, issue_number, per_page: PER_PAGE, page,
    });
    for (const c of data as Array<{ id: number; body?: string | null }>) {
      const line = firstLine(c.body);
      if (line === marker) return { id: c.id };
      if (mayAdoptLegacy && !legacy && line === LEGACY_MARKER) legacy = { id: c.id };
    }
    if (data.length < PER_PAGE) break;
  }
  return legacy;
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

    const existing = await findExistingComment(octokit, owner, repo, issueNumber, firstLine(p.body));
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
