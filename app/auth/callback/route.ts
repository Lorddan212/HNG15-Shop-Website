import {authClient} from '@/lib/supabase/server';
import {finishSignIn} from '@/lib/auth-callback';
export async function GET(request:Request){return finishSignIn(request,async code=>{const{error}=await(await authClient()).auth.exchangeCodeForSession(code);return !error;});}
