import { parseResults } from '../../src/reporter/parse-results';
import { readFileSync } from 'fs';
import { join } from 'path';

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures', name), 'utf-8'));

describe('parseResults', () => {
  it('parses success (single suite)', () => {
    const r = parseResults(fx('results.success.json'));
    expect(r).toEqual({
      passed: 47, failed: 0, skipped: 0, todos: 0, total: 47, durationMs: 134000, failures: [],
    });
  });

  it('parses failures with source location', () => {
    const r = parseResults(fx('results.failure.json'));
    expect(r.failed).toBe(3);
    expect(r.skipped).toBe(2);
    expect(r.total).toBe(47);
    expect(r.failures).toHaveLength(3);
    expect(r.failures[0]).toEqual({
      suite: 'BackOfficeSuite',
      title: 'Can create a simple product',
      message: 'Timeout waiting for selector `#submit_form` (30000ms)',
      file: '/repo/tests/BackOffice/Products/CreateProductTest.php',
      line: 42,
    });
  });

  it('aggregates across multiple suites', () => {
    const r = parseResults(fx('results.multi-suite.json'));
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.todos).toBe(2);
    expect(r.total).toBe(12);
    expect(r.durationMs).toBe(1500);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].suite).toBe('S1');
    expect(r.failures[0].message).toBe('e1');
  });

  it('handles missing / empty payload safely', () => {
    expect(parseResults({})).toEqual({
      passed: 0, failed: 0, skipped: 0, todos: 0, total: 0, durationMs: 0, failures: [],
    });
    expect(parseResults(null)).toEqual({
      passed: 0, failed: 0, skipped: 0, todos: 0, total: 0, durationMs: 0, failures: [],
    });
  });

  it('parses legacy single-suite payload (no envelope)', () => {
    const legacy = {
      suite: 'Legacy',
      title: 'Legacy',
      stats: { passes: 2, failures: 1, skips: 0, skippeds: 0, todos: 0, assertions: 3, time: 200 },
      tests: [
        { title: 'legacy fail', state: 'fail', expect: { fail: ['legacy msg'] }, file: '/l.php', line: 7 },
      ],
    };
    const r = parseResults(legacy);
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.total).toBe(3);
    expect(r.failures[0]).toEqual({
      suite: 'Legacy', title: 'legacy fail', message: 'legacy msg', file: '/l.php', line: 7,
    });
  });

  it('handles failing test with missing expect.fail gracefully', () => {
    const payload = {
      suites: [{
        suite: 'S', title: 't',
        stats: { passes: 0, failures: 1, skips: 0, skippeds: 0, todos: 0, assertions: 0, time: 0 },
        tests: [{ title: 'no msg', state: 'fail' }],
      }],
    };
    const r = parseResults(payload);
    expect(r.failures[0]).toEqual({ suite: 'S', title: 'no msg', message: '', file: '', line: 0 });
  });
});
