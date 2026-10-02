'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Plus} from 'lucide-react';
import {useShop} from './shop-provider';
import {ProductArt} from './book-art';
import {formatMoney} from '@/lib/commerce';
export function ProductDetail({slug}:{slug:string}){
 const{products,change,busy,connected,loading}=useShop();const product=products.find(p=>p.slug===slug);const[quantity,setQuantity]=useState(1);
 if(!product)return <section className="page-shell wrap"><h1>Piece not found.</h1><Link href="/#collection">Back to the collection</Link></section>;
 return <section className="page-shell wrap"><Link className="back-link" href="/#collection">Back to the collection</Link><div className="product-detail"><ProductArt product={product}/><div><p className="section-kicker">{product.category}</p><h1>{product.name}</h1><p className="detail-price">{formatMoney(product.price_kobo)}</p><p className="detail-description">{product.description}</p><ul className="spec-list">{product.specs.map(s=><li key={s}>{s}</li>)}</ul><label className="quantity-label">Quantity<select value={quantity} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:Math.min(10,Math.max(product.stock,1))},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label><button className="primary-button full-width" disabled={busy||loading||!connected||product.stock===0} onClick={()=>void change(product.id,quantity,'add')}>{product.stock===0?'Sold out':'Add to bag'}<Plus size={18}/></button><p className="detail-delivery">Delivery ₦1,500 · Free on orders from ₦30,000</p><p className="muted small">Illustrated covers from the FolioVale collection.</p></div></div></section>;
}
