import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { z as zod } from 'zod';

const source=zod.object({manifestUrl:zod.string(),enabled:zod.boolean()});
export const libraryDomainSpec=defineDomain({name:'hanamesh_library',version:1,layout:'single',tables:{},global:{
  schema:zod.object({schema:zod.literal(1),revision:zod.number().int().nonnegative(),sources:zod.array(source),
    /** Website handoff settings saved from the library settings page; absent → plugin config / proposed defaults. */
    handoff:zod.object({enabled:zod.boolean(),ports:zod.array(zod.number().int()),allowedOrigins:zod.array(zod.string()),ttlMs:zod.number().int(),pollMs:zod.number().int().min(1).max(2_147_483_647).optional()}).optional()}),
  initial:{schema:1,revision:0,sources:[]},
}});
