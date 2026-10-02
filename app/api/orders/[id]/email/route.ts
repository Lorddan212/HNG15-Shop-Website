import { api } from '@/lib/api';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api.retryEmail(request,(await context.params).id);}
