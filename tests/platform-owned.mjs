import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

// Windows deliberately has no owned application runtime. Exercise the actual
// public operation and persisted failure, never infer cleanup from an absent
// POSIX process query or silently skip an ownership test.
export async function assertOwnedPlatformRejection(host, request, {principal = 'host', operation = 'open'} = {}) {
  assert.equal(process.platform, 'win32');
  const before = host.instanceList(principal);
  await assert.rejects(host[operation](request, principal), {code:'PLATFORM_UNSUPPORTED'});
  const instance=await verifyOwnedPlatformRejection(host,request,{principal});
  assert.ok(before.length===0||before.some(item=>item.id===instance.id),'retry must retain the prior instance identity');
  return instance;
}

// Read back an operation already refused by the real HTTP route. No second
// tokenless request may be used to replace that failed view's authorization.
export async function verifyOwnedPlatformRejection(host,request,{principal='host'}={}){
  assert.equal(process.platform,'win32');
  const instance = host.instanceList(principal).find(item => item.appId === request.appId && item.deploymentId === request.deploymentId);
  assert.ok(instance, 'owned launch must first reserve its durable identity');
  assert.equal(instance.status, 'failed');
  assert.equal(instance.errorCode, 'PLATFORM_UNSUPPORTED');
  assert.equal(instance.pid, null); assert.equal(instance.guardianPid, null);
  assert.equal(instance.endpoint, null); assert.equal(instance.gatewayOrigin, null);
  const lease = host.list(principal).views.find(item => item.viewId === request.viewId);
  assert.equal(lease?.status, 'failed');
  const events = host.eventsSince(0, principal).events.filter(event => event.instanceId === instance.id);
  assert.ok(events.some(event => event.type === 'view.opened' && event.viewId === request.viewId));
  assert.ok(events.some(event => event.type === 'instance.failed' && event.code === 'PLATFORM_UNSUPPORTED'));
  assert.ok(!events.some(event => ['instance.starting','instance.ready','credential.injected'].includes(event.type)));
  await assert.rejects(access(instance.dataDir), {code:'ENOENT'}, 'refused ownership cannot create an application data directory');
  if (typeof host.store?.load === 'function') {
    const snapshot = await host.store.load();
    assert.equal(snapshot.instances.find(item => item.id === instance.id)?.status, 'failed');
    assert.equal(snapshot.leases.find(item => item.viewId === request.viewId && item.principalId === principal)?.status, 'failed');
    assert.ok(snapshot.events.some(event => event.type === 'instance.failed' && event.instanceId === instance.id && event.code === 'PLATFORM_UNSUPPORTED'));
  }
  assert.deepEqual(host.logTail(instance.id,50,principal), []);
  return instance;
}
