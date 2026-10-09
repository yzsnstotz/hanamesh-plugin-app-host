export interface CatalogSuiteReport {suite:'catalog-provider'|'catalog-consumer';evidence:'SOURCE';contract:'catalog-major-1';total:number;pass:number;fail:number;results:Array<{id:string;outcome:'pass'|'fail';detail?:string}>;}
export function runCatalogProviderSuite():Promise<CatalogSuiteReport>;
/** Defaults to the actual AppHost catalog loader, with explicitly SOURCE transport fixture responses. */
export function runCatalogConsumerSuite():Promise<CatalogSuiteReport>;
