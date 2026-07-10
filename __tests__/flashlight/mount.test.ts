import { resolveMount } from '../../src/flashlight/mount';

describe('resolveMount', () => {
  it('module type mounts under modules/', () => {
    const r = resolveMount({
      composerJson: { name: 'prestaflow/my-module', type: 'prestashop-module' },
      workspaceBasename: 'my-module',
    });
    expect(r.containerPath).toBe('/var/www/html/modules/my-module');
    expect(r.warning).toBeUndefined();
  });

  it('theme type mounts under themes/', () => {
    const r = resolveMount({
      composerJson: { name: 'prestaflow/my-theme', type: 'prestashop-theme' },
      workspaceBasename: 'my-theme',
    });
    expect(r.containerPath).toBe('/var/www/html/themes/my-theme');
    expect(r.warning).toBeUndefined();
  });

  it('falls back to basename under modules/ when composer.json missing', () => {
    const r = resolveMount({ composerJson: null, workspaceBasename: 'weird-repo' });
    expect(r.containerPath).toBe('/var/www/html/modules/weird-repo');
    expect(r.warning).toBeTruthy();
  });

  it('falls back when type unknown', () => {
    const r = resolveMount({
      composerJson: { name: 'x/y', type: 'library' },
      workspaceBasename: 'y',
    });
    expect(r.containerPath).toBe('/var/www/html/modules/y');
    expect(r.warning).toBeTruthy();
  });

  it('uses composer name without slash', () => {
    const r = resolveMount({
      composerJson: { name: 'nosash', type: 'prestashop-module' },
      workspaceBasename: 'other',
    });
    expect(r.containerPath).toBe('/var/www/html/modules/nosash');
  });
});
