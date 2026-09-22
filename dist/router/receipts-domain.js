import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { receiptsGlobalSchema, receiptsGlobalInitial } from './receipts.js';

/** DSH-only: opened by the plugin entry (`src/dsh.js`), never by the library entry. */
export const receiptsDomainSpec = defineDomain({
  name:'hanamesh_router_receipts', version:1, layout:'single', tables:{},
  global:{ schema:receiptsGlobalSchema, initial:receiptsGlobalInitial },
});
