'use client';
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import {browserClient} from '@/lib/supabase/browser';
import {previewProducts} from '@/lib/catalog';
import {EMPTY_CART,type Cart,type Product,type Customer} from '@/lib/types';
export async function request<T>(url:string,body?:unknown):Promise<T>{
 const response=await fetch(url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');return data as T;
}
type ShopContext={products:Product[];cart:Cart;user:Customer|null;loading:boolean;connected:boolean;busy:boolean;notice:string;bagOpen:boolean;setBagOpen:(open:boolean)=>void;setNotice:(message:string)=>void;change:(id:string,quantity:number,operation?:'add'|'set')=>Promise<void>;refresh:()=>Promise<void>;signIn:(next?:string)=>Promise<void>;signOut:()=>Promise<void>};
const Context=createContext<ShopContext|null>(null);
export function ShopProvider({children}:{children:ReactNode}){
 const[products,setProducts]=useState(previewProducts),[cart,setCart]=useState(EMPTY_CART),[user,setUser]=useState<Customer|null>(null);
 const[loading,setLoading]=useState(true),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[bagOpen,setBagOpen]=useState(false);
 const refresh=useCallback(async()=>{
 const results=await Promise.allSettled([request<{products:Product[]}>('/api/products'),request<{cart:Cart}>('/api/cart'),request<{user:Customer|null}>('/api/session')]);
 if(results[0].status==='fulfilled'){setProducts(results[0].value.products);setConnected(true);}else setConnected(false);
 if(results[1].status==='fulfilled')setCart(results[1].value.cart);
 if(results[2].status==='fulfilled')setUser(results[2].value.user);
 setLoading(false);
 },[]);
 useEffect(()=>{void refresh();if(new URLSearchParams(window.location.search).has('auth_error'))setNotice('Google sign-in did not finish. Please try again.');},[refresh]);
 async function change(id:string,quantity:number,operation:'add'|'set'='set'){
 if(busy)return;setBusy(true);setNotice('');
 try{const data=await request<{cart:Cart}>('/api/cart',{product_id:id,quantity,operation});setCart(data.cart);if(operation==='add'){setBagOpen(true);setNotice('Added to your bag.');}}
 catch(e){setNotice(e instanceof Error?e.message:'Your bag could not be updated.');}finally{setBusy(false);}
 }
 async function signIn(next='/checkout'){setNotice('');try{const{error}=await browserClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback?next='+encodeURIComponent(next),scopes:'email profile'}});if(error)throw error;}catch{setNotice('Google sign-in is not ready yet. Please try again later.');}}
 async function signOut(){const{error}=await browserClient().auth.signOut();if(error){setNotice('Sign-out did not finish. Try again.');return;}setUser(null);window.location.assign('/');}
 return <Context.Provider value={{products,cart,user,loading,connected,busy,notice,bagOpen,setBagOpen,setNotice,change,refresh,signIn,signOut}}>{children}</Context.Provider>;
}
export function useShop(){const value=useContext(Context);if(!value)throw new Error('ShopProvider is required');return value;}
