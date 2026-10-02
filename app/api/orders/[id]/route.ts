import { api } from '@/lib/api';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){return api.order((await context.params).id);}
