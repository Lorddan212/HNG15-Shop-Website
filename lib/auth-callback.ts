import {safeNext} from './commerce';
export async function finishSignIn(request:Request,exchange:(code:string)=>Promise<boolean>){
 const url=new URL(request.url);const code=url.searchParams.get('code');
 try{if(code&&await exchange(code))return Response.redirect(new URL(safeNext(url.searchParams.get('next')),url.origin),303);}catch{/* Return to the storefront with a useful sign-in message. */}
 return Response.redirect(new URL('/?auth_error=1',url.origin),303);
}
