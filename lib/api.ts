import 'server-only';
import { handlers } from './handlers';
import { repository,requireDatabase,customer,cartToken } from './repository';
export const api=handlers({
 ready:requireDatabase,user:customer,token:cartToken,
 products:()=>repository.products(),cart:t=>repository.cart(t),
 changeCart:(t,i)=>repository.changeCart(t,i),checkout:(t,u,i)=>repository.checkout(t,u,i),
 orders:u=>repository.orders(u),order:(id,u)=>repository.order(id,u),confirmEmail:o=>repository.confirmEmail(o),deleteOrder:(id,u)=>repository.deleteOrder(id,u),
});
