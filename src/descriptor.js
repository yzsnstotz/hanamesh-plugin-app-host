import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { requireCondition, copy } from './errors.js';
export function identifier(value, name = 'id') {
  requireCondition(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value) &&
    !['__proto__','prototype','constructor'].includes(value), 'INVALID_ID', `Invalid ${name}.`);
  return value;
}
export function loopbackOrigin(value) {
  let url;
  try { url = new URL(value); } catch { requireCondition(false, 'INVALID_ORIGIN', 'Expected an explicit loopback origin.'); }
  requireCondition(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port &&
    !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
    'INVALID_ORIGIN', 'Only an explicit http://127.0.0.1:<port> origin is supported by this candidate.');
  return url.origin;
}
export function validateDefinition(input) {
  const d = copy(input);
  identifier(d.id, 'appId');
  requireCondition(typeof d.name === 'string' && d.name.length > 0 && d.name.length <= 160, 'INVALID_DEFINITION', 'Application name is required.');
  d.singleInstanceOnly ??= true;
  requireCondition(typeof d.singleInstanceOnly === 'boolean' && Array.isArray(d.deployments) && d.deployments.length > 0,
    'INVALID_DEFINITION', 'Expected deployment definitions.');
  const ids = new Set();
  for (const p of d.deployments) {
    identifier(p.id, 'deploymentId'); identifier(p.dataId, 'dataId');
    requireCondition(!ids.has(p.id), 'INVALID_DEFINITION', 'Duplicate deploymentId.'); ids.add(p.id);
    requireCondition(['owned','attach'].includes(p.mode), 'INVALID_DEFINITION', 'mode must be owned or attach.');
    p.embedding ??= 'direct';
    requireCondition(['direct','gateway'].includes(p.embedding), 'INVALID_DEFINITION', 'Unknown embedding mode.');
    const r = p.readiness;
    requireCondition(r && typeof r.path === 'string' && r.path.startsWith('/') && !r.path.startsWith('//') &&
      !r.path.includes('\\') && Number.isInteger(r.status) && r.status >= 200 && r.status < 500 &&
      ((typeof r.bodyIncludes === 'string' && r.bodyIncludes.length > 0) ||
       (r.header && typeof r.header.name === 'string' && typeof r.header.value === 'string' && r.header.value.length > 0)),
      'INVALID_READINESS', 'Readiness requires an exact status and nonempty application identity marker.');
    p.startTimeoutMs ??= 10_000; p.stopGraceMs ??= 1_000;
    requireCondition(Number.isInteger(p.startTimeoutMs) && p.startTimeoutMs >= 100 && p.startTimeoutMs <= 120_000 &&
      Number.isInteger(p.stopGraceMs) && p.stopGraceMs >= 50 && p.stopGraceMs <= 30_000,
      'INVALID_DEFINITION', 'Lifecycle timeouts are outside the allowed bounds.');
    if (p.mode === 'owned') {
      requireCondition(typeof p.command === 'string' && isAbsolute(p.command) && !p.command.includes('\0'),
        'INVALID_COMMAND', 'An absolute, trusted executable path is required.');
      requireCondition(Array.isArray(p.args) && p.args.every(a => typeof a === 'string' && !a.includes('\0')),
        'INVALID_COMMAND', 'args must be an explicit string array; shell execution is not supported.');
      if (p.cwd) requireCondition(isAbsolute(p.cwd), 'INVALID_COMMAND', 'cwd must be absolute.');
      p.env ??= {}; p.envAllowlist ??= [];
      requireCondition(p.env && !Array.isArray(p.env) && Array.isArray(p.envAllowlist) &&
        Object.entries(p.env).every(([k, v]) => /^[A-Z_][A-Z0-9_]*$/.test(k) && p.envAllowlist.includes(k) &&
          typeof v === 'string' && !v.includes('\0') && !/^(DSH_|NODE_OPTIONS$|LD_|DYLD_)/.test(k)),
        'INVALID_ENV', 'Every environment entry must be explicitly allowlisted; host control variables are forbidden.');
      // rc.4: an app declares WHICH credentials it needs (env names / home files), never where they come from.
      p.credentialEnv ??= [];
      requireCondition(Array.isArray(p.credentialEnv), 'INVALID_CREDENTIAL_ENV', 'credentialEnv must be an array.');
      const seen = new Set();
      for (const c of p.credentialEnv) {
        requireCondition(c && typeof c === 'object' && !Array.isArray(c), 'INVALID_CREDENTIAL_ENV', 'credentialEnv entries must be objects.');
        c.kind ??= 'api-key'; c.required ??= false; c.projection ??= 'env'; c.providers ??= [];
        if (c.projection === 'file') { c.base ??= 'home'; }
        requireCondition((c.projection !== 'file' || ['home','dataDir'].includes(c.base)) &&
          (c.format === undefined || (typeof c.format === 'string' && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(c.format))),
          'INVALID_CREDENTIAL_ENV', 'credentialEnv file base must be home or dataDir; format is an opaque lowercase id.');
        requireCondition(['api-key','grant'].includes(c.kind) && ['env','file'].includes(c.projection) && typeof c.required === 'boolean' &&
          Array.isArray(c.providers) && c.providers.every(x => typeof x === 'string' && /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(x)) &&
          (c.purpose === undefined || (typeof c.purpose === 'string' && c.purpose.length <= 120)),
          'INVALID_CREDENTIAL_ENV', 'credentialEnv entry has an unknown kind, projection, provider id or purpose.');
        if (c.projection === 'env') {
          requireCondition(typeof c.env === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(c.env) && !/^(DSH_|NODE_OPTIONS$|LD_|DYLD_|PATH$|HOME$|TMPDIR$|XDG_)/.test(c.env),
            'INVALID_CREDENTIAL_ENV', 'credentialEnv env must be a POSIX identifier and not a host control variable.');
          requireCondition(!(c.env in p.env), 'INVALID_CREDENTIAL_ENV', 'credentialEnv must not repeat a static env entry.');
          requireCondition(!seen.has('env:' + c.env), 'INVALID_CREDENTIAL_ENV', 'Duplicate credentialEnv env name.'); seen.add('env:' + c.env);
        } else {
          requireCondition(typeof c.path === 'string' && c.path.length > 0 && c.path.length <= 200 && !c.path.startsWith('/') &&
            !c.path.includes('\0') && c.path.split('/').every(seg => seg && seg !== '.' && seg !== '..'),
            'INVALID_CREDENTIAL_ENV', 'credentialEnv file path must be relative to the app HOME and contain no "." or ".." segments.');
          requireCondition(!seen.has(`file:${c.base}:` + c.path), 'INVALID_CREDENTIAL_ENV', 'Duplicate credentialEnv file path.'); seen.add(`file:${c.base}:` + c.path);
        }
      }
      const bindings = [...p.args, ...Object.values(p.env)];
      requireCondition(bindings.some(v => v.includes('{{dataDir}}')) && bindings.some(v => v.includes('{{port}}')),
        'MISSING_RUNTIME_BINDING', 'Application adapter must explicitly bind its data directory and loopback port.');
      for (const s of bindings) for (const match of s.matchAll(/\{\{(.*?)\}\}/g)) {
        requireCondition(['dataDir','port','instanceId','runtimeId','appId','deploymentId','dataId'].includes(match[1]),
          'INVALID_TEMPLATE', 'Unknown launch template.');
      }
    } else {
      p.url = loopbackOrigin(p.url);
      requireCondition(!p.command && !p.args && !p.env, 'INVALID_DEFINITION', 'Attach deployments cannot include launch instructions.');
    }
    p.gateway ??= {};
    p.gateway.cookieAllowlist ??= [];
    requireCondition(Array.isArray(p.gateway.cookieAllowlist) && p.gateway.cookieAllowlist.every(x =>
      typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x) && !/^dsh|^hm_/i.test(x)),
      'INVALID_DEFINITION', 'Gateway cookie allowlist must contain explicit application cookie names.');
    p.gateway.allowAppAuthorization ??= false;
    requireCondition(typeof p.gateway.allowAppAuthorization === 'boolean', 'INVALID_DEFINITION', 'Invalid Authorization policy.');
  }
  return d;
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function expand(template, values) {
  return template.replace(/\{\{(dataDir|port|instanceId|runtimeId|appId|deploymentId|dataId)\}\}/g, (_, k) => String(values[k]));
}
