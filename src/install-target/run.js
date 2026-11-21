#!/usr/bin/env node
/** Run the AppHost installation contract against the bundled provider fixtures. */
import {runProviderSuite} from './suite.js';

if(process.argv.slice(2).join(' ')!=='provider'){
  process.stderr.write('usage: run.js provider\n');
  process.exitCode=2;
}else{
  const report=await runProviderSuite();
  process.stdout.write(JSON.stringify(report)+'\n');
  process.exitCode=report.fail===0?0:1;
}
