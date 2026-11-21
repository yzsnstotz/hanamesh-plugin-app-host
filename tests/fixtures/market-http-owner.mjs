// Test consumer of the normal npm public plugin entry. These HTTP protocol
// assertions follow the owning module; AppHost's retired handlers are tested
// separately. Only the public provided service's read ports are fixture doubles.
import { createServer } from 'node:net';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as market from '@hanamesh/market';
import { temporary, until } from '../helpers.mjs';

export async function marketHttpOwner(t, kind, readPorts = {}, { core, manager, allowedOrigins = ['https://market.hanamesh.com'] } = {}) {
  const root = await temporary(), ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); });
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  ctx.plugin(Storage);
  ctx.plugin(storageJson, { root: join(root, 'storage') });
  ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', { requestRejection: () => undefined });
  if (core) ctx.provide('hanameshCore', core);
  if (manager) ctx.provide('pluginManager', manager);
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  await new Promise(resolve => reservation.close(resolve));
  const outcome = Promise.withResolvers();
  const fiber=ctx.plugin({ name: market.name, inject: market.inject, async apply(child) {
    try {
      await market.apply(child, { handoff: { enabled: kind === 'handoff', ports: [port], allowedOrigins: readPorts.handoffSettings?.().allowedOrigins ?? allowedOrigins } });
      outcome.resolve(null);
    } catch (error) { outcome.resolve(error); throw error; }
  } });
  const error = await outcome.promise;
  if (error) throw error;
  Object.assign(ctx.get('hanameshMarket'), readPorts);
  return { fiber, base: `http://127.0.0.1:${kind === 'handoff' ? port : ctx.get('webServer').port}`, ctx };
}
