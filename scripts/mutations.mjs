import { runMutations } from '@hanamesh/devkit';
import { runAppHostMutations } from '../devkit.config.mjs';
await runAppHostMutations(runMutations);

// Cross-module public consumer contract: fault only temporary normal Market copies.
const {runMarketOwnerMutations}=await import('./market-owner-policy.mjs');
await runMarketOwnerMutations();
