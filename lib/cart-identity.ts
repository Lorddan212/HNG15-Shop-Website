import {createHash,randomBytes} from 'node:crypto';
import type {Customer} from './types';

export type CartIdentityServices={
 guestToken:()=>Promise<string|undefined>;
 setGuestToken:(token:string)=>Promise<void>;
 accountCart:(userId:string,guestHash:string|null,newHash:string)=>Promise<string>;
};
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');

/** Only verified identity and a server-read HttpOnly cookie enter this resolver. */
export async function resolveCartToken(user:Customer|null,bearer:boolean,s:CartIdentityServices){
 const raw=bearer?undefined:await s.guestToken();
 const guest=raw&&/^[a-f0-9]{64}$/.test(raw)?raw:undefined;
 if(user)return s.accountCart(user.id,guest?hash(guest):null,hash(randomBytes(32).toString('hex')));
 const token=guest||randomBytes(32).toString('hex');
 if(!guest)await s.setGuestToken(token);
 return hash(token);
}
