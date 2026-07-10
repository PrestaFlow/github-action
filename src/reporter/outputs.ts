import * as core from '@actions/core';
import type { TestReport } from './parse-results';

export interface OutputPayload {
  report: TestReport;
  reportId: string;
  reportUrl: string;
}

export function setOutputs(p: OutputPayload): void {
  core.setOutput('id', p.reportId);
  core.setOutput('report-url', p.reportUrl);
  core.setOutput('passed', p.report.passed);
  core.setOutput('failed', p.report.failed);
  core.setOutput('skipped', p.report.skipped);
  core.setOutput('total', p.report.total);
  core.setOutput('duration-ms', p.report.durationMs);
  core.setOutput('status', p.report.failed === 0 ? 'success' : 'failure');
}
