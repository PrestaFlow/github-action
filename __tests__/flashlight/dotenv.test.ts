import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  encodeDotenvValue,
  pickPrestaflowEnv,
  renderFlashlightDotenv,
  writeFlashlightDotenv,
  FLASHLIGHT_BO_EMAIL,
  FLASHLIGHT_BO_PASSWD,
} from '../../src/flashlight/dotenv';

// Minimal model of phpdotenv semantics for the lines we generate: one
// KEY=VALUE per line, later lines win (same-file keys are overwritable by
// phpdotenv's ImmutableWriter since they are not "externally defined").
function lastValues(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)=(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}

describe('encodeDotenvValue', () => {
  it('single-quotes plain values (literal, no interpolation)', () => {
    expect(encodeDotenvValue('http://localhost:8000/')).toBe(`'http://localhost:8000/'`);
    expect(encodeDotenvValue('a#b $HOME ${X}')).toBe(`'a#b $HOME \${X}'`);
  });

  it('keeps JSON intact inside single quotes', () => {
    const json = '[{"name":"a","value":"b"}]';
    expect(encodeDotenvValue(json)).toBe(`'${json}'`);
  });

  it('falls back to double quotes with escapes when value has a single quote', () => {
    expect(encodeDotenvValue(`it's "q" \\ $X`)).toBe(`"it's \\"q\\" \\\\ \\$X"`);
  });

  it('escapes newlines in double quotes', () => {
    expect(encodeDotenvValue('l1\nl2')).toBe(`"l1\\nl2"`);
  });

  it('encodes empty string', () => {
    expect(encodeDotenvValue('')).toBe(`''`);
  });
});

describe('pickPrestaflowEnv', () => {
  it('keeps only PRESTAFLOW_* keys with a defined value', () => {
    expect(pickPrestaflowEnv({
      PRESTAFLOW_BO_EMAIL: 'me@x',
      PRESTAFLOW_EMPTY: '',
      PATH: '/usr/bin',
      INPUT_TOKEN: 't',
      PRESTAFLOW_UNDEF: undefined,
    })).toEqual({ PRESTAFLOW_BO_EMAIL: 'me@x', PRESTAFLOW_EMPTY: '' });
  });
});

describe('renderFlashlightDotenv', () => {
  const base = { foUrl: 'http://localhost:8000/', psVersion: '8.1.7' };

  it('writes FO/BO URL, PS version and Flashlight BO credentials', () => {
    const v = lastValues(renderFlashlightDotenv({ ...base, userContent: null, processEnv: {} }));
    expect(v.PRESTAFLOW_FO_URL).toBe(`'http://localhost:8000/'`);
    expect(v.PRESTAFLOW_BO_URL).toBe(`'http://localhost:8000/admin-dev/'`);
    expect(v.PRESTAFLOW_PS_VERSION).toBe(`'8.1.7'`);
    expect(v.PRESTAFLOW_BO_EMAIL).toBe(`'${FLASHLIGHT_BO_EMAIL}'`);
    expect(v.PRESTAFLOW_BO_PASSWD).toBe(`'${FLASHLIGHT_BO_PASSWD}'`);
  });

  it('user file overrides Flashlight default credentials but not forced values', () => {
    const userContent = [
      'PRESTAFLOW_BO_EMAIL=me@shop.test',
      'PRESTAFLOW_BO_PASSWD=secret',
      'PRESTAFLOW_FO_URL=https://my-dev-shop.test/',
      'PRESTAFLOW_LOCALE=fr',
    ].join('\n');
    const v = lastValues(renderFlashlightDotenv({ ...base, userContent, processEnv: {} }));
    expect(v.PRESTAFLOW_BO_EMAIL).toBe('me@shop.test');
    expect(v.PRESTAFLOW_BO_PASSWD).toBe('secret');
    expect(v.PRESTAFLOW_LOCALE).toBe('fr');
    expect(v.PRESTAFLOW_FO_URL).toBe(`'http://localhost:8000/'`);
  });

  it('process env wins over everything, including forced values', () => {
    const v = lastValues(renderFlashlightDotenv({
      ...base,
      userContent: 'PRESTAFLOW_BO_EMAIL=me@shop.test',
      processEnv: {
        PRESTAFLOW_BO_EMAIL: 'env@x',
        PRESTAFLOW_BO_URL: 'http://localhost:8000/admin123/',
        PRESTAFLOW_EXTRA_HEADERS: '{"X-Test":"1"}',
      },
    }));
    expect(v.PRESTAFLOW_BO_EMAIL).toBe(`'env@x'`);
    expect(v.PRESTAFLOW_BO_URL).toBe(`'http://localhost:8000/admin123/'`);
    expect(v.PRESTAFLOW_EXTRA_HEADERS).toBe(`'{"X-Test":"1"}'`);
  });

  it('keeps user content on its own lines even without trailing newline', () => {
    const body = renderFlashlightDotenv({ ...base, userContent: 'PRESTAFLOW_LOCALE=fr', processEnv: {} });
    expect(body).toMatch(/^PRESTAFLOW_LOCALE=fr$/m);
    expect(body.endsWith('\n')).toBe(true);
  });
});

describe('writeFlashlightDotenv', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-dotenv-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const params = () => ({ workspace: dir, foUrl: 'http://localhost:8000/', psVersion: '8.1.7', processEnv: {} });

  it('merges the user .env and removes the generated .env.local on restore', () => {
    fs.writeFileSync(path.join(dir, '.env'), 'PRESTAFLOW_BO_EMAIL=me@shop.test\n');
    const h = writeFlashlightDotenv(params());
    const body = fs.readFileSync(path.join(dir, '.env.local'), 'utf-8');
    expect(lastValues(body).PRESTAFLOW_BO_EMAIL).toBe('me@shop.test');
    expect(h.keys).toEqual(expect.arrayContaining([
      'PRESTAFLOW_FO_URL', 'PRESTAFLOW_BO_URL', 'PRESTAFLOW_PS_VERSION',
      'PRESTAFLOW_BO_EMAIL', 'PRESTAFLOW_BO_PASSWD',
    ]));
    h.restore();
    expect(fs.existsSync(path.join(dir, '.env.local'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, '.env'), 'utf-8')).toBe('PRESTAFLOW_BO_EMAIL=me@shop.test\n');
  });

  it('uses an existing .env.local as the user layer (phpdotenv ignores .env then) and restores it', () => {
    fs.writeFileSync(path.join(dir, '.env'), 'PRESTAFLOW_LOCALE=de\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'PRESTAFLOW_LOCALE=fr\n');
    const h = writeFlashlightDotenv(params());
    const v = lastValues(fs.readFileSync(path.join(dir, '.env.local'), 'utf-8'));
    expect(v.PRESTAFLOW_LOCALE).toBe('fr');
    expect(v.PRESTAFLOW_FO_URL).toBe(`'http://localhost:8000/'`);
    h.restore();
    expect(fs.readFileSync(path.join(dir, '.env.local'), 'utf-8')).toBe('PRESTAFLOW_LOCALE=fr\n');
  });

  it('reports process env keys so they can be stripped from the child env', () => {
    const h = writeFlashlightDotenv({ ...params(), processEnv: { PRESTAFLOW_COOKIES: '[]', PATH: '/bin' } });
    expect(h.keys).toContain('PRESTAFLOW_COOKIES');
    expect(h.keys).not.toContain('PATH');
    h.restore();
  });
});
