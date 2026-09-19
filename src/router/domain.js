import { z } from 'zod';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';

const subject = z.union([
  z.object({ kind:z.literal('api-key'), ref:z.string() }),
  z.object({ kind:z.literal('provider'), providerId:z.string() }),
  z.object({ kind:z.literal('grant'), key:z.string() }),
]);
const ledger = z.object({ projectedVersion:z.number().optional(), pendingVersion:z.number().optional(),
  pendingInstanceId:z.string().optional(), removedForVersion:z.number().optional() });
export const routerDomainSpec = defineDomain({
  name:'hanamesh_router', version:1, layout:'single', tables:{},
  global:{ schema:z.object({ schema:z.literal(1), apps:z.record(z.string(),z.object({
    mode:z.enum(['managed','app-owned']), grants:z.record(z.string(),z.object({
      subject, model:z.string().optional(), grantedAt:z.string(), riskAcknowledged:z.boolean(),
    })), ledger:z.record(z.string(),ledger), revoked:z.record(z.string(),z.boolean()).optional(),
  })) }), initial:{ schema:1, apps:{} } },
});
