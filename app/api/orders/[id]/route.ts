import { api } from '@/lib/api';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return api.order((await context.params).id,request);}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){return api.deleteOrder(request,(await context.params).id);}
