import * as net from 'net';
import { pickPort } from '../../src/flashlight/docker';

function occupy(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

function close(s: net.Server): Promise<void> {
  return new Promise(resolve => s.close(() => resolve()));
}

describe('pickPort', () => {
  it('returns first free port among candidates', async () => {
    const s = await occupy(18000);
    try {
      const port = await pickPort([18000, 18001, 18002]);
      expect(port).toBe(18001);
    } finally {
      await close(s);
    }
  });

  it('throws when all candidates busy', async () => {
    const s1 = await occupy(18010);
    const s2 = await occupy(18011);
    try {
      await expect(pickPort([18010, 18011])).rejects.toThrow(/no free port/i);
    } finally {
      await close(s1);
      await close(s2);
    }
  });
});
