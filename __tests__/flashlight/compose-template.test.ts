import { renderCompose } from '../../src/flashlight/compose-template';

describe('renderCompose', () => {
  it('renders with all placeholders substituted', () => {
    const yml = renderCompose({
      psVersion: '9.0.0',
      port: 8000,
      workspace: '/home/runner/work/x/x',
      containerPath: '/var/www/html/modules/x',
    });
    expect(yml).toContain('prestashop/prestashop-flashlight:9.0.0');
    expect(yml).toContain('"8000:80"');
    expect(yml).toContain('/home/runner/work/x/x:/var/www/html/modules/x');
    expect(yml).toContain('PS_DOMAIN: localhost:8000');
  });

  it('accepts alternative port and version', () => {
    const yml = renderCompose({
      psVersion: 'latest',
      port: 8002,
      workspace: '/w',
      containerPath: '/var/www/html/themes/t',
    });
    expect(yml).toContain('prestashop/prestashop-flashlight:latest');
    expect(yml).toContain('"8002:80"');
    expect(yml).toContain('PS_DOMAIN: localhost:8002');
    expect(yml).toContain('/w:/var/www/html/themes/t');
  });

  it('includes a MariaDB sidecar with health check and depends_on', () => {
    const yml = renderCompose({
      psVersion: '9.0.0', port: 8000,
      workspace: '/w', containerPath: '/var/www/html/modules/x',
    });
    expect(yml).toContain('mysql:');
    expect(yml).toContain('image: mariadb:lts');
    expect(yml).toContain('healthcheck.sh');
    expect(yml).toContain('MYSQL_DATABASE: prestashop');
    expect(yml).toMatch(/depends_on:\s*\n\s+mysql:\s*\n\s+condition: service_healthy/);
  });
});
