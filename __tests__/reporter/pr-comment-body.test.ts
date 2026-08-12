import { buildCommentBody, MARKER } from '../../src/reporter/pr-comment-body';

const baseReport = { passed: 10, failed: 0, skipped: 0, todos: 0, total: 10, durationMs: 60000, failures: [], suites: [] };

describe('buildCommentBody', () => {
  it('always starts with marker', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'u', suites: [], psVersion: null, sha: 'abc123def' });
    expect(body.startsWith(MARKER)).toBe(true);
  });

  it('omits the "View full report" link when reportUrl is empty', () => {
    const success = buildCommentBody({ report: baseReport, reportUrl: '', suites: [], psVersion: null, sha: 'abc' });
    expect(success).not.toMatch(/View full report/);
    expect(success).not.toMatch(/\[View full report\]\(\)/);

    const failure = buildCommentBody({
      report: { ...baseReport, passed: 0, failed: 1, total: 1, failures: [{ suite: 'S', title: 'T', message: 'm', file: 'f', line: 1 }] },
      reportUrl: '', suites: [], psVersion: null, sha: 'abc',
    });
    expect(failure).not.toMatch(/View full report/);
  });

  it('short form on success', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'https://x', suites: ['BackOffice'], psVersion: '9.0.0', sha: 'abc123def' });
    expect(body).toMatch(/10 tests passed/);
    expect(body).not.toMatch(/<details>/);
    expect(body).toMatch(/BackOffice/);
    expect(body).toMatch(/PS `9.0.0`/);
    expect(body).toMatch(/https:\/\/x/);
    expect(body).toMatch(/`abc123d`/);
  });

  it('omits suites and psVersion when absent', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'u', suites: [], psVersion: null, sha: 'a' });
    expect(body).not.toMatch(/Suites:/);
    expect(body).not.toMatch(/PS `/);
  });

  it('failure form with table and details', () => {
    const failures = Array.from({ length: 3 }, (_, i) => ({
      suite: `S${i}`, title: `T${i}`, message: `msg ${i}`, file: `f${i}.php`, line: i + 1,
    }));
    const body = buildCommentBody({
      report: { ...baseReport, passed: 7, failed: 3, total: 10, failures },
      reportUrl: 'u', suites: [], psVersion: null, sha: 'abcdefg',
    });
    expect(body).toMatch(/3 failures out of 10 tests/);
    expect(body).toMatch(/<details>/);
    expect(body).toMatch(/S0 \/ T0/);
    expect(body).toMatch(/f0\.php:1/);
  });

  it('truncates over 10 failures', () => {
    const failures = Array.from({ length: 15 }, (_, i) => ({
      suite: `S${i}`, title: `T${i}`, message: 'm', file: 'f.php', line: 1,
    }));
    const body = buildCommentBody({
      report: { ...baseReport, failed: 15, failures },
      reportUrl: 'u', suites: [], psVersion: null, sha: 'a',
    });
    expect(body).toMatch(/…and 5 more/);
    expect((body.match(/\*\*❌/g) ?? []).length).toBe(10);
  });
});
