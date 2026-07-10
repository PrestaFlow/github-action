import { suitesEnv } from '../../src/runner/suites';

describe('suitesEnv', () => {
  it('returns empty object for empty list', () => {
    expect(suitesEnv([])).toEqual({});
  });

  it('joins suites with comma', () => {
    expect(suitesEnv(['BackOffice', 'FrontOffice'])).toEqual({
      PRESTAFLOW_SUITES: 'BackOffice,FrontOffice',
    });
  });

  it('single suite', () => {
    expect(suitesEnv(['Only'])).toEqual({ PRESTAFLOW_SUITES: 'Only' });
  });
});
