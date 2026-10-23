import {Pool} from 'pg';
import {PostgresStore} from './store.mjs';
import {vaultKey} from './passwords.mjs';
import {AuthService} from './auth.mjs';
import {createAuthServer} from './http.mjs';

try{
  if(!process.env.PGPASSWORD)throw new Error('PostgreSQL password missing.');
  const store=new PostgresStore(new Pool({host:process.env.PGHOST??'db',port:Number(process.env.PGPORT??5432),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD,max:4,connectionTimeoutMillis:5000}));
  const service=new AuthService(store,vaultKey(process.env.EPSILON_VAULT_KEY));
  await service.initialize({email:process.env.EPSILON_BOOTSTRAP_EMAIL,passwordHash:process.env.EPSILON_BOOTSTRAP_HASH,name:process.env.EPSILON_BOOTSTRAP_NAME??'Суперадмин'});
  const server=createAuthServer(service,{origin:process.env.EPSILON_ORIGIN,production:true});
  server.listen(8080,'0.0.0.0',()=>console.log('ЭПСИЛОН: authentication service ready on internal port 8080.'));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await store.close();process.exit(0);}));
}catch{console.error('ЭПСИЛОН: startup failed. Check independent database, HTTPS origin and auth secret configuration.');process.exitCode=1;}
