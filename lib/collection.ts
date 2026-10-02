import type {Product} from './types';
export type SortOrder='curated'|'price-low'|'price-high'|'name';
export function collection(products:Product[],category:string,query:string,sort:SortOrder,page:number,pageSize=12){
 const search=query.trim().toLocaleLowerCase();
 const filtered=products.filter(p=>(category==='All pieces'||p.category===category)&&(!search||[p.name,p.subtitle,p.description,...p.specs].join(' ').toLocaleLowerCase().includes(search)));
 const sorted=[...filtered].sort((a,b)=>sort==='price-low'?a.price_kobo-b.price_kobo:sort==='price-high'?b.price_kobo-a.price_kobo:sort==='name'?a.name.localeCompare(b.name):a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(sorted.length/pageSize));const current=Math.min(Math.max(1,page),pages);
 return{items:sorted.slice((current-1)*pageSize,current*pageSize),total:sorted.length,pages,current,start:sorted.length?(current-1)*pageSize+1:0,end:Math.min(current*pageSize,sorted.length)};
}
