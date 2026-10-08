#!/usr/bin/env node
/**
 * Install-target contract suite runner.
 *   node <package>/dist/install-target/run.js provider
 *   node <package>/dist/install-target/run.js consumer [--module <file-or-specifier>] [--export <name>] [--unversioned]
 * Without --module the bundled reference consumer fixture is used. The module export is a consumer object or a
 * zero-argument factory returning one. Prints one JSON report per suite; exits 1 when any case fails.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runProviderSuite, runConsumerSuite, runChainSuite } from './suite.js';
import { createReferenceConsumer } from './fixtures/reference-consumer.js';

const [mode,...rest]=process.argv.slice(2);
const option=name=>{const index=rest.indexOf(name);return index<0?undefined:rest[index+1];};
async function consumer(){
  const specifier=option('--module');
  if(!specifier)return createReferenceConsumer(rest.includes('--unversioned')?{contractVersion:undefined}:{});
  const loaded=await import(/^[./]/u.test(specifier)?pathToFileURL(resolve(specifier)).href:specifier);
  const value=loaded[option('--export')??'default'];
  return typeof value==='function'?await value():value;
}
const reports=[];
if(mode==='provider')reports.push(await runProviderSuite());
else if(mode==='consumer'){const subject=await consumer();reports.push(await runConsumerSuite(subject),await runChainSuite(subject));}
else{process.stderr.write('usage: run.js provider | consumer [--module <file>] [--export <name>] [--unversioned]\n');process.exit(2);}
for(const report of reports)process.stdout.write(JSON.stringify(report)+'\n');
process.exitCode=reports.every(report=>report.fail===0)?0:1;
