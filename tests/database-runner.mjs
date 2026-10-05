// Disposable PostgreSQL-compatible check. Never loads .env.local or contacts Supabase.
// Install @electric-sql/pglite under ignored output/db-check; see README.
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '../output/db-check/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try{
 await db.exec(`
  create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key,email text,aud text,role text);
  create function auth.uid() returns uuid language sql stable as
   $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to anon,authenticated,service_role;
 `);
 for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  console.log('Applied in disposable database:',name);
 }
 for(const name of ['database.sql','shared-carts.sql']){
  const results=await db.exec(await readFile('tests/'+name,'utf8'));
  for(const result of results)for(const row of result.rows)if(row.result)console.log(row.result);
 }
 console.log('Both database test scripts passed; fixtures rolled back. Live database unchanged.');
}finally{await db.close();}
