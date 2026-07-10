export function suitesEnv(suites: string[]): Record<string, string> {
  return suites.length ? { PRESTAFLOW_SUITES: suites.join(',') } : {};
}
