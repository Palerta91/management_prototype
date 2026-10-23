// Offline operator-only recovery. No HTTP endpoint, universal password or secret
// URL exists. Running this requires privileged access to the Epsilon container.
import {Pool} from 'pg';
import {PostgresStore} from './store.mjs';
import {hashPassword} from './passwords.mjs';
import {readSecret} from './terminal-secret.mjs';
import {randomUUID} from 'node:crypto';

console.log('Recover the CURRENT Epsilon superadmin. This invalidates every session of that account. No other users are modified.');
const confirmation=await readSecret('Type RECOVER to continue: ');if(confirmation!=='RECOVER')throw new Error('Cancelled');
const password=await readSecret('New password (hidden; 16–128 characters): '),repeat=await readSecret('Repeat new password: ');if(password!==repeat)throw new Error('Passwords do not match.');
const passwordHash=await hashPassword(password),store=new PostgresStore(new Pool({host:process.env.PGHOST,port:Number(process.env.PGPORT??5432),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD,max:1}));
try{await store.transaction(s=>{const id=s.access?.superAdminId,a=s.accounts?.[id];if(!a||a.profile.role!=='leader'||a.profile.status!=='active')throw new Error('Current active superadmin not found. Recovery aborted.');a.passwordHash=passwordHash;a.passwordVersion++;a.mustChange=false;delete a.temporary;for(const [key,session]of Object.entries(s.sessions))if(session.userId===id)delete s.sessions[key];s.audit.push({id:randomUUID(),at:Date.now(),actorId:'offline-operator',action:'Восстановлен пароль Суперадмина через сервер',targetId:id});});console.log('Current superadmin password recovered. All previous sessions revoked. No password was printed or saved as plaintext.');}finally{await store.close();}
