
import test from 'node:test';
import assert from 'node:assert/strict';
import {previewProducts} from '../lib/catalog';
import {collection} from '../lib/collection';
test('catalogue contains exactly the requested 25 notebooks, 18 planners and 10 sets',()=>{
 assert.equal(previewProducts.length,53);for(const[category,count]of Object.entries({Notebooks:25,Planners:18,Sets:10}))assert.equal(previewProducts.filter(p=>p.category===category).length,count);
 assert.equal(new Set(previewProducts.map(p=>p.id)).size,53);assert.equal(new Set(previewProducts.map(p=>p.slug)).size,53);
});
test('all catalogue pages can be reached without duplicates or missing pieces',()=>{
 const result=collection(previewProducts,'All pieces','','curated',1);
 const ids=Array.from({length:result.pages},(_,i)=>collection(previewProducts,'All pieces','','curated',i+1).items).flat().map(p=>p.id);
 assert.equal(ids.length,53);assert.equal(new Set(ids).size,53);
 assert.equal(collection(previewProducts,'Notebooks','','curated',3).items.length,1);
 assert.equal(collection(previewProducts,'Planners','','curated',2).items.length,6);
 assert.equal(collection(previewProducts,'Sets','','curated',1).items.length,10);
});
test('search handles case and whitespace and empty results safely',()=>{
 assert.equal(collection(previewProducts,'All pieces','  NOCTURNE  ','curated',1).items[0].slug,'nocturne');
 const none=collection(previewProducts,'All pieces','no-such-piece','curated',1);assert.equal(none.total,0);assert.equal(none.start,0);assert.equal(none.end,0);
});
test('price sorting does not mutate the source and pages are clamped',()=>{
 const initial=previewProducts.map(p=>p.id);
 const low=collection(previewProducts,'All pieces','','price-low',1).items;
 assert(low.every((p,i)=>i===0||p.price_kobo>=low[i-1].price_kobo));
 const high=collection(previewProducts,'All pieces','','price-high',1).items;
 assert(high.every((p,i)=>i===0||p.price_kobo<=high[i-1].price_kobo));
 assert.deepEqual(previewProducts.map(p=>p.id),initial);assert.equal(collection(previewProducts,'Sets','','curated',99).current,1);
});
