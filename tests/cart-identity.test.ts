import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveCartToken,type CartIdentityServices} from '../lib/cart-identity';
const user={id:'30000000-0000-4000-8000-000000000001',email:'test@example.invalid',name:'Test'};
test('anonymous browser retains its hashed HttpOnly guest identity',async()=>{
 const token='a'.repeat(64);
 const result=await resolveCartToken(null,false,{guestToken:async()=>token,setGuestToken:async()=>assert.fail('Unexpected rotation'),accountCart:async()=>assert.fail('Unexpected account cart')});
 assert.equal(result,createHash('sha256').update(token).digest('hex'));
});
test('new and malformed guest cookies are replaced with random server tokens',async()=>{
 for(const token of [undefined,'invalid']){
  let saved='';const result=await resolveCartToken(null,false,{guestToken:async()=>token,setGuestToken:async value=>{saved=value;},accountCart:async()=>assert.fail('Unexpected account cart')});
  assert.match(saved,/^[a-f0-9]{64}$/);assert.equal(result,createHash('sha256').update(saved).digest('hex'));assert.notEqual(saved,result);
 }
});
test('web sign-in passes verified owner and guest hash for merge; mobile resolves the same account without cookies',async()=>{
 const calls:Array<{owner:string;guest:string|null}>=[];
 const shared:CartIdentityServices={guestToken:async()=>'a'.repeat(64),setGuestToken:async()=>assert.fail('Account token must never become a cookie'),accountCart:async(owner,guest,newHash)=>{assert.match(newHash,/^[a-f0-9]{64}$/);calls.push({owner,guest});return 'account-server-token';}};
 const web=await resolveCartToken(user,false,shared);
 const mobile=await resolveCartToken(user,true,{...shared,guestToken:async()=>assert.fail('Bearer requests must ignore browser cookies')});
 assert.equal(web,mobile);assert.equal(calls[0].owner,user.id);assert.equal(calls[0].guest,createHash('sha256').update('a'.repeat(64)).digest('hex'));assert.equal(calls[1].guest,null);
});
