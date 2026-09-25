const execMock = jest.fn().mockResolvedValue(0);
jest.mock('@actions/exec', () => ({ exec: (...a: unknown[]) => execMock(...a) }));

import * as http from 'http';
import { AddressInfo } from 'net';
import { waitForShop, startFlashlight } from '../../src/flashlight/docker';

// Fake shop: the front answers 200 right away (as Flashlight's front does
// while post-install scripts still run); /admin-dev/ answers 503 for the
// first `adminFailures` hits, then 302 to the login page.
function fakeShop(adminFailures: number): Promise<{ url: string; hits: string[]; close: () => Promise<void> }> {
  const hits: string[] = [];
  let left = adminFailures;
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '');
    if (req.url === '/admin-dev/') {
      if (left-- > 0) { res.statusCode = 503; res.end(); return; }
      res.statusCode = 302;
      res.setHeader('Location', '/admin-dev/index.php?controller=AdminLogin');
      res.end();
      return;
    }
    res.statusCode = 200; res.end('front');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address() as AddressInfo;
    resolve({ url: `http://127.0.0.1:${port}`, hits, close: () => new Promise(r => server.close(() => r())) });
  }));
}

describe('waitForShop', () => {
  it('does not accept a 200 on / alone: waits for /admin-dev/ to redirect', async () => {
    const shop = await fakeShop(2);
    try {
      await waitForShop(shop.url, { timeoutMs: 5000, intervalMs: 20 });
      expect(shop.hits.filter(h => h === '/admin-dev/').length).toBe(3);
    } finally { await shop.close(); }
  });

  it('times out when /admin-dev/ never answers 200/302', async () => {
    const shop = await fakeShop(1_000_000);
    try {
      await expect(waitForShop(shop.url, { timeoutMs: 300, intervalMs: 20 }))
        .rejects.toThrow(/not ready after 300ms.*admin-dev/);
    } finally { await shop.close(); }
  });
});

describe('startFlashlight readiness failure', () => {
  beforeEach(() => execMock.mockClear());

  it('prints docker compose logs and tears down before failing', async () => {
    const shop = await fakeShop(1_000_000);
    const port = Number(new URL(shop.url).port);
    try {
      await expect(startFlashlight({
        composeYaml: 'services: {}\n', port, host: '127.0.0.1', readyTimeoutMs: 200, pollIntervalMs: 20,
      })).rejects.toThrow(/not ready/);
    } finally { await shop.close(); }
    const calls = execMock.mock.calls.map(c => (c[1] as string[]).join(' '));
    const logsIdx = calls.findIndex(c => /compose -f .* logs/.test(c));
    const downIdx = calls.findIndex(c => /compose -f .* down -v/.test(c));
    expect(logsIdx).toBeGreaterThan(-1);
    expect(downIdx).toBeGreaterThan(logsIdx);
  });
});
