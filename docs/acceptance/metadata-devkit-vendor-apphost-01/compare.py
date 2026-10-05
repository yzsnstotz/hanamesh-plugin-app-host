from pathlib import Path
import json,hashlib,subprocess,tarfile,base64
RUN=Path('/Users/yzliu/.cache/hanamesh-runs/METADATA-DEVKIT-VENDOR-APPHOST-01'); W=RUN/'hanamesh-plugin-app-host';EV=RUN/'_evidence';BASE='0e36611d5f0eeaac154bd69023d614b31fdc63b1'
def sha(data):return hashlib.sha256(data).hexdigest()
def old(name):return subprocess.check_output(['git','show',BASE+':'+name],cwd=W)
pkg=json.loads((W/'package.json').read_text()); prior=json.loads(old('package.json'))
normalized=json.loads(json.dumps(pkg));normalized['version']=prior['version'];normalized['peerDependencies']['@hanamesh/devkit']=prior['peerDependencies']['@hanamesh/devkit'];normalized['devDependencies']['@hanamesh/devkit']=prior['devDependencies']['@hanamesh/devkit'];assert normalized==prior
lock=json.loads((W/'package-lock.json').read_text());oldlock=json.loads(old('package-lock.json'))
assert set(lock['packages'])==set(oldlock['packages'])
assert {k:v for k,v in lock['packages'].items() if k not in ['', 'node_modules/@hanamesh/devkit']}=={k:v for k,v in oldlock['packages'].items() if k not in ['', 'node_modules/@hanamesh/devkit']}
newvendor=W/'vendor/hanamesh-devkit-0.1.0-rc.2.tgz';canonical=Path('/Users/yzliu/.cache/hanamesh-runs/METADATA-DEVKIT-01/hanamesh-devkit-0.1.0-rc.2.tgz');assert newvendor.read_bytes()==canonical.read_bytes()
assert lock['packages']['node_modules/@hanamesh/devkit']['integrity']=='sha512-'+base64.b64encode(hashlib.sha512(newvendor.read_bytes()).digest()).decode()
licenses=json.loads((W/'docs/LICENSES.json').read_text());provenance=json.loads((W/'docs/PROVENANCE.json').read_text());dev=provenance['developmentArtifacts']['@hanamesh/devkit'];assert dev['configuration']['sha256']==sha((W/'devkit.config.mjs').read_bytes());assert dev['lockfile']['sha256']==sha((W/'package-lock.json').read_bytes());assert dev['integrity']==lock['packages']['node_modules/@hanamesh/devkit']['integrity']
with tarfile.open(newvendor) as t:
 assert licenses['components']['@hanamesh/devkit']['licenseNotice'].encode()==t.extractfile('package/LICENSE').read()
 assert licenses['components']['@hanamesh/devkit']['distributionRecord'].encode()==t.extractfile('package/LICENSE_RECORD.md').read()
oldlicense=json.loads(old('docs/LICENSES.json'));assert licenses['components']['@hanamesh/lib-provision']==oldlicense['components']['@hanamesh/lib-provision'];assert provenance['bundledArtifacts']==json.loads(old('docs/PROVENANCE.json'))['bundledArtifacts']
protected=[];basehash=json.loads((EV/'baseline-files.json').read_text())
allowed={'README.md','package.json','package-lock.json','devkit.config.mjs','tests/package-compat.test.mjs','docs/LICENSES.json','docs/PROVENANCE.json'}
for name,digest in basehash.items():
 if name not in allowed:assert sha((W/name).read_bytes())==digest,name;protected.append(name)
for name in ['devkit.config.mjs','tests/package-compat.test.mjs']:
 current=(W/name).read_bytes().replace(b'0.1.0-rc.2',b'0.1.0-rc.1').replace(b'ae815e589c3e5a573e407da5c982bb0fc8df15b57683ebbfaccd828d9dd588e0',b'3cf0b621ca2950fbe21c114d5b31ac1a55f97a67eb0a2dada77fb2d3bf2cb6ff');assert current==old(name),name
(EV/'preservation.json').write_text(json.dumps({'protectedByteIdentical':protected,'allOriginalAssertionsAfterMetadataNormalization':True,'allOriginalDependencyKeysAndNonDevkitLockEntries':True,'newDependencies':0,'newPeers':0,'canonicalVendorByteIdentical':True,'canonicalDistributionRecordsByteIdentical':True},indent=2)+'\n')
new=RUN/'artifacts/hanamesh-dsh-app-host-0.2.0-rc.6.tgz'
if new.exists():
 oldtgz=EV/'rollback/hanamesh-dsh-app-host-0.2.0-rc.5.tgz';result=[]
 with tarfile.open(oldtgz) as a,tarfile.open(new) as b:
  aa={x.name:x for x in a.getmembers()};bb={x.name:x for x in b.getmembers()};assert aa.keys()==bb.keys()
  fields=['mode','uid','gid','mtime','size','uname','gname','type','linkname','devmajor','devminor','pax_headers']
  for name in aa:
   x,y=aa[name],bb[name];adata=a.extractfile(x).read();bdata=b.extractfile(y).read();headers={f:{'old':getattr(x,f).decode() if isinstance(getattr(x,f),bytes) else getattr(x,f),'new':getattr(y,f).decode() if isinstance(getattr(y,f),bytes) else getattr(y,f)} for f in fields if getattr(x,f)!=getattr(y,f)}
   changed=adata!=bdata;assert not changed or name in ['package/package.json','package/README.md','package/docs/LICENSES.json','package/docs/PROVENANCE.json'],name
   assert not set(headers)-{'size'},name
   result.append({'name':name,'oldSha256':sha(adata),'newSha256':sha(bdata),'payloadChanged':changed,'headerDifferences':headers})
  assert sum(x['payloadChanged'] for x in result)==4
  for name in bb:
   if name.startswith('package/dist/provision/'):
    assert not next(x['payloadChanged'] for x in result if x['name']==name)
 (EV/'archive-comparison.json').write_text(json.dumps({'oldSha256':sha(oldtgz.read_bytes()),'newSha256':sha(new.read_bytes()),'oldMemberCount':len(aa),'newMemberCount':len(bb),'members':result},indent=2)+'\n')
print('Metadata closure and source byte preservation confirmed; archive compared if present')
