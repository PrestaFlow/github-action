import { buildCommentBody, MARKER } from '../../src/reporter/pr-comment-body';

const baseReport = { passed: 10, failed: 0, skipped: 0, todos: 0, total: 10, durationMs: 60000, failures: [], suites: [] };

describe('buildCommentBody', () => {
  it('always starts with marker', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'u', suites: [], psVersion: null, sha: 'abc123def', projectKey: '' });
    expect(body.startsWith(MARKER)).toBe(true);
  });

  it('omits the "View full report" link when reportUrl is empty', () => {
    const success = buildCommentBody({ report: baseReport, reportUrl: '', suites: [], psVersion: null, sha: 'abc', projectKey: '' });
    expect(success).not.toMatch(/View full report/);
    expect(success).not.toMatch(/\[View full report\]\(\)/);

    const failure = buildCommentBody({
      report: { ...baseReport, passed: 0, failed: 1, total: 1, failures: [{ suite: 'S', title: 'T', message: 'm', file: 'f', line: 1 }] },
      reportUrl: '', suites: [], psVersion: null, sha: 'abc', projectKey: '',
    });
    expect(failure).not.toMatch(/View full report/);
  });

  it('short form on success', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'https://x', suites: ['BackOffice'], psVersion: '9.0.0', sha: 'abc123def', projectKey: '' });
    expect(body).toMatch(/10 tests passed/);
    expect(body).not.toMatch(/<details>/);
    expect(body).toMatch(/BackOffice/);
    expect(body).toMatch(/PS `9.0.0`/);
    expect(body).toMatch(/https:\/\/x/);
    expect(body).toMatch(/`abc123d`/);
  });

  it('omits suites and psVersion when absent', () => {
    const body = buildCommentBody({ report: baseReport, reportUrl: 'u', suites: [], psVersion: null, sha: 'a', projectKey: '' });
    expect(body).not.toMatch(/Suites:/);
    expect(body).not.toMatch(/PS `/);
  });

  it('failure form with table and details', () => {
    const failures = Array.from({ length: 3 }, (_, i) => ({
      suite: `S${i}`, title: `T${i}`, message: `msg ${i}`, file: `f${i}.php`, line: i + 1,
    }));
    const body = buildCommentBody({
      report: { ...baseReport, passed: 7, failed: 3, total: 10, failures },
      reportUrl: 'u', suites: [], psVersion: null, sha: 'abcdefg', projectKey: '',
    });
    expect(body).toMatch(/3 failures out of 10 tests/);
    expect(body).toMatch(/<details>/);
    expect(body).toMatch(/S0 \/ T0/);
    expect(body).toMatch(/f0\.php:1/);
  });
});

describe('per-suite table', () => {
  it('renders when more than one suite is present', () => {
    const body = buildCommentBody({
      report: {
        passed: 24, failed: 0, skipped: 0, todos: 0, total: 24, durationMs: 42000, failures: [],
        suites: [
          { name: 'BackOffice',  passed: 12, failed: 0, skipped: 0, durationMs: 18000 },
          { name: 'FrontOffice', passed: 12, failed: 0, skipped: 0, durationMs: 24000 },
        ],
      },
      reportUrl: 'https://prestaflow.io/orgs/a/projects/b/runs/342',
      suites: [], psVersion: null, sha: 'abc1234', projectKey: 'pk_01ABC',
    });
    expect(body).toContain('<!-- prestaflow-run:pk_01ABC -->');
    expect(body).toContain('| BackOffice');
    expect(body).toContain('| FrontOffice');
  });

  it('does not render per-suite table with a single suite', () => {
    const body = buildCommentBody({
      report: {
        passed: 5, failed: 0, skipped: 0, todos: 0, total: 5, durationMs: 5000, failures: [],
        suites: [{ name: 'BackOffice', passed: 5, failed: 0, skipped: 0, durationMs: 5000 }],
      },
      reportUrl: '', suites: [], psVersion: null, sha: 'a', projectKey: 'pk_01ABC',
    });
    expect(body).not.toContain('| Suite ');
  });
});

describe('failure details cap', () => {
  it('caps at 20 with a "+N more" footer when there are more failed tests', () => {
    const failures = Array.from({ length: 25 }, (_, i) => ({
      suite: 'FO', title: `t${i}`, message: `msg${i}`, file: '', line: 0,
    }));
    const body = buildCommentBody({
      report: {
        passed: 0, failed: 25, skipped: 0, todos: 0, total: 25, durationMs: 1000,
        failures, suites: [],
      },
      reportUrl: '', suites: [], psVersion: null, sha: 'a', projectKey: 'pk_01ABC',
    });
    expect(body).toContain('t19');
    expect(body).not.toContain('t20');
    expect(body).toContain('+5 more failed');
  });

  it('truncates long messages to 200 chars', () => {
    const long = 'x'.repeat(500);
    const body = buildCommentBody({
      report: {
        passed: 0, failed: 1, skipped: 0, todos: 0, total: 1, durationMs: 1,
        failures: [{ suite: 'FO', title: 't', message: long, file: '', line: 0 }],
        suites: [],
      },
      reportUrl: '', suites: [], psVersion: null, sha: 'a', projectKey: 'pk_01ABC',
    });
    expect(body).toContain('x'.repeat(200) + '…');
    expect(body).not.toContain('x'.repeat(201));
  });
});

describe('marker', () => {
  it('uses project-scoped marker when projectKey is set', () => {
    const body = buildCommentBody({
      report: {
        passed: 1, failed: 0, skipped: 0, todos: 0, total: 1, durationMs: 1,
        failures: [], suites: [],
      },
      reportUrl: '', suites: [], psVersion: null, sha: 'a', projectKey: 'pk_01ABC',
    });
    expect(body.startsWith('<!-- prestaflow-run:pk_01ABC -->')).toBe(true);
  });

  it('falls back to legacy marker when projectKey is empty', () => {
    const body = buildCommentBody({
      report: {
        passed: 1, failed: 0, skipped: 0, todos: 0, total: 1, durationMs: 1,
        failures: [], suites: [],
      },
      reportUrl: '', suites: [], psVersion: null, sha: 'a', projectKey: '',
    });
    expect(body.startsWith('<!-- prestaflow-report -->')).toBe(true);
  });
});
