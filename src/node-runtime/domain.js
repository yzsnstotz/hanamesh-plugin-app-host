import {defineDomain} from '@deepseek-ai/dsh-storage-domain';
import {z} from 'zod';
export const nodeRuntimeDomainSpec=defineDomain({name:'hanamesh_node_runtime',version:1,layout:'single',tables:{},global:{
 schema:z.object({schema:z.literal(1),revision:z.number().int().nonnegative(),settings:z.record(z.string(),z.unknown()).nullable(),active:z.record(z.string(),z.unknown()).nullable()}),
 initial:{schema:1,revision:0,settings:null,active:null},
}});
