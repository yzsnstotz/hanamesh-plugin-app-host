import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { AppHostError, requireCondition, SerialQueue, copy } from './errors.js';
import { validateDefinition, identifier, fingerprint, expand, loopbackOrigin } from './descriptor.js';
import { secureDirectory } from './store.js';
import { freePort, spawnOwned, waitReady } from './runtime.js';
import { FixedGateway, ancestorOrigin } from './gateway.js';
import { reserveBeforeLaunch, stopBeforePublish } from './consistency.js';

const hash = token => createHash('sha256').update(token).digest('hex');
const leaseKey = (principalId, viewId, generation) => JSON.stringify([principalId, viewId, generation]);
const active = (lease, now) => lease.status === 'active' && lease.expiresAt > now;
const publicLease = lease => {
  const { tokenHash, ...visible } = copy(lease);
  return visible;
};
const publicInstance = instance => copy(instance);
const isTerminal = s => ['stopped','failed','interrupted'].includes(s);

/** Sole owner of instance records and view leases. No session-log mutation. */
export class AppHost {
  #queue = new SerialQueue(); #definitions = new Map(); #controls = new Map(); #listeners = new Set();
  #logs = new Map(); #state; #initialized = false; #closing = false; #poisoned = false; #timer; #disposing;
  #credentialResolver = null; #nodeBinary; #runtimeLedgerReader;
  constructor({ store, dataRoot, parentOrigin, frameAncestors = [], leaseTtlMs = 90_000, sweepIntervalMs = 15_000,
    checkpoint = async () => {}, clock = () => Date.now(), credentialResolver = null, nodeBinary,
    runtimeLedgerReader = async root => (await import('./provision/index.js')).ledger(root) }) {
    requireCondition(store && ['init','load','save','close'].every(k => typeof store[k] === 'function'),
      'INVALID_STORE','A durable snapshot store is required.');
    requireCondition(typeof dataRoot === 'string' && resolve(dataRoot) === dataRoot,'INVALID_ROOT','dataRoot must be an absolute canonical path.');
    requireCondition(Number.isSafeInteger(leaseTtlMs) && leaseTtlMs >= 100 && leaseTtlMs <= 3_600_000 &&
      Number.isSafeInteger(sweepIntervalMs) && sweepIntervalMs >= 0 && sweepIntervalMs <= 3_600_000,
      'INVALID_TIMEOUT','Invalid lease or sweep timing.');
    this.store = store; this.dataRoot = dataRoot; this.parentOrigin = loopbackOrigin(parentOrigin); this.frameAncestors = frameAncestors.map(ancestorOrigin);
    this.leaseTtlMs = leaseTtlMs; this.sweepIntervalMs = sweepIntervalMs; this.checkpoint = checkpoint; this.clock = clock;
    this.#nodeBinary = nodeBinary;
    requireCondition(typeof runtimeLedgerReader === 'function','INVALID_RUNTIME','runtimeLedgerReader must be a function.');
    this.#runtimeLedgerReader = runtimeLedgerReader;
    this.setCredentialResolver(credentialResolver);
  }
  /** rc.4: the credential broker (plugin-auth-apikey) seats itself here; null = inject nothing (FR-02: apps still start). */
  setCredentialResolver(resolver) {
    requireCondition(resolver === null || resolver === undefined || typeof resolver === 'function','INVALID_CREDENTIAL_RESOLVER','credentialResolver must be a function or null.');
    this.#credentialResolver = resolver ?? null;
    return () => { if (this.#credentialResolver === resolver) this.#credentialResolver = null; };
  }
  /** Ask the broker for this launch. Only declared names/paths pass; any failure is recorded and never blocks the launch. */
  async #resolveCredentials(instance,deployment) {
    const declared = deployment.credentialEnv ?? [], events = [];
    if (!this.#credentialResolver || declared.length === 0) return { env:{}, files:[], secrets:[], events, envNames:[] };
    const envNames = new Set(declared.filter(c => c.projection === 'env').map(c => c.env));
    const fileBases = new Map(declared.filter(c => c.projection === 'file').map(c => [c.path, c.base ?? 'home']));
    let result;
    try {
      result = await this.#credentialResolver({ appId:instance.appId, deploymentId:instance.deploymentId, instanceId:instance.id,
        principalId:instance.principalId, credentialEnv:copy(declared) });
    } catch (error) {
      events.push({ type:'credential.resolver-failed', details:{ code:error?.code ?? 'RESOLVER_ERROR' } });
      return { env:{}, files:[], secrets:[], events, envNames:[] };
    }
    if (!result || typeof result !== 'object') return { env:{}, files:[], secrets:[], events, envNames:[] };
    const env = {}, rejected = [];
    for (const [key,value] of Object.entries(result.env ?? {})) {
      if (envNames.has(key) && typeof value === 'string' && !value.includes('\0')) env[key] = value; else rejected.push(key);
    }
    const files = [];
    for (const f of Array.isArray(result.files) ? result.files : []) {
      const policy = f?.policy ?? 'if-absent';
      if (f && fileBases.has(f.path) && ['if-absent','overwrite','remove'].includes(policy) && (policy === 'remove' || typeof f.content === 'string'))
        files.push({ path:f.path, base:fileBases.get(f.path), content:policy === 'remove' ? '' : f.content, mode:Number.isInteger(f.mode) ? f.mode : 0o600, policy });
      else rejected.push(`file:${f?.path}`);
    }
    if (rejected.length) events.push({ type:'credential.env-rejected', details:{ names:rejected } });
    const secrets = [...Object.values(env), ...files.filter(f => f.policy !== 'remove').map(f => f.content), ...(Array.isArray(result.secrets) ? result.secrets.filter(x => typeof x === 'string') : [])];
    return { env, files, secrets, events, envNames:Object.keys(env) };
  }
  register(definition) {
    requireCondition(!this.#closing,'HOST_CLOSED','Host is closing.');
    const d = validateDefinition(definition);
    requireCondition(!this.#definitions.has(d.id),'DUPLICATE_APP','An app definition cannot be replaced in a running host.');
    this.#definitions.set(d.id,d);
    return { appId:d.id, definitionHash:fingerprint(d) };
  }
  async init() {
    requireCondition(!this.#initialized,'ALREADY_INITIALIZED','Host is already initialized.');
    await secureDirectory(this.dataRoot); await this.store.init();
    try {
      this.#state = await this.store.load();
      const next = copy(this.#state); let changed = false;
      // A persisted ready bit is not proof of a live endpoint. Resume keeps the slot
      // and data identity, but creates a new runtime ID after guardian cleanup.
      for (const instance of next.instances) {
        if (!isTerminal(instance.status)) {
          instance.status = 'interrupted'; instance.endpoint = null; instance.gatewayOrigin = null;
          instance.updatedAt = this.clock(); changed = true;
          this.#event(next,'instance.interrupted',instance,{ reason:'host-restart' });
        }
      }
      for (const lease of next.leases) if (lease.status === 'active' && lease.expiresAt <= this.clock()) {
        lease.status = 'expired'; changed = true;
      }
      if (changed) await this.#commit(next);
      this.#initialized = true;
      if (this.sweepIntervalMs > 0) {
        this.#timer = setInterval(() => { this.sweepLeases().catch(error => {
          this.#notify({ type:'host.error', code:error.code ?? 'SWEEP_FAILED' });
        }); },this.sweepIntervalMs);
        this.#timer.unref();
      }
      return this;
    } catch (error) { await this.store.close().catch(() => {}); throw error; }
  }
  #assertOpen() {
    requireCondition(this.#initialized && !this.#closing,'HOST_CLOSED','Host is not open.',{},503);
    requireCondition(!this.#poisoned,'STORAGE_FAILED','Storage outcome is uncertain; restart before performing mutations.',{},503);
  }
  #event(state,type,instance,details = {}) {
    const event = { sequence:++state.sequence, at:this.clock(), type, instanceId:instance.id,
      principalId:instance.principalId,...details };
    state.events.push(event); if (state.events.length > 1_024) state.events.splice(0,state.events.length-1_024);
    return event;
  }
  #notify(event) { for (const listener of this.#listeners) { try { listener(copy(event)); } catch {} } }
  async #commit(next) {
    next.revision = this.#state.revision + 1;
    const oldSequence = this.#state.sequence;
    try { await this.store.save(next); }
    catch (error) { if (error.code === 'COMMIT_UNCERTAIN') this.#poisoned = true; throw error; }
    this.#state = next;
    for (const event of next.events) if (event.sequence > oldSequence) this.#notify(event);
  }
  #findLease(state,principalId,viewId) { return state.leases.find(l => l.principalId === principalId && l.viewId === viewId); }
  #checkToken(lease,token) {
    requireCondition(lease && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) &&
      timingSafeEqual(Buffer.from(hash(token),'hex'), Buffer.from(lease?.tokenHash ?? '0'.repeat(64),'hex')),
      'LEASE_NOT_OWNED','Unknown, stale, or unauthorized view lease.',{},403);
  }
  #activeFor(state,id) { return state.leases.filter(l => l.instanceId === id && active(l,this.clock())); }
  #definition(appId,deploymentId) {
    const app = this.#definitions.get(identifier(appId,'appId'));
    requireCondition(app,'APP_NOT_REGISTERED','Application is not registered.',{},404);
    const deployment = app.deployments.find(d => d.id === identifier(deploymentId,'deploymentId'));
    requireCondition(deployment,'DEPLOYMENT_NOT_REGISTERED','Deployment is not registered.',{},404);
    return { app, deployment };
  }
  #validateRequest(input,allowed) {
    requireCondition(input && typeof input === 'object' && !Array.isArray(input),'INVALID_REQUEST','Expected an object.');
    const forbidden = Object.keys(input).filter(key => !allowed.includes(key));
    requireCondition(!forbidden.length,'UNKNOWN_FIELDS','Only registered identifiers and lease fields are accepted.',{ fields:forbidden });
  }
  async #prepareOpen(input,principalId = 'host') {
    this.#validateRequest(input,['appId','deploymentId','viewId','leaseToken','instanceId','originalSessionId']);
    identifier(principalId,'principalId'); identifier(input.viewId,'viewId');
    if (input.originalSessionId !== undefined) requireCondition(typeof input.originalSessionId === 'string' &&
      input.originalSessionId.length > 0 && input.originalSessionId.length <= 256,'INVALID_REQUEST','Invalid original application session identity.');
    const { app, deployment } = this.#definition(input.appId,input.deploymentId);
    const prepared = await this.#queue.run(async () => {
      this.#assertOpen();
      let next = copy(this.#state), lease = this.#findLease(next,principalId,input.viewId), instance;
      let token = input.leaseToken;
      if (lease) {
        this.#checkToken(lease,token);
        instance = next.instances.find(i => i.id === lease.instanceId);
        requireCondition(instance && instance.appId === app.id && instance.deploymentId === deployment.id &&
          instance.dataId === deployment.dataId && instance.principalId === principalId,
          'VIEW_BINDING_CONFLICT','A stable view cannot be silently rebound to another application or deployment.');
        requireCondition(input.instanceId === undefined || input.instanceId === instance.id,
          'VIEW_BINDING_CONFLICT','Requested instance does not match the persisted view.');
        requireCondition(input.originalSessionId === undefined || input.originalSessionId === lease.originalSessionId,
          'SESSION_BINDING_CONFLICT','Original application session identity cannot be silently replaced.');
      } else {
        requireCondition(input.leaseToken === undefined,'UNKNOWN_VIEW','Cannot resume an unknown view.',{},404);
        requireCondition(next.leases.length < 2_048,'CAPACITY_LIMIT','Lease history capacity reached; explicit maintenance is required.');
        if (input.instanceId !== undefined) {
          identifier(input.instanceId,'instanceId');
          instance = next.instances.find(i => i.id === input.instanceId);
          requireCondition(instance && instance.principalId === principalId && instance.appId === app.id &&
            instance.deploymentId === deployment.id && instance.dataId === deployment.dataId,
            'INSTANCE_NOT_OWNED','Instance does not belong to this principal/deployment.',{},403);
        } else {
          // SINGLE_INSTANCE_REUSE: this lookup and durable reservation share the serial critical section.
          const reuse = app.singleInstanceOnly;
          if (reuse) instance = next.instances.find(i => i.principalId === principalId && i.appId === app.id &&
            i.deploymentId === deployment.id && i.dataId === deployment.dataId);
        }
        if (!instance) {
          requireCondition(next.instances.length < 256,'CAPACITY_LIMIT','Instance history capacity reached.');
          const id = randomUUID();
          const namespace = createHash('sha256').update(principalId).digest('hex').slice(0,24);
          const directory = join(this.dataRoot,namespace,app.id,deployment.id,deployment.dataId,
            app.singleInstanceOnly ? 'single' : id);
          instance = { id,appId:app.id,deploymentId:deployment.id,dataId:deployment.dataId,principalId,
            dataDir:directory,mode:deployment.mode,definitionHash:fingerprint(app),status:'reserved',runtimeId:null,
            endpoint:null,gatewayOrigin:null,pid:null,guardianPid:null,createdAt:this.clock(),updatedAt:this.clock() };
          next.instances.push(instance);
        }
        token = randomBytes(32).toString('hex');
        lease = { principalId,viewId:input.viewId,instanceId:instance.id,tokenHash:hash(token),generation:1,
          status:'active',expiresAt:this.clock()+this.leaseTtlMs,createdAt:this.clock(),originalSessionId:input.originalSessionId ?? null };
        next.leases.push(lease);
      }
      // App upgrades change descriptors (credentialEnv, purpose text, name). Data ownership is checked separately below
      // (BINDING_PATH_INVALID), so a not-running instance simply adopts the new definition; a running one keeps the
      // definition it was launched with and must be stopped first.
      if (instance.definitionHash !== fingerprint(app)) {
        requireCondition(!this.#controls.get(instance.id),'DEFINITION_CHANGED',
          'The application definition changed while the instance is running; stop it, then open again.',{},409);
        const previous = instance.definitionHash; instance.definitionHash = fingerprint(app); instance.updatedAt = this.clock();
        this.#event(next,'instance.definition-adopted',instance,{ previous:previous.slice(0,12), current:instance.definitionHash.slice(0,12) });
      }
      identifier(instance.id,'instanceId');
      const expectedNamespace=createHash('sha256').update(principalId).digest('hex').slice(0,24);
      const expectedDirectory=join(this.dataRoot,expectedNamespace,app.id,deployment.id,deployment.dataId,app.singleInstanceOnly?'single':instance.id);
      requireCondition(instance.dataDir===expectedDirectory && instance.mode===deployment.mode,'BINDING_PATH_INVALID',
        'Persisted data ownership does not match this registered root; explicit migration is required.');
      requireCondition(instance.status !== 'stopping','INSTANCE_STOPPING','Instance is stopping; retry after the stopped event.');
      if (lease.status !== 'active' || lease.expiresAt <= this.clock()) {
        token = randomBytes(32).toString('hex'); lease.tokenHash = hash(token); lease.generation++;
      }
      lease.status = 'active'; lease.expiresAt = this.clock()+this.leaseTtlMs;
      const existingControl = this.#controls.get(instance.id);
      const needsLaunch = !existingControl;
      if (needsLaunch) {
        instance.status = 'reserved'; instance.runtimeId = randomUUID(); instance.pid = null; instance.guardianPid = null;
        instance.endpoint = null; instance.gatewayOrigin = null; instance.updatedAt = this.clock();
      }
      this.#event(next,'view.opened',instance,{ viewId:lease.viewId,generation:lease.generation });
      let control = existingControl;
      if (needsLaunch) {
        control = { abort:new AbortController(),runner:null,gateway:null,readyTask:null,stopTask:null };
        this.#controls.set(instance.id,control);
        try {
          await reserveBeforeLaunch(
            () => this.#commit(next),
            async () => {
              await this.#prepareRuntime(instance,deployment,control);
              const started = copy(this.#state), stored = started.instances.find(i => i.id === instance.id);
              stored.status = 'starting'; stored.endpoint = control.origin; stored.pid = control.runner?.pid ?? null;
              stored.guardianPid = control.runner?.guardianPid ?? null; stored.updatedAt = this.clock();
              for (const e of control.credentialEvents ?? []) this.#event(started,e.type,stored,e.details);
              this.#event(started,'instance.starting',stored);
              await this.#commit(started);
            },
            point => this.checkpoint(point,{ instanceId:instance.id }),
          );
          // Queue reservation is complete before readiness is awaited by any caller.
          control.readyTask = this.#completeLaunch(instance.id,deployment,control);
          control.readyTask.catch(() => {}); // callers receive the original rejection
        } catch (error) {
          await control.gateway?.close().catch(() => {});
          try { await control.runner?.stop(); }
          catch { this.#poisoned = true; throw new AppHostError('CLEANUP_UNCONFIRMED', 'Startup failed and owned cleanup could not be confirmed; ownership retained.'); }
          this.#controls.delete(instance.id);
          if (this.#state.instances.some(i => i.id === instance.id) && !this.#poisoned) {
            const failed = copy(this.#state), record = failed.instances.find(i => i.id === instance.id);
            record.status='failed'; record.endpoint=null; record.errorCode=error.code ?? 'START_FAILED';
            for (const l of failed.leases) if (l.instanceId === record.id && l.status === 'active') l.status='failed';
            this.#event(failed,'instance.failed',record,{code:record.errorCode});
            await this.#commit(failed).catch(() => { this.#poisoned = true; });
          }
          throw error;
        }
      } else await this.#commit(next);
      return { instanceId:instance.id,token,control,generation:lease.generation };
    });
    return prepared;
  }
  async #openResult(prepared, input, principalId, requireReady) {
    return await this.#queue.run(() => {
      this.#assertOpen();
      const lease = this.#findLease(this.#state,principalId,input.viewId);
      this.#checkToken(lease,prepared.token);
      requireCondition(active(lease,this.clock()) && lease.generation === prepared.generation,
        'START_CANCELLED','View closed or expired while starting.');
      const instance = this.#state.instances.find(i => i.id === prepared.instanceId);
      if (requireReady) requireCondition(instance.status === 'ready','INSTANCE_NOT_READY','Instance is not ready.');
      return { instance:publicInstance(instance),lease:publicLease(lease),leaseToken:prepared.token,
        uiUrl:instance.status !== 'ready' ? null : (prepared.control.gateway ?
          prepared.control.gateway.issue(leaseKey(principalId,input.viewId,lease.generation)) : instance.endpoint),
        originalSessionId:lease.originalSessionId };
    });
  }
  async beginOpen(input,principalId='host') {
    const prepared = await this.#prepareOpen(input,principalId);
    return await this.#openResult(prepared,input,principalId,false);
  }
  async open(input,principalId='host') {
    const prepared = await this.#prepareOpen(input,principalId);
    await prepared.control.readyTask;
    return await this.#openResult(prepared,input,principalId,true);
  }
  // No anonymous reference counter: host start uses the same explicit view contract.
  async start(input,principalId = 'host') { return await this.open(input,principalId); }
  async #prepareRuntime(instance,deployment,control) {
    if (deployment.mode === 'attach') {
      control.origin = deployment.url;
      control.runner = { mode:'attach',stop:async () => {},isAlive:() => true };
      return;
    }
    requireCondition(['linux','darwin'].includes(process.platform),'PLATFORM_UNSUPPORTED','Owned runtimes are supported only on validated POSIX process-group platforms.');
    let command = deployment.command;
    if (deployment.runtime) {
      const selected = deployment.runtime.manifest.items.find(item => item.id === deployment.runtime.item);
      const root = join(this.dataRoot,'runtimes',instance.appId);
      let book;
      try { book = await this.#runtimeLedgerReader(root); }
      catch { requireCondition(false,'RUNTIME_MISSING','Runtime ledger is unavailable; install or repair the application runtime.',{},409); }
      requireCondition(book?.items?.[deployment.runtime.item]?.version === selected.version,
        'RUNTIME_MISSING','The installed runtime is missing or does not match the application manifest.',{},409);
      command = join(root,selected.installTo,deployment.runtime.exec);
    }
    try { await access(command,constants.X_OK); }
    catch { requireCondition(false,deployment.runtime?'RUNTIME_MISSING':'INVALID_COMMAND',
      deployment.runtime?'The declared runtime executable is missing or not executable.':'The application command is missing or not executable.',{},409); }
    await secureDirectory(instance.dataDir);
    for (const child of ['home','tmp','config','cache','state']) await secureDirectory(join(instance.dataDir,child));
    const port = await freePort();
    const values = { ...instance,instanceId:instance.id,port };
    const credentials = await this.#resolveCredentials(instance,deployment);
    control.credentialEvents = credentials.events;
    const written = [], kept = [], removed = [];
    for (const file of credentials.files) {
      const base = file.base === 'dataDir' ? instance.dataDir : join(instance.dataDir,'home');
      const target = join(base,file.path);
      requireCondition(target.startsWith(base + '/'),'INVALID_CREDENTIAL_ENV','Credential file escapes its declared base.');
      if (file.policy === 'remove') { await rm(target,{ force:true }); removed.push(`file:${file.path}`); continue; }
      // rc.6: 'if-absent' (default) keeps a file the app has since rotated itself (its own refresh token);
      // 'overwrite' is for a new grant version; the broker decides, the host never reads the file back.
      if (file.policy === 'if-absent' && await access(target).then(() => true, () => false)) { kept.push(`file:${file.path}`); continue; }
      await mkdir(dirname(target),{ recursive:true, mode:0o700 });
      await writeFile(target,file.content,{ mode:file.mode });
      written.push(`file:${file.path}`);
    }
    const injected = [...credentials.envNames, ...written];
    if (injected.length) control.credentialEvents.push({ type:'credential.injected', details:{ names:injected } });
    if (kept.length) control.credentialEvents.push({ type:'credential.file-kept', details:{ names:kept } });
    if (removed.length) control.credentialEvents.push({ type:'credential.file-removed', details:{ names:removed } });
    const env = {
      PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'C.UTF-8',
      ...credentials.env,
      ...Object.fromEntries(Object.entries(deployment.env).map(([key,value]) => [key,expand(value,values)])),
      HOME:join(instance.dataDir,'home'),TMPDIR:join(instance.dataDir,'tmp'),
      XDG_CONFIG_HOME:join(instance.dataDir,'config'),XDG_CACHE_HOME:join(instance.dataDir,'cache'),
      XDG_STATE_HOME:join(instance.dataDir,'state'),XDG_DATA_HOME:instance.dataDir,
    };
    control.origin=`http://127.0.0.1:${port}`;
    control.runner=await spawnOwned({ nodeBinary:this.#nodeBinary,command,args:deployment.args.map(value => expand(value,values)),
      cwd:deployment.cwd ?? instance.dataDir,dataDir:instance.dataDir,env,stopGraceMs:deployment.stopGraceMs,secrets:credentials.secrets },{
      onLog:(stream,text) => {
        const records=this.#logs.get(instance.id) ?? [];
        records.push({at:this.clock(),stream,text}); if(records.length>128)records.shift(); this.#logs.set(instance.id,records);
      },
    });
    control.runner.exited.then(result => { void this.#onExit(instance.id,control,result); });
    await this.checkpoint('runtime-spawned',{instanceId:instance.id,pid:control.runner.pid,dataDir:instance.dataDir,
      nodeBinary:control.runner.nodeBinary,guardianBinary:control.runner.guardianBinary,launcherBinary:control.runner.launcherBinary});
  }
  async #completeLaunch(id,deployment,control) {
    try {
      await waitReady(control.origin,deployment.readiness,{runtime:control.runner,timeoutMs:deployment.startTimeoutMs,signal:control.abort.signal});
      if (control.abort.signal.aborted) throw new AppHostError('START_CANCELLED','Launch was cancelled.');
      if (deployment.embedding === 'gateway') {
        control.gateway=new FixedGateway({upstream:control.origin,parentOrigin:this.parentOrigin,frameAncestors:this.frameAncestors,
          ...deployment.gateway,isLeaseActive:key => {
            const [principal,view,generation]=JSON.parse(key),lease=this.#findLease(this.#state,principal,view);
            const instance=this.#state.instances.find(i=>i.id===id);
            return Boolean(lease && lease.instanceId===id && lease.generation===generation && active(lease,this.clock()) && instance?.status==='ready');
          }});
        await control.gateway.start();
      }
      await this.#queue.run(async () => {
        requireCondition(!control.abort.signal.aborted,'START_CANCELLED','Launch was cancelled.');
        const next=copy(this.#state),record=next.instances.find(i=>i.id===id);
        requireCondition(record.status==='starting' && this.#activeFor(next,id).length>0,'START_CANCELLED','No live views remain.');
        record.status='ready';record.gatewayOrigin=control.gateway?.origin ?? null;record.updatedAt=this.clock();delete record.errorCode;
        this.#event(next,'instance.ready',record);await this.#commit(next);
      });
    } catch(error) {
      await control.gateway?.close().catch(()=>{});
      try { await control.runner?.stop(); } catch(cleanupError) {
        this.#poisoned=true;throw new AppHostError('CLEANUP_FAILED','Application cleanup could not be confirmed.',{cause:cleanupError.code});
      }
      await this.#queue.run(async()=>{
        const next=copy(this.#state),record=next.instances.find(i=>i.id===id);
        if(record && record.status!=='stopping' && record.status!=='stopped') {
          record.status='failed';record.endpoint=null;record.gatewayOrigin=null;record.errorCode=error.code ?? 'START_FAILED';record.updatedAt=this.clock();
          for(const lease of next.leases)if(lease.instanceId===id && lease.status==='active')lease.status='failed';
          this.#event(next,'instance.failed',record,{code:record.errorCode});await this.#commit(next);
          this.#controls.delete(id);
        }
      }).catch(()=>{this.#poisoned=true;});
      throw error;
    }
  }
  async #onExit(id,control,result) {
    await this.#queue.run(async()=>{
      if(this.#controls.get(id)!==control)return;
      const record=this.#state.instances.find(i=>i.id===id);
      if(record?.status!=='ready')return; // startup/cancellation has a separate completion path
      await control.gateway?.close();
      let cleanupConfirmed=true;
      try { await control.runner.stop(); } catch { cleanupConfirmed=false;this.#poisoned=true; }
      const next=copy(this.#state),item=next.instances.find(i=>i.id===id);
      item.status='failed';item.endpoint=null;item.gatewayOrigin=null;item.errorCode=cleanupConfirmed?'APP_EXITED':'CLEANUP_UNCONFIRMED';item.updatedAt=this.clock();
      for(const lease of next.leases)if(lease.instanceId===id && lease.status==='active')lease.status='failed';
      this.#event(next,'instance.failed',item,{code:item.errorCode,exit:result});await this.#commit(next);
      if(cleanupConfirmed)this.#controls.delete(id);
    }).catch(()=>{this.#poisoned=true;});
  }
  async resume(input,principalId='host',{waitForReady=true}={}) {
    this.#validateRequest(input,['viewId','leaseToken']);
    const known=await this.#queue.run(()=>{
      this.#assertOpen();identifier(principalId);identifier(input.viewId);
      const lease=this.#findLease(this.#state,principalId,input.viewId);this.#checkToken(lease,input.leaseToken);
      const instance=this.#state.instances.find(i=>i.id===lease.instanceId);
      requireCondition(instance,'MISSING_BINDING','Persisted instance binding is missing.',{},409);
      return {appId:instance.appId,deploymentId:instance.deploymentId,instanceId:instance.id};
    });
    return waitForReady ? await this.open({...known,...input},principalId) : await this.beginOpen({...known,...input},principalId);
  }
  /** Explicit authenticated-owner recovery after a lost receipt/browser cache. Never rebinds a view. */
  async recoverView(input,principalId='host') {
    this.#validateRequest(input,['viewId','instanceId','confirm']);
    requireCondition(input.confirm===true,'RECOVERY_CONFIRM_REQUIRED','Recovery invalidates the prior view credential; explicit confirmation is required.');
    identifier(principalId);identifier(input.viewId);identifier(input.instanceId);
    return await this.#queue.run(async()=>{
      this.#assertOpen();const next=copy(this.#state),lease=this.#findLease(next,principalId,input.viewId);
      requireCondition(lease && lease.instanceId===input.instanceId,'LEASE_NOT_OWNED','No matching view belongs to the authenticated principal.',{},403);
      const instance=next.instances.find(i=>i.id===lease.instanceId);
      const leaseToken=randomBytes(32).toString('hex');lease.tokenHash=hash(leaseToken);lease.generation++;
      // Recovery alone is not an Open and does not create/renew a reference.
      this.#event(next,'view.credential-recovered',instance,{viewId:lease.viewId,generation:lease.generation});
      await this.#commit(next);
      return {instance:publicInstance(instance),lease:publicLease(lease),leaseToken,uiUrl:null,originalSessionId:lease.originalSessionId};
    });
  }
  async heartbeat(input,principalId='host') {
    this.#validateRequest(input,['viewId','leaseToken']);
    return await this.#queue.run(async()=>{
      this.#assertOpen();const next=copy(this.#state),lease=this.#findLease(next,principalId,input.viewId);
      this.#checkToken(lease,input.leaseToken);
      requireCondition(active(lease,this.clock()),'LEASE_EXPIRED','Expired views must explicitly resume.');
      const instance=next.instances.find(i=>i.id===lease.instanceId);
      requireCondition(['ready','starting','reserved'].includes(instance.status),'INSTANCE_NOT_READY','Cannot renew a stopped/interrupted runtime.');
      lease.expiresAt=this.clock()+this.leaseTtlMs;await this.#commit(next);return publicLease(lease);
    });
  }
  async close(input,principalId='host') {
    this.#validateRequest(input,['viewId','leaseToken']);
    const result=await this.#queue.run(async()=>{
      this.#assertOpen();const next=copy(this.#state),lease=this.#findLease(next,principalId,input.viewId);
      this.#checkToken(lease,input.leaseToken);
      const record=next.instances.find(i=>i.id===lease.instanceId);
      if(lease.status!=='active')return {instanceId:record.id,alreadyClosed:true,stop:false};
      lease.status='closed';this.#event(next,'view.closed',record,{viewId:lease.viewId,generation:lease.generation});
      await this.#commit(next);
      return {instanceId:record.id,alreadyClosed:false,stop:this.#activeFor(next,record.id).length===0};
    });
    if(result.stop)await this.stop(result.instanceId,{confirm:false},principalId).catch(error=>{if(error.code!=='INSTANCE_IN_USE')throw error;});
    return {instanceId:result.instanceId,alreadyClosed:result.alreadyClosed,instance:this.instance(result.instanceId,principalId)};
  }
  async stop(instanceId,{confirm=false}={},principalId='host') {
    identifier(instanceId,'instanceId');
    const wrapped=await this.#queue.run(async()=>{
      // During dispose, existing runtimes must still be stoppable.
      requireCondition(this.#initialized,'HOST_CLOSED','Host is not initialized.');
      const stored=this.#state.instances.find(i=>i.id===instanceId);
      requireCondition(stored && stored.principalId===principalId,'INSTANCE_NOT_OWNED','Instance not owned by this principal.',{},403);
      const control=this.#controls.get(instanceId);
      if(control?.stopTask)return {task:control.stopTask};
      if(isTerminal(stored.status) && !control)return {task:Promise.resolve(publicInstance(stored))};
      const users=this.#activeFor(this.#state,instanceId);
      requireCondition(confirm || users.length===0,'INSTANCE_IN_USE','Stop refused: views are still using this instance.',
        {views:users.map(l=>({viewId:l.viewId,generation:l.generation,expiresAt:l.expiresAt}))},409);
      const next=copy(this.#state),record=next.instances.find(i=>i.id===instanceId);
      record.status='stopping';record.updatedAt=this.clock();
      this.#event(next,'instance.stop-requested',record,{views:users.map(l=>l.viewId)});
      // Persist stopping before signalling; no UI may infer stopped from this event.
      await this.#commit(next);control?.abort.abort();
      const task=(async()=>{
        await stopBeforePublish(async()=>{
          await control?.gateway?.close();await control?.runner?.stop();
          await control?.readyTask?.catch(()=>{});
        },async()=>{
          return await this.#queue.run(async()=>{
            const final=copy(this.#state),item=final.instances.find(i=>i.id===instanceId);
            item.status='stopped';item.endpoint=null;item.gatewayOrigin=null;item.updatedAt=this.clock();
            for(const lease of final.leases)if(lease.instanceId===instanceId && lease.status==='active') {
              lease.status='stopped';this.#event(final,'view.stopped',item,{viewId:lease.viewId,generation:lease.generation});
            }
            this.#event(final,'instance.stopped',item,{mode:item.mode});await this.#commit(final);
            this.#controls.delete(instanceId);return publicInstance(item);
          });
        },point=>this.checkpoint(point,{instanceId}));
        return this.instance(instanceId,principalId);
      })();
      task.catch(()=>{});if(control)control.stopTask=task;
      return {task};
    });
    return await wrapped.task;
  }
  async stopAll() {
    const records=this.#state?.instances ?? [];
    const targets=records.filter(i=>!isTerminal(i.status)||this.#controls.has(i.id));
    const results=await Promise.allSettled(targets.map(i=>this.stop(i.id,{confirm:true},i.principalId)));
    const failures=results.filter(r=>r.status==='rejected');
    // Host teardown: the persistence medium may already be closing (a whole-profile unload tears the
    // storage domain down alongside this plugin), which makes the "persist stopping first" write fail.
    // An owned process must still never be orphaned by its host going away, so the runtime is signalled
    // directly; the stopped state is not advertised (it was never persisted) and the error still surfaces.
    if(failures.length && this.#closing){
      await Promise.allSettled(targets.filter((_,index)=>results[index].status==='rejected')
        .map(i=>this.#controls.get(i.id)?.runner?.stop()));
    }
    if(failures.length)throw new AppHostError('STOP_ALL_INCOMPLETE','Some runtimes could not be confirmed stopped.',{count:failures.length});
  }
  async sweepLeases() {
    const ids=await this.#queue.run(async()=>{
      this.#assertOpen();const next=copy(this.#state);let changed=false;
      for(const lease of next.leases)if(lease.status==='active' && lease.expiresAt<=this.clock()) {
        lease.status='expired';changed=true;
        this.#event(next,'view.expired',next.instances.find(i=>i.id===lease.instanceId),{viewId:lease.viewId});
      }
      if(changed)await this.#commit(next);
      return next.instances.filter(i=>this.#controls.has(i.id)&&i.status!=='stopping'&&this.#activeFor(next,i.id).length===0).map(i=>[i.id,i.principalId]);
    });
    for(const [id,principal]of ids)await this.stop(id,{confirm:false},principal).catch(error=>{if(error.code!=='INSTANCE_IN_USE')throw error;});
  }
  instance(id,principalId='host') {
    const item=this.#state?.instances.find(i=>i.id===id && i.principalId===principalId);return item?publicInstance(item):null;
  }
  instanceList(principalId='host') {return (this.#state?.instances ?? []).filter(i=>i.principalId===principalId).map(publicInstance);}
  list(principalId='host') {
    return {contractVersion:1,apps:[...this.#definitions.values()].map(d=>({id:d.id,name:d.name,singleInstanceOnly:d.singleInstanceOnly,
      deployments:d.deployments.map(p=>({id:p.id,dataId:p.dataId,mode:p.mode,embedding:p.embedding,credentialEnv:copy(p.credentialEnv??[])}))})),
      instances:this.instanceList(principalId),views:(this.#state?.leases??[]).filter(l=>l.principalId===principalId).map(publicLease),
      sequence:this.#state?.sequence??0};
  }
  eventsSince(sequence=0,principalId='host') {
    requireCondition(Number.isSafeInteger(sequence)&&sequence>=0,'INVALID_CURSOR','Invalid event cursor.');
    const all=this.#state.events;
    return {events:all.filter(e=>e.sequence>sequence&&e.principalId===principalId).map(copy),sequence:this.#state.sequence,
      resetRequired:all.length>0 && sequence<all[0].sequence-1};
  }
  subscribe(listener) {this.#listeners.add(listener);return()=>this.#listeners.delete(listener);}
  logTail(id,limit=50,principalId='host') {
    requireCondition(this.instance(id,principalId),'INSTANCE_NOT_OWNED','Instance is not owned.',{},403);
    requireCondition(Number.isInteger(limit)&&limit>=0&&limit<=128,'INVALID_LIMIT','Log limit must be 0..128.');
    return limit===0?[]:copy((this.#logs.get(id)??[]).slice(-limit));
  }
  async dispose() {
    if(this.#disposing)return await this.#disposing;
    this.#closing=true;clearInterval(this.#timer);
    this.#disposing=(async()=>{
      let failure;
      try{await this.stopAll();}catch(error){failure=error;}
      // Release the medium even when a stop could not be confirmed; the failure is still reported.
      try{await this.#queue.drained();await this.store.close();}catch(error){failure??=error;}
      this.#initialized=false;this.#listeners.clear();
      if(failure)throw failure;
    })();
    return await this.#disposing;
  }
}
