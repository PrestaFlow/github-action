export interface Failure {
  suite: string;
  title: string;
  message: string;
  file: string;
  line: number;
}

export interface SuiteStats {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface TestReport {
  passed: number;
  failed: number;
  skipped: number;
  todos: number;
  total: number;
  durationMs: number;
  failures: Failure[];
  suites: SuiteStats[];
}

interface SuiteResult {
  suite?: string;
  stats?: Record<string, unknown>;
  tests?: unknown[];
}

const empty = (): TestReport => ({
  passed: 0, failed: 0, skipped: 0, todos: 0, total: 0, durationMs: 0, failures: [], suites: [],
});

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function extractFailure(suiteName: string, test: unknown): Failure | null {
  const t = (test ?? {}) as Record<string, unknown>;
  if (t.state !== 'fail') return null;
  const expect = (t.expect ?? {}) as Record<string, unknown>;
  const failArr = Array.isArray(expect.fail) ? (expect.fail as unknown[]) : [];
  return {
    suite: suiteName,
    title: String(t.title ?? ''),
    message: failArr.length ? String(failArr[0]) : '',
    file: String(t.file ?? ''),
    line: num(t.line),
  };
}

function accumulateSuite(report: TestReport, suite: SuiteResult): void {
  const stats = (suite.stats ?? {}) as Record<string, unknown>;
  const passed = num(stats.passes);
  const failed = num(stats.failures);
  const skipped = num(stats.skips) + num(stats.skippeds);
  const todos = num(stats.todos);
  const durationMs = num(stats.time);

  report.passed += passed;
  report.failed += failed;
  report.skipped += skipped;
  report.todos += todos;
  report.durationMs += durationMs;

  const suiteName = String(suite.suite ?? '');
  report.suites.push({ name: suiteName, passed, failed, skipped, durationMs });

  const tests = Array.isArray(suite.tests) ? suite.tests : [];
  for (const t of tests) {
    const f = extractFailure(suiteName, t);
    if (f) report.failures.push(f);
  }
}

export function parseResults(raw: unknown): TestReport {
  const report = empty();
  if (!raw || typeof raw !== 'object') return report;

  const payload = raw as Record<string, unknown>;

  if (Array.isArray(payload.suites)) {
    for (const s of payload.suites as SuiteResult[]) {
      accumulateSuite(report, s ?? {});
    }
  } else if (payload.stats) {
    // Legacy single-suite payload
    accumulateSuite(report, payload as SuiteResult);
  }

  report.total = report.passed + report.failed + report.skipped + report.todos;
  return report;
}
