'use client';
import {createContext,useContext,useEffect,useRef,useState,useCallback,type ReactNode} from 'react';
import {safeNext} from '@/lib/commerce';
import {browserClient} from '@/lib/supabase/browser';
import {previewProducts} from '@/lib/catalog';
import {createCartReconciler,createCartRealtimeSync,watchCartActivity} from '@/lib/cart-realtime';
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
 const reads=useRef<ReturnType<typeof createCartReconciler>|null>(null);
 const subscription=useRef<ReturnType<typeof createCartRealtimeSync>>(null);
 const identity=useRef<string|null>(null),alive=useRef(false),mutation=useRef(false),refreshVersion=useRef(0);

 const refresh=useCallback(async()=>{
   const version=++refreshVersion.current;
   const results=await Promise.allSettled([request<{products:Product[]}>('/api/products'),request<{user:Customer|null}>('/api/session')]);
   if(!alive.current||version!==refreshVersion.current)return;
   if(results[0].status==='fulfilled'){setProducts(results[0].value.products);setConnected(true);}else setConnected(false);
   if(results[1].status==='fulfilled'){
     const next=results[1].value.user;
     if(identity.current!== (next?.id??null)){
       subscription.current?.stop();subscription.current=null;
       reads.current?.invalidate();setCart(EMPTY_CART);identity.current=next?.id??null;
     }
     setUser(next);
   }
   await reads.current?.reconcile();
   if(alive.current)setLoading(false);
 },[]);
 useEffect(()=>{
   alive.current=true;
   const reader=createCartReconciler(async()=>(await request<{cart:Cart}>('/api/cart')).cart,setCart);
   reads.current=reader;
   void refresh();
   if(new URLSearchParams(window.location.search).has('auth_error'))setNotice('Google sign-in did not finish. Please try again.');
   let authCleanup: (()=>void)|undefined;
   let authTimer:ReturnType<typeof setTimeout>|undefined;
   try{
     const {data}=browserClient().auth.onAuthStateChange((event,session)=>{
       if(!alive.current||event==='INITIAL_SESSION')return;
       const nextId=session?.user.id??null;
       if(nextId!==identity.current){
         ++refreshVersion.current;reader.invalidate();
         subscription.current?.stop();subscription.current=null;
         identity.current=nextId;setUser(null);setCart(EMPTY_CART);
       }
       // Defer API work until Supabase releases the auth callback lock.
       if(authTimer)clearTimeout(authTimer);
       authTimer=setTimeout(()=>{if(alive.current)void refresh();},0);
     });
     authCleanup=()=>data.subscription.unsubscribe();
   }catch{/* Public catalogue browsing remains available without auth configuration. */}
   return ()=>{
     alive.current=false;++refreshVersion.current;
     if(authTimer)clearTimeout(authTimer);
     authCleanup?.();subscription.current?.stop();subscription.current=null;reader.stop();reads.current=null;
   };
 },[refresh]);

 const userId=user?.id??null;
 useEffect(()=>{
   if(!userId)return;
   let stopActivity:(()=>void)|undefined;
   try{
     const sync=createCartRealtimeSync({client:browserClient(),userId,reconcile:()=>identity.current===userId?reads.current?.reconcile()??Promise.resolve():Promise.resolve()});
     subscription.current=sync;
     stopActivity=watchCartActivity(document,window,()=>sync?.reconcileNow());
     return ()=>{stopActivity?.();sync?.stop();if(subscription.current===sync)subscription.current=null;};
   }catch{/* Ordinary refresh remains the fallback when Realtime is unavailable. */}
   return ()=>stopActivity?.();
 },[userId]);

 async function change(id:string,quantity:number,operation:'add'|'set'='set'){
   if(mutation.current)return;
   mutation.current=true;setBusy(true);setNotice('');
   const owner=identity.current,reader=reads.current;
   reader?.beginMutation();
   try{
     const data=await request<{cart:Cart}>('/api/cart',{product_id:id,quantity,operation});
     if(alive.current&&identity.current===owner){
       setCart(data.cart);
       if(operation==='add'){setBagOpen(true);setNotice('Added to your cart.');}
     }
   }catch(e){if(alive.current&&identity.current===owner)setNotice(e instanceof Error?e.message:'Your cart could not be updated.');}
   finally{mutation.current=false;if(alive.current)setBusy(false);void reader?.endMutation();}
 }
 async function signIn(next='/'){setNotice('');try{
 // This short-lived cookie holds only an allowlisted page path, never credentials.
 document.cookie='fv_auth_next='+safeNext(next)+'; Path=/auth/callback; Max-Age=600; SameSite=Lax'+(window.location.protocol==='https:'?'; Secure':'');
 const{error}=await browserClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback',scopes:'email profile'}});if(error)throw error;}catch{setNotice('Google sign-in is unavailable right now. Please try again.');}}
 async function signOut(){try{const{error}=await browserClient().auth.signOut();if(error)throw error;subscription.current?.stop();reads.current?.invalidate();setUser(null);window.location.assign('/');}catch{setNotice('Sign-out did not finish. Try again.');}}
 return <Context.Provider value={{products,cart,user,loading,connected,busy,notice,bagOpen,setBagOpen,setNotice,change,refresh,signIn,signOut}}>{children}</Context.Provider>;
}
export function useShop(){const value=useContext(Context);if(!value)throw new Error('ShopProvider is required');return value;}
