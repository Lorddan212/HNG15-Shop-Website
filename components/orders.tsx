'use client';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import {Check,ArrowRight,Package,Mail,Trash2} from 'lucide-react';
import {useShop,request} from './shop-provider';
import {formatMoney} from '@/lib/commerce';
import type {Order} from '@/lib/types';
const date=(value:string)=>new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value));
export function OrderHistory(){
 const {user,loading,signIn,setNotice}=useShop();
 const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(''),[fetching,setFetching]=useState(true);
 const [selected,setSelected]=useState<Order|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  let active=true;
  setOrders([]);setError('');setSelected(null);
  if(!user){setFetching(false);return;}
  setFetching(true);
  request<{orders:Order[]}>('/api/orders').then(d=>{if(active)setOrders(d.orders);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setFetching(false);});
  return ()=>{active=false;};
 },[user]);
 useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
 async function removeOrder(){
  if(!selected||deleting)return;
  setDeleting(true);setDeleteError('');
  try{
   const response=await fetch('/api/orders/'+selected.id,{method:'DELETE'});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'This order could not be removed. Please try again.');
   setOrders(current=>current.filter(order=>order.id!==selected.id));
   setSelected(null);setNotice('Order deleted from your history.');
  }catch(e){setDeleteError(e instanceof Error?e.message:'This order could not be removed. Please try again.');}
  finally{setDeleting(false);}
 }
 return <section className="wrap page-shell orders-page">
  <div className="section-heading"><div><p className="section-kicker">Your paper trail</p><h1>Your orders.</h1></div></div>
  {loading||fetching?<p>Loading your orders…</p>:!user?<div className="empty-panel"><Package size={40}/><h2>Your collection starts here.</h2><p>Sign in with Google to see your order history.</p><button className="google-button" onClick={()=>void signIn('/orders')}><span className="google-g">G</span>Continue with Google</button></div>:error?<p role="alert" className="form-error">{error}</p>:orders.length===0?<div className="empty-panel"><h2>No orders to show.</h2><p>Explore the collection to start your next order.</p><Link className="primary-button" href="/#collection">Explore the collection</Link></div>:<div className="order-list">{orders.map(order=><div className="order-history-entry" key={order.id}>
   <Link className="order-row" href={'/orders/'+order.id}><div><strong>{order.reference}</strong><p>{date(order.created_at)} · {order.items.reduce((n,i)=>n+i.quantity,0)} items</p></div><span className="status-chip">Order placed</span><strong>{formatMoney(order.total_kobo)}</strong><ArrowRight size={19}/></Link>
   <button className="delete-order-button" aria-label={'Delete '+order.reference+' from history'} onClick={()=>{setDeleteError('');setSelected(order);}}><Trash2 size={16} aria-hidden="true"/>Delete from history</button>
  </div>)}</div>}
  <dialog ref={dialog} className="delete-order-dialog" aria-labelledby="delete-order-title" aria-describedby="delete-order-description" onCancel={event=>{if(deleting)event.preventDefault();else setSelected(null);}}>
   <p className="section-kicker">Your order history</p><h2 id="delete-order-title">Delete this order from history?</h2>
   <p id="delete-order-description">{selected?.reference} will no longer appear in your account. This does not cancel the order. The shop retains its order record, and you cannot restore it from this page.</p>
   {deleteError&&<p role="alert" className="form-error">{deleteError}</p>}
   <div className="delete-order-actions"><button autoFocus className="quiet-button" disabled={deleting} onClick={()=>setSelected(null)}>Keep order</button><button className="primary-button" disabled={deleting} onClick={()=>void removeOrder()}>{deleting?'Deleting…':'Delete from history'}</button></div>
  </dialog>
 </section>;
}
export function OrderDetail({id}:{id:string}){
 const{user,loading,signIn}=useShop();const[order,setOrder]=useState<Order|null>(null),[error,setError]=useState(''),[emailMessage,setEmailMessage]=useState(''),[retrying,setRetrying]=useState(false);
 useEffect(()=>{if(user)request<{order:Order}>('/api/orders/'+id).then(d=>setOrder(d.order)).catch(e=>setError(e.message));},[user,id]);
 async function retry(){setRetrying(true);try{const data=await request<{email_status:Order['email_status']}>('/api/orders/'+id+'/email',{});setOrder(o=>o?{...o,email_status:data.email_status}:o);setEmailMessage(data.email_status==='accepted'?'Your confirmation email was accepted for delivery. Check your inbox or spam folder. Your order is also saved in your account.':'Your order is saved. Email is still pending; please wait a minute before retrying.');}catch(e){setEmailMessage(e instanceof Error?e.message:'Please try again later.');}finally{setRetrying(false);}}
 if(loading)return <div className="wrap page-shell">Loading your order…</div>;
 if(!user)return <section className="wrap page-shell empty-panel"><h1>Sign in to view your order.</h1><button className="google-button" onClick={()=>void signIn('/orders')}>Continue with Google</button></section>;
 if(error)return <section className="wrap page-shell"><p className="form-error" role="alert">{error}</p><Link href="/orders">Back to your orders</Link></section>;
 if(!order)return <div className="wrap page-shell">Loading your order…</div>;
 return <section className="wrap page-shell confirmation-page"><div className="confirmation-heading"><span className="success-mark"><Check size={28}/></span><p className="section-kicker">Order {order.reference}</p><h1>Thank you for your order.</h1><p>Your order has been recorded, {order.full_name.split(' ')[0]}.</p><span className="status-chip">Order placed · Pay on delivery</span></div>
 <div className="confirmation-grid"><div className="order-summary"><h2>Your order</h2>{order.items.map(item=><div className="receipt-item" key={item.product_id}><div><strong>{item.product_name}</strong><p>Qty {item.quantity} · {formatMoney(item.unit_price_kobo)} each</p></div><strong>{formatMoney(item.quantity*item.unit_price_kobo)}</strong></div>)}<div className="summary-totals"><p><span>Delivery</span><span>{order.shipping_kobo?formatMoney(order.shipping_kobo):'Free'}</span></p><p className="total-line"><strong>Total</strong><strong>{formatMoney(order.total_kobo)}</strong></p></div></div><div className="confirmation-details"><h2>Delivery details</h2><p>{order.full_name}<br/>{order.address}<br/>{order.city}, {order.state}<br/>{order.phone}</p>{order.notes&&<p className="delivery-note">{order.notes}</p>}<h2><Mail size={19}/> Confirmation email</h2><p>{order.email_status==='accepted'?'Your confirmation email was accepted for delivery. Check your inbox or spam folder. Your order is also saved in your account.':(order.email_status==='sending'?'Your confirmation email is being processed for ':'Your order is saved. A confirmation email is pending for ')+order.email+'.'}</p>{['queued','failed'].includes(order.email_status)&&<button className="text-link" disabled={retrying} onClick={()=>void retry()}>{retrying?'Trying…':'Retry confirmation email'}</button>}{emailMessage&&<p role="status" className="small">{emailMessage}</p>}</div></div><p className="demo-note">Pay on delivery. No online payment is collected at checkout.</p><div className="confirmation-actions"><Link className="primary-button" href="/#collection">Back to the collection <ArrowRight size={18}/></Link><Link className="text-link" href="/orders">View all orders</Link></div></section>;
}
