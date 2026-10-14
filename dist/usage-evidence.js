/**
 * AppHost's runtime/transport observations are Router diagnostics, not original
 * application presentation or successful-business facts (C-USAGE-LOCAL edition 1).
 * No verified public source for those facts is connected here. Keep Usage unknown
 * and leave the application available; never manufacture record input or time.
 */
import { requireCondition } from './errors.js';
import { createReceiptLedger, hourBucket } from './router/receipts.js';

export { hourBucket };
export const SOURCE_PLUGIN = '@hanamesh/dsh-app-host';
/** Shape inspection only; presence of a record method does not prove a source fact. */
export const duckSeat = value => value !== null && typeof value === 'object' && typeof value.record === 'function' ? value : null;
const TERMINAL = ['instance.stopped','instance.failed','instance.interrupted'];

/**
 * Preserve the existing adapter lifecycle and independent Router ledger. `seat`
 * and `sweepIntervalMs` remain accepted for compatibility, but no record call or
 * hourly reporting timer is created without a verified original fact source.
 * @param {{host:import('./manager.js').AppHost, seat:()=>unknown, receipts?:ReturnType<typeof createReceiptLedger>, logger?:{debug?:Function}, clock?:()=>number, sweepIntervalMs?:number}} options
 */
export function createUsageEvidence({ host, seat, receipts, logger, clock = Date.now, sweepIntervalMs = 60_000 }) {
  requireCondition(host && typeof host.subscribe === 'function' && typeof host.onActivity === 'function' && typeof host.packageName === 'function',
    'INVALID_HOST','createUsageEvidence needs an AppHost with subscribe/onActivity/packageName.');
  requireCondition(typeof seat === 'function','INVALID_SEAT','seat must be a function returning the optional usage service.');
  requireCondition(Number.isSafeInteger(sweepIntervalMs) && sweepIntervalMs >= 0,'INVALID_OPTIONS','sweepIntervalMs must be a non-negative integer.');
  const ledger = receipts ?? createReceiptLedger({ clock });
  let closed = false;
  // One capability diagnostic at registration; no app content, identity, token,
  // timestamp or service response is logged. Logger failures never block apps.
  try { logger?.debug?.('USAGE_FACT_UNAVAILABLE: no verified public presentation/success source; runtime readiness, transport and hourly receipts are diagnostics only.'); } catch {}

  const unsubscribeEvents = host.subscribe(event => {
    if (TERMINAL.includes(event.type)) ledger.forget(event.instanceId);
  });
  const unsubscribeActivity = host.onActivity(activity => {
    ledger.activity({ appId:activity.appId, instanceId:activity.instanceId, at:activity.at });
  });
  // Persist diagnostics only. In particular, do not send or mark pending rows
  // reported when an hour closes, on startup, stop, flush or disposal.
  const flush = () => closed ? Promise.resolve() : ledger.persist();
  return Object.freeze({
    flush,
    /** Settles this ledger's writes; it is not a Usage processing/delivery receipt. */
    settle: async () => { await ledger.persist(); },
    receipts: ledger,
    close() { if (closed) return; void flush(); closed = true; unsubscribeEvents(); unsubscribeActivity(); },
  });
}
