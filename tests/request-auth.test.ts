import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCustomer} from '../lib/request-auth';
const user={id:'30000000-0000-4000-8000-000000000001',email:'test@example.invalid',name:'Test'};
test('cookie and validated bearer authentication return the same customer',async()=>{
 assert.deepEqual(await resolveCustomer(null,async()=>user,async()=>assert.fail('Unexpected bearer validation')),user);
 assert.deepEqual(await resolveCustomer('Bearer valid',async()=>assert.fail('Bearer must not read cookies'),async token=>{assert.equal(token,'valid');return user;}),user);
});
test('invalid or expired Authorization cannot fall back to valid cookies',async()=>{
 for(const value of ['', 'Basic abc', 'Bearer', 'Bearer invalid', 'Bearer expired', 'Bearer a b','Bearer a,b']){
  await assert.rejects(resolveCustomer(value,async()=>assert.fail('Downgrade to cookies'),async()=>null),{status:401});
 }
});
test('an unverified token payload never supplies identity',async()=>{
 await assert.rejects(resolveCustomer('Bearer forged.payload.signature',async()=>null,async()=>null),{status:401});
 assert.equal(await resolveCustomer(null,async()=>null,async()=>user),null);
});
