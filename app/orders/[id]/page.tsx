import {OrderDetail} from '@/components/orders';
export const metadata={title:'Order details'};
export default async function Page({params}:{params:Promise<{id:string}>}){return <OrderDetail id={(await params).id}/>;}
