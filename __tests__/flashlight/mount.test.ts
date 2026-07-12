import { resolveMount } from '../../src/flashlight/mount';

describe('resolveMount', () => {
  describe("mode: 'auto'", () => {
    it('module type mounts under modules/', () => {
      const r = resolveMount({
        composerJson: { name: 'prestaflow/my-module', type: 'prestashop-module' },
        workspaceBasename: 'my-module',
        mode: 'auto',
      });
      expect(r.containerPath).toBe('/var/www/html/modules/my-module');
      expect(r.warning).toBeUndefined();
    });

    it('theme type mounts under themes/', () => {
      const r = resolveMount({
        composerJson: { name: 'prestaflow/my-theme', type: 'prestashop-theme' },
        workspaceBasename: 'my-theme',
        mode: 'auto',
      });
      expect(r.containerPath).toBe('/var/www/html/themes/my-theme');
      expect(r.warning).toBeUndefined();
    });

    it('falls back to basename under modules/ when composer.json missing', () => {
      const r = resolveMount({ composerJson: null, workspaceBasename: 'weird-repo', mode: 'auto' });
      expect(r.containerPath).toBe('/var/www/html/modules/weird-repo');
      expect(r.warning).toBeTruthy();
      expect(r.warning).toContain('flashlight-mount');
    });

    it('falls back when type unknown', () => {
      const r = resolveMount({
        composerJson: { name: 'x/y', type: 'library' },
        workspaceBasename: 'y',
        mode: 'auto',
      });
      expect(r.containerPath).toBe('/var/www/html/modules/y');
      expect(r.warning).toBeTruthy();
    });

    it('uses composer name without slash', () => {
      const r = resolveMount({
        composerJson: { name: 'nosash', type: 'prestashop-module' },
        workspaceBasename: 'other',
        mode: 'auto',
      });
      expect(r.containerPath).toBe('/var/www/html/modules/nosash');
    });
  });

  describe("mode: 'root'", () => {
    it('mounts at /var/www/html regardless of composer.json', () => {
      const r = resolveMount({
        composerJson: { name: 'x/y', type: 'prestashop-module' },
        workspaceBasename: 'y',
        mode: 'root',
      });
      expect(r.containerPath).toBe('/var/www/html');
      expect(r.warning).toBeUndefined();
    });

    it('mounts at /var/www/html even when composer.json is missing', () => {
      const r = resolveMount({ composerJson: null, workspaceBasename: 'y', mode: 'root' });
      expect(r.containerPath).toBe('/var/www/html');
      expect(r.warning).toBeUndefined();
    });
  });

  describe("mode: 'modules' (force)", () => {
    it('forces modules/<name> even if composer says theme', () => {
      const r = resolveMount({
        composerJson: { name: 'x/theme', type: 'prestashop-theme' },
        workspaceBasename: 'theme',
        mode: 'modules',
      });
      expect(r.containerPath).toBe('/var/www/html/modules/theme');
      expect(r.warning).toBeUndefined();
    });
  });

  describe("mode: 'themes' (force)", () => {
    it('forces themes/<name> even if composer says module', () => {
      const r = resolveMount({
        composerJson: { name: 'x/mod', type: 'prestashop-module' },
        workspaceBasename: 'mod',
        mode: 'themes',
      });
      expect(r.containerPath).toBe('/var/www/html/themes/mod');
      expect(r.warning).toBeUndefined();
    });
  });
});
