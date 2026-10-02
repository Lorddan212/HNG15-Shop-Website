import type { CSSProperties } from 'react';
import type { Product } from '@/lib/types';
export function Book({product,small=false}:{product:Pick<Product,'color'|'cover_label'|'category'>;small?:boolean}) {
 return <div className={'book finish-'+(product.cover_label.length%4)+' '+(small?'book-small':'')} style={{'--cover':product.color} as CSSProperties} aria-hidden="true">
 <div className="book-face"><span className="book-brand">foliovale</span><div className="cover-emblem"><span/><span/><span/></div><span className={"book-title "+(product.cover_label.length>12?"long-title":"")}>{product.cover_label}</span><span className="book-edition">{product.category==='Planners'?'Make room for your days':'A place for your thoughts'}</span></div></div>;
}
export function ProductArt({product}:{product:Product}) {return <div className={'product-art art-'+product.slug} data-category={product.category} data-size={product.specs[0]?.split(' · ')[0]} role="img" aria-label={product.name+' illustrated cover'}><Book product={product}/>{product.category==='Sets'&&<Book product={{color:'#d3bda2',cover_label:'pocket notes',category:'Notebooks'}} small/>}</div>;}
