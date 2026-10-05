import {ShopError} from './commerce';
import type {Customer} from './types';

/** A supplied header takes precedence: never downgrade invalid credentials to cookies. */
export async function resolveCustomer(
 authorization:string|null,
 cookieUser:()=>Promise<Customer|null>,
 bearerUser:(token:string)=>Promise<Customer|null>,
):Promise<Customer|null>{
 if(authorization===null)return cookieUser();
 const match=/^Bearer ([^\s,]+)$/i.exec(authorization);
 if(!match||match[1].length>8192)throw new ShopError('Your sign-in has expired or is invalid. Sign in again.',401);
 const user=await bearerUser(match[1]);
 if(!user?.id||!user.email)throw new ShopError('Your sign-in has expired or is invalid. Sign in again.',401);
 return user;
}
