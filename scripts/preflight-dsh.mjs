import { preflight } from '@hanamesh/devkit';
import { validateDshPins } from './dsh-policy.mjs';
try { await preflight({validate:validateDshPins}); }
catch(error) { console.error(error.message); process.exitCode=2; }
