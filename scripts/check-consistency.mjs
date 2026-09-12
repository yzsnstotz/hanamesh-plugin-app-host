import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export function validateDeclaration(c){
  assert.equal(c.module,'app-host');assert.equal(c.version,1);assert.equal(typeof c.exempt,'boolean');
  assert(Array.isArray(c.groups));assert(Array.isArray(c.boundaries));
  if(c.exempt)assert(typeof c.why==='string'&&c.why.length>0);
  if(!c.groups.length)assert(typeof c.why==='string'&&c.why.length>0);
  const names=new Set();
  for(const g of c.groups){assert(typeof g.id==='string'&&!names.has(g.id));names.add(g.id);assert(g.name&&g.medium&&g.why&&g.test);assert(Array.isArray(g.facts)&&g.facts.length>=2);assert(g.facts.every(x=>typeof x==='string'&&x.length>0));}
  for(const b of c.boundaries){assert(typeof b.id==='string'&&!names.has(b.id));names.add(b.id);assert(b.name&&b.why&&b.test);assert(Array.isArray(b.sides)&&b.sides.length===2);assert(b.sides.includes(b.safeDirection));}
  return c;
}
if(process.argv[1]===new URL(import.meta.url).pathname){const c=validateDeclaration(JSON.parse(await readFile(new URL('../consistency.json',import.meta.url))));console.log(`X01 PASS: ${c.groups.length} groups, ${c.boundaries.length} boundaries`);}
