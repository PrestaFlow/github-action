import { parseInputs } from '../src/inputs';

function withInputs(map: Record<string, string>, eventName = 'push', fn: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(map)) {
    const key = `INPUT_${k.toUpperCase().replace(/-/g, '_')}`;
    originals[key] = process.env[key];
    process.env[key] = v;
  }
  const origEvent = process.env.GITHUB_EVENT_NAME;
  process.env.GITHUB_EVENT_NAME = eventName;
  try { fn(); } finally {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    if (origEvent === undefined) delete process.env.GITHUB_EVENT_NAME;
    else process.env.GITHUB_EVENT_NAME = origEvent;
  }
}

describe('parseInputs', () => {
  it('parses v1-minimal input (token + projectId)', () => {
    withInputs({ token: 'tok', projectId: '42' }, 'push', () => {
      const i = parseInputs();
      expect(i.token).toBe('tok');
      expect(i.projectId).toBe('42');
      expect(i.execute).toBe(true);
      expect(i.suites).toEqual([]);
      expect(i.flashlight).toBe(false);
      expect(i.psVersion).toBe('latest');
      expect(i.prComment).toBe(false);
      expect(i.uploadArtifacts).toBe(true);
    });
  });

  it('parses suites CSV', () => {
    withInputs({ token: 't', suites: 'BackOffice, FrontOffice' }, 'push', () => {
      expect(parseInputs().suites).toEqual(['BackOffice', 'FrontOffice']);
    });
  });

  it('defaults prComment to true in pull_request event', () => {
    withInputs({ token: 't' }, 'pull_request', () => {
      expect(parseInputs().prComment).toBe(true);
    });
  });

  it('throws when token missing', () => {
    withInputs({}, 'push', () => {
      expect(() => parseInputs()).toThrow(/token/i);
    });
  });
});
