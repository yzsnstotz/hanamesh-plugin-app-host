import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as storageJson from '@deepseek-ai/dsh-storage-json';
import * as storageDomain from '@deepseek-ai/dsh-storage-domain';
import WebServer from '@deepseek-ai/dsh-host-webserver';
import * as bundle from '../src/index.js';
import { temporary, until, http } from './helpers.mjs';

test('AH-ACT01: failed public bundle activation releases routes before the host can be advertised ready', async t => {
  // SOURCE: real Cordis/storage/WebServer, AUTH_DOUBLE, one storage-port fault.
  // No application/CLI/native process is launched and no private plugin ref is read.
  const root = await temporary(), ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }); });
  ctx.plugin(Storage);
  ctx.plugin(storageJson, { root: join(root, 'storage') });
  ctx.plugin(storageDomain, { backend: 'json' });
  ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 });
  ctx.provide('connection', { requestRejection: request => request.headers.authorization === 'Bearer activation-test' ? undefined : { status: 401 } });
  await ctx.start?.();
  await until(() => ctx.get('webServer')?.port > 0);
  const origin = `http://127.0.0.1:${ctx.get('webServer').port}`;
  const facility = ctx.get('storageDomain'), opened = [];
  const failure = Object.assign(new Error('Library domain could not be opened.'), { code: 'ACTIVATION_STORAGE_UNAVAILABLE' });
  const storagePort = { async open(spec) {
    opened.push(spec.name);
    if (spec.name === 'hanamesh_library') throw failure;
    return await facility.open(spec);
  } };
  const outcome = Promise.withResolvers();
  ctx.plugin({
    name: 'app-host-activation-port-fault', inject: bundle.inject,
    async apply(pluginContext) {
      const activation = new Proxy(pluginContext, { get(target, key) {
        if (key === 'get') return name => name === 'storageDomain' ? storagePort : target.get(name);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
      try {
        await bundle.apply(activation, { dataRoot: join(root, 'apps'), applications: [], library: { sources: [] } });
        outcome.resolve(null);
      } catch (error) {
        outcome.resolve(error);
        throw error;
      }
    },
  });
  assert.equal(await outcome.promise, failure, 'normal Cordis plugin activation must preserve the actual failure');
  assert.ok(opened.includes('hanamesh_library'), 'reach the intended failure after earlier public resources were acquired');
  assert.equal(ctx.get('hanameshApps'), undefined, 'a failed activation must not publish the host seat');
  const response = await http(origin + '/hanamesh/apps', { headers: { origin, authorization: 'Bearer activation-test' } });
  t.diagnostic(`SOURCE failed activation route status=${response.status}; no native CLIENT/U2 evidence`);
  assert.equal(response.status, 404, 'failed activation must remove its earlier routes immediately, without waiting for whole-host shutdown');
});
