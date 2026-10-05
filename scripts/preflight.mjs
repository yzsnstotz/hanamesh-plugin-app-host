import { preflight } from '@hanamesh/devkit';
import config from '../devkit.config.mjs';
await preflight(config.preflight);
