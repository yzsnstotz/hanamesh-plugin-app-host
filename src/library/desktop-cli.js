/** Invoke the inspected upstream Desktop CLI export; the ordinary CLI refuses the reserved profile. */
import {pathToFileURL} from 'node:url';
const [entry,runtimeDir,supportDir,...args]=process.argv.slice(2);
const {runDesktopCli}=await import(pathToFileURL(entry).href);
if(typeof runDesktopCli!=='function')throw new Error('DSH_BINDING_REQUIRED: Desktop runDesktopCli export is unavailable.');
process.argv=[process.execPath,entry,...args];
await runDesktopCli(runtimeDir,supportDir);
