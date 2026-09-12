/** Workspace-side SDK only. Never inject this module into an application iframe. */
export class WorkspaceAppClient {
  constructor({origin=globalThis.location?.origin,fetch:fetcher=globalThis.fetch,headers=()=>({})}={}) {
    const parsed=new URL(origin);
    if(parsed.origin!==origin||parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||!parsed.port)throw new TypeError('Expected exact loopback workspace origin.');
    if(typeof fetcher!=='function'||typeof headers!=='function')throw new TypeError('fetch and host headers provider are required.');
    this.origin=origin;this.fetcher=fetcher;this.headers=headers;
  }
  async request(path,input,signal){
    const response=await this.fetcher(this.origin+path,{method:input===undefined?'GET':'POST',credentials:'same-origin',redirect:'error',signal,
      headers:{...await this.headers(),...(input===undefined?{}:{'content-type':'application/json','x-hanamesh-client':'workspace-v1'})},
      ...(input===undefined?{}:{body:JSON.stringify(input)})});
    const body=await response.json();
    if(!response.ok){const error=new Error(body.error?.message??'App-host request failed.');error.code=body.error?.code??'HTTP_ERROR';error.details=body.error?.details;error.status=response.status;throw error;}
    return body;
  }
  list(signal){return this.request('/hanamesh/apps',undefined,signal);}
  open(input,signal){return this.request('/apps/open',input,signal);}
  resume(lease,signal){return this.request('/apps/resume',lease,signal);}
  recoverView(input,signal){return this.request('/apps/recover',input,signal);}
  close(lease,signal){return this.request('/apps/close',lease,signal);}
  heartbeat(lease,signal){return this.request('/apps/heartbeat',lease,signal);}
  stop(instanceId,{confirm=false,signal}={}){return this.request('/apps/stop',{instanceId,confirm},signal);}
  events(after=0,signal){if(!Number.isSafeInteger(after)||after<0)throw new TypeError('Invalid event cursor.');return this.request(`/apps/events?after=${after}`,undefined,signal);}
  // A bounded explicit operation; never retries a new Open without the receipt's token.
  async waitUntilReady(receipt,{timeoutMs=15_000,pollMs=100,signal}={}){
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(pollMs)||pollMs<20)throw new TypeError('Invalid polling bounds.');
    const deadline=Date.now()+timeoutMs;let current=receipt;
    while(current.instance.status!=='ready'){
      signal?.throwIfAborted();
      if(['failed','stopped','interrupted','stopping'].includes(current.instance.status))throw new Error(`Instance is ${current.instance.status}.`);
      if(Date.now()>=deadline)throw new Error('Readiness wait timed out; use the receipt to close or inspect this view.');
      await new Promise(resolve=>setTimeout(resolve,pollMs));
      const listed=await this.list(signal),found=listed.instances.find(i=>i.id===receipt.instance.id);
      if(!found)throw new Error('Persisted instance is missing.');
      if(found.status==='ready')current=await this.resume({viewId:receipt.lease.viewId,leaseToken:receipt.leaseToken},signal);
      else current={...current,instance:found};
    }
    return current;
  }
}
