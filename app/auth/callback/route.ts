import {authClient} from '@/lib/supabase/server';
import {finishSignIn} from '@/lib/auth-callback';
import {cookies} from 'next/headers';
export async function GET(request:Request){
 const jar=await cookies();
 const destination=jar.get('fv_auth_next')?.value;
 const response=await finishSignIn(request,async code=>{const{error}=await(await authClient()).auth.exchangeCodeForSession(code);return !error;},destination);
 jar.set('fv_auth_next','',{path:'/auth/callback',maxAge:0,sameSite:'lax',secure:new URL(request.url).protocol==='https:'});
 return response;
}
