import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { z as zod } from 'zod';

const source=zod.object({manifestUrl:zod.string(),enabled:zod.boolean()});
export const libraryDomainSpec=defineDomain({name:'hanamesh_library',version:1,layout:'single',tables:{},global:{
  schema:zod.object({schema:zod.literal(1),revision:zod.number().int().nonnegative(),sources:zod.array(source)}),
  initial:{schema:1,revision:0,sources:[]},
}});
