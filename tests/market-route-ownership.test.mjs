import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as market from '@hanamesh/market';
import * as appHost from '../src/index.js';
import { createLibraryHttpHandler } from '../src/library/routes.js';
import { createHandoffHandler } from '../src/library/handoff.js';
import { temporary, until, http } from './helpers.mjs';

const website = 'https://market.hanamesh.com';
const paths = ['/hanamesh/library/install-target', '/hanamesh/library/installation-status'];

// SOURCE: normal public npm Market entry + this public AppHost bundle entry,
// real Cordis, storage and WebServer. Only connection authentication is a double.
// No sibling source/deep import, Usage provider, model, catalog or install call.
for (const order of [[market, appHost], [appHost, market]]) {
  test(`F02 composition has one route owner: ${order.map(p => p.name).join(' -> ')}`, async t => {
    const root = await temporary(), ctx = new Context(), attempts = [];
    t.after(async () => { await ctx.fiber.dispose(); });
    const profile = join(root, 'profile');
    await mkdir(profile);
    await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'route-test-profile', dependencies: {}, dsh: { profile: { bundles: [] } } }));
    ctx.plugin(Storage);
    ctx.plugin(storageJson, { root: join(root, 'storage') });
    ctx.plugin(storageDomain, { backend: 'json' });
    ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
    ctx.provide('connection', { requestRejection: () => undefined });
    await ctx.start?.();
    await until(() => ctx.get('webServer')?.port > 0);
    const origin = `http://127.0.0.1:${ctx.get('webServer').port}`, fibers = new Map();
    for (const plugin of order) {
      const outcome = Promise.withResolvers();
      const fiber = ctx.plugin({
        name: plugin.name, inject: plugin.inject,
        async apply(child) {
          const server = child.get('webServer');
          const observed = new Proxy(server, { get(target, key) {
            if (key === 'register') return route => {
              attempts.push({ owner: plugin.name, kind: route.kind, path: route.path });
              return target.register(route);
            };
            return Reflect.get(target, key, target);
          } });
          const activation = new Proxy(child, { get(target, key) {
            if (key === 'webServer') return observed;
            if (key === 'get') return name => name === 'webServer' ? observed : target.get(name);
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          } });
          try {
            await plugin.apply(activation, plugin === market ? { handoff: { enabled: false } } : {
              nodeBinary: process.execPath, dataRoot: join(root, 'apps'), applications: [],
              library: { profileDir: profile, profileName: 'desktop', sources: [], handoff: { enabled: false } },
            });
            outcome.resolve(null);
          } catch (error) { outcome.resolve(error); throw error; }
        },
      });
      fibers.set(plugin.name, fiber);
      assert.equal(await outcome.promise, null, `${plugin.name} must activate in the actual combination`);
    }
    assert.ok(ctx.get('hanameshApps'), 'AppHost runtime must activate');
    assert.ok(ctx.get('hanameshMarket'), 'Market must activate');
    assert.equal(ctx.get('hanameshUsage'), undefined, 'missing optional Usage does not block startup');
    const identities = attempts.map(row => JSON.stringify([row.kind, row.path]));
    assert.equal(new Set(identities).size, identities.length, 'every actual registration in this composition must be unique');
    for (const path of paths) {
      assert.deepEqual(attempts.filter(row => row.path === path), [{ owner: 'hanamesh-market', kind: 'exact', path }]);
    }
    const probe = await http(origin + paths[0], { headers: { origin: website } });
    assert.equal(probe.status, 200);
    assert.equal(probe.json.installationStatus?.contract, 'hanamesh.installation-status');
    const denied = await http(origin + paths[1], { method: 'POST', headers: { origin: website, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403);
    assert.equal(denied.json.error.code, 'INSTALLATION_STATUS_CONSENT_REQUIRED');
    await fibers.get(appHost.name).dispose();
    assert.equal((await http(origin + paths[0], { headers: { origin: website } })).status, 200, 'AppHost disposal cannot remove Market ownership');
    await fibers.get(market.name).dispose();
    for (const path of paths) assert.equal((await http(origin + path)).status, 404, 'no fallback owner after Market unload');
  });
}

for (const kind of ['host', 'handoff']) {
  test(`F02 AppHost ${kind} never serves Market routes, including standalone`, async t => {
    let origin, reads = 0;
    let settingsReads = 0, authReads = 0;
    const authenticate = () => { authReads++; return { principalId: 'route-test' }; };
    const authorize = () => { authReads++; return true; };
    const library = {
      installTarget: () => { reads++; return { client: 'dsh', ready: false }; },
      installationStatus: async () => { reads++; return { schemaVersion: 1, client: 'dsh', observations: [] }; },
      handoffSettings: () => { settingsReads++; return { allowedOrigins: [website] }; },
    };
    const server = createServer((req, res) => (kind === 'host'
      ? createLibraryHttpHandler(library, { parentOrigin: origin, authenticate, authorize })
      : createHandoffHandler({ library, queue: {}, settings: library.handoffSettings, port: () => new URL(origin).port }))(req, res));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    for (const path of paths) for (const method of ['GET', 'POST', 'OPTIONS']) {
      const response = await http(origin + path, { method, headers: { origin: website, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{"contractVersion":"1","consent":"read-installations"}' } : {}) });
      assert.equal(response.status, 404, `${method} ${path} has no AppHost owner`);
      assert.equal(response.headers['access-control-allow-origin'], undefined);
      assert.equal(reads, 0);
      assert.equal(settingsReads, 0);
      assert.equal(authReads, 0);
    }
  });
}
