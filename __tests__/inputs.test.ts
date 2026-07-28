import { parseInputs } from '../src/inputs';

function withInputs(map: Record<string, string>, eventName = 'push', fn: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(map)) {
    // Mirror @actions/core.getInput: uppercase the name, replace spaces with '_',
    // but keep dashes verbatim — the runner sets env vars with dashes and
    // Node's process.env reads them fine.
    const key = `INPUT_${k.replace(/ /g, '_').toUpperCase()}`;
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
      expect(i.flashlightMount).toBe('auto');
      expect(i.flashlightInitScripts).toBe('');
      expect(i.prComment).toBe(false);
      expect(i.uploadArtifacts).toBe(true);
      expect(i.visual).toBe(true);
    });
  });

  it('parses visual input', () => {
    withInputs({ token: 't', visual: 'true' }, 'push', () => {
      expect(parseInputs().visual).toBe(true);
    });
    withInputs({ token: 't', visual: 'false' }, 'push', () => {
      expect(parseInputs().visual).toBe(false);
    });
    withInputs({ token: 't', visual: '' }, 'push', () => {
      expect(parseInputs().visual).toBe(true);
    });
  });

  it('parses flashlight-mount input', () => {
    withInputs({ token: 't', 'flashlight-mount': 'root' }, 'push', () => {
      expect(parseInputs().flashlightMount).toBe('root');
    });
    withInputs({ token: 't', 'flashlight-mount': 'THEMES' }, 'push', () => {
      expect(parseInputs().flashlightMount).toBe('themes');
    });
  });

  it('throws on invalid flashlight-mount', () => {
    withInputs({ token: 't', 'flashlight-mount': 'nope' }, 'push', () => {
      expect(() => parseInputs()).toThrow(/flashlight-mount/);
    });
  });

  it('parses flashlight-init-scripts input', () => {
    withInputs({ token: 't', 'flashlight-init-scripts': 'flashlight/init' }, 'push', () => {
      expect(parseInputs().flashlightInitScripts).toBe('flashlight/init');
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
