import test from 'node:test';
import assert from 'node:assert/strict';
import {finishSignIn} from '../lib/auth-callback';
test('auth callback exchanges code and redirects only to allowed shop pages',async()=>{
 const r=await finishSignIn(new Request('https://shop.example/auth/callback?code=test&next=/checkout'),async code=>code==='test');
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),'https://shop.example/checkout');
 const safe=await finishSignIn(new Request('https://shop.example/auth/callback?code=test&next=https://attacker.example'),async()=>true);
 assert.equal(safe.headers.get('location'),'https://shop.example/');
});
test('missing, rejected or failed auth exchanges return a sign-in error',async()=>{
 for(const request of [new Request('https://shop.example/auth/callback'),new Request('https://shop.example/auth/callback?code=bad')]){
 const r=await finishSignIn(request,async()=>false);assert.equal(r.headers.get('location'),'https://shop.example/?auth_error=1');
 }
 const failed=await finishSignIn(new Request('https://shop.example/auth/callback?code=test'),async()=>{throw Error('network');});assert.match(failed.headers.get('location')!,/auth_error/);
});
