import {writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../server/passwords.mjs';
import {readSecret} from '../server/terminal-secret.mjs';

const [email,origin]=process.argv.slice(2),file=new URL('../deploy/.env.auth',import.meta.url);
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email??'')||!origin?.startsWith('https://'))throw new Error('Usage: node scripts/create-bootstrap.mjs email https://epsilon-domain');
try{await access(file);throw new Error('Independent bootstrap file already exists; it will not be overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}
const password=await readSecret('Bootstrap password (hidden, not saved as plaintext): ');
const hash=await hashPassword(password);
await writeFile(file,['EPSILON_BOOTSTRAP_EMAIL='+email.toLowerCase(),"EPSILON_BOOTSTRAP_HASH='"+hash+"'",'EPSILON_VAULT_KEY='+randomBytes(32).toString('base64'),'EPSILON_ORIGIN='+origin,''].join('\n'),{mode:0o600,flag:'wx'});
console.log('Created ignored deploy/.env.auth (mode 0600). Contains a password hash and independent vault key; no plaintext password. Keep this file private.');
