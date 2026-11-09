import assert from 'node:assert/strict';
import {settle} from './client-ui-harness.mjs';
export async function acknowledgeInstall(harness){
 harness=harness.h??harness;
 if(typeof harness.acknowledgeInstall==='function'){await harness.acknowledgeInstall();return;}
 const checkbox=harness.find(node=>node.type==='input'&&node.props['aria-label']==='我已核对来源与安装目标');
 assert(checkbox,'installation must expose its review acknowledgement');
 checkbox.props.onChange({currentTarget:{checked:true}});await settle();
}
