import * as core from '@actions/core';
import { setOutputs } from '../../src/reporter/outputs';

jest.mock('@actions/core');

describe('setOutputs', () => {
  beforeEach(() => { (core.setOutput as jest.Mock).mockClear(); });

  it('sets all outputs with status=success when failed=0', () => {
    setOutputs({
      report: { passed: 10, failed: 0, skipped: 1, todos: 0, total: 11, durationMs: 5000, failures: [] },
      reportId: 'abc',
      reportUrl: 'https://app.prestaflow.io/reports/abc',
    });
    expect(core.setOutput).toHaveBeenCalledWith('id', 'abc');
    expect(core.setOutput).toHaveBeenCalledWith('report-url', 'https://app.prestaflow.io/reports/abc');
    expect(core.setOutput).toHaveBeenCalledWith('passed', 10);
    expect(core.setOutput).toHaveBeenCalledWith('failed', 0);
    expect(core.setOutput).toHaveBeenCalledWith('skipped', 1);
    expect(core.setOutput).toHaveBeenCalledWith('total', 11);
    expect(core.setOutput).toHaveBeenCalledWith('duration-ms', 5000);
    expect(core.setOutput).toHaveBeenCalledWith('status', 'success');
  });

  it('sets status=failure when failed>0', () => {
    setOutputs({
      report: { passed: 9, failed: 1, skipped: 0, todos: 0, total: 10, durationMs: 5000, failures: [] },
      reportId: 'x', reportUrl: 'u',
    });
    expect(core.setOutput).toHaveBeenCalledWith('status', 'failure');
  });
});
