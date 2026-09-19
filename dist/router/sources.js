import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const KNOWN = Object.freeze({
  DEEPSEEK_API_KEY:'deepseek', OPENAI_API_KEY:'openai', ANTHROPIC_API_KEY:'anthropic', GEMINI_API_KEY:'google',
});
export const providerOf = ref => KNOWN[ref] ?? (ref.endsWith('_API_KEY') ? ref.slice(0,-8).toLowerCase().replaceAll('_','-') : undefined);
const refForProvider = provider => Object.keys(KNOWN).find(ref => KNOWN[ref] === provider)
  ?? `${provider.toUpperCase().replaceAll('-','_')}_API_KEY`;
const safeJson = async response => {
  try { return await response.json(); } catch { return {}; }
};

export function createProviderSources({ credentials, apps, llm = () => undefined, fetcher = globalThis.fetch.bind(globalThis),
  webOrigin, codingOauth = {}, dshHome = process.env.DSH_HOME }) {
  const mode = codingOauth.mode ?? 'http';
  async function dshProviders() {
    const refs = new Set(Object.keys(KNOWN));
    for (const app of apps.list().apps) for (const deployment of app.deployments ?? []) for (const entry of deployment.credentialEnv ?? [])
      for (const provider of entry.providers ?? []) if (provider !== 'coding-oauth-gateway') refs.add(refForProvider(provider));
    const catalog = new Map((llm()?.listProviders?.() ?? []).map(item => [item.id,item]));
    return await Promise.all([...refs].sort().map(async ref => {
      const info = await credentials.describe(ref);
      const id = providerOf(ref);
      const meta = catalog.get(id);
      let models;
      if (meta && typeof llm()?.listModels === 'function') {
        try { models = (await llm().listModels(id)).map(item => item.id ?? item.model).filter(Boolean); } catch {}
      }
      return { id, source:'dsh-models', kind:'api-key', displayName:meta?.name ?? id, ref,
        ...(info.keyHint ? { keyHint:info.keyHint } : {}), ...(models?.length ? { models } : {}),
        state:info.configured ? 'configured' : 'absent' };
    }));
  }
  async function fileGateway({ reveal = false } = {}) {
    if (!dshHome) return null;
    const path = join(dshHome,'.coding-oauth-gateway.json');
    let fileStat, value;
    try { fileStat = await stat(path); value = JSON.parse(await readFile(path,'utf8')); } catch { return null; }
    if ((fileStat.mode & 0o077) !== 0) return { id:'coding-oauth-gateway', source:'coding-oauth-gateway', kind:'api-key',
      displayName:'Coding OAuth Gateway', state:'unreachable' };
    const base = { id:'coding-oauth-gateway', source:'coding-oauth-gateway', kind:'api-key', displayName:'Coding OAuth Gateway',
      ...(Array.isArray(value.models) ? { models:value.models } : {}), ...(value.keyHint ? { keyHint:value.keyHint } : {}) };
    if (!value.enabled) return { ...base, state:'gateway-off' };
    if (!Number.isSafeInteger(value.port)) return { ...base, state:'unreachable' };
    return { ...base, state:'configured', baseUrl:`http://127.0.0.1:${value.port}/v1`, ...(reveal ? { value:value.apiKey } : {}) };
  }
  async function httpGateway({ reveal = false } = {}) {
    let response;
    try { response = await fetcher(`${webOrigin}/plugins/dsh-grok-build/gateway${reveal?'/reveal':''}`, { method:reveal?'POST':'GET' }); }
    catch { return { id:'coding-oauth-gateway', source:'coding-oauth-gateway', kind:'api-key', displayName:'Coding OAuth Gateway', state:'unreachable' }; }
    if (response.status === 404) return null;
    if (!response.ok) return { id:'coding-oauth-gateway', source:'coding-oauth-gateway', kind:'api-key', displayName:'Coding OAuth Gateway', state:'unreachable' };
    const value = await safeJson(response);
    const base = { id:'coding-oauth-gateway', source:'coding-oauth-gateway', kind:'api-key', displayName:'Coding OAuth Gateway',
      ...(Array.isArray(value.models) ? { models:value.models } : {}), ...(value.keyHint ? { keyHint:value.keyHint } : {}) };
    if (!reveal && !value.enabled) return { ...base, state:'gateway-off' };
    if (!reveal && (!value.running || !Number.isSafeInteger(value.port))) return { ...base, state:'unreachable' };
    const port = value.port ?? (await httpGateway())?.baseUrl?.match(/:(\d+)\/v1$/)?.[1];
    return { ...base, state:'configured', ...(port ? { baseUrl:`http://127.0.0.1:${port}/v1` } : {}), ...(reveal ? { value:value.apiKey } : {}) };
  }
  const gateway = options => mode === 'file' ? fileGateway(options) : httpGateway(options);
  return {
    async list() { const values = await dshProviders(), extra = await gateway(); if (extra) values.push(extra); return values; },
    async enableGateway(enabled) {
      if (mode === 'file') throw Object.assign(new Error('GATEWAY_FILE_MODE'),{code:'GATEWAY_FILE_MODE'});
      const response = await fetcher(`${webOrigin}/plugins/dsh-grok-build/gateway`, { method:'PATCH',
        headers:{'content-type':'application/json'}, body:JSON.stringify({enabled}) });
      if (!response.ok) throw Object.assign(new Error(response.status===404?'ROUTER_PROVIDER_ABSENT':'GATEWAY_UNREACHABLE'),{code:response.status===404?'ROUTER_PROVIDER_ABSENT':'GATEWAY_UNREACHABLE'});
      return await safeJson(response);
    },
    async resolve(subject) {
      if (subject.kind === 'api-key') {
        const resolved = await credentials.resolve(subject.ref);
        return resolved?.value ? { value:resolved.value, provider:{ id:providerOf(subject.ref), source:'dsh-models', ref:subject.ref } } : undefined;
      }
      if (subject.kind === 'provider' && subject.providerId === 'coding-oauth-gateway') {
        const provider = await gateway(), revealed = await gateway({reveal:true});
        if (!provider) throw Object.assign(new Error('ROUTER_PROVIDER_ABSENT'),{code:'ROUTER_PROVIDER_ABSENT'});
        if (provider.state === 'gateway-off') throw Object.assign(new Error('GATEWAY_OFF'),{code:'GATEWAY_OFF'});
        if (provider.state !== 'configured' || !revealed?.value) throw Object.assign(new Error('GATEWAY_UNREACHABLE'),{code:'GATEWAY_UNREACHABLE'});
        return { value:revealed.value, provider:{...provider, ...revealed, value:undefined} };
      }
      return undefined;
    },
  };
}
