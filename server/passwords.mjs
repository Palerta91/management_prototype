import {randomBytes, scrypt, timingSafeEqual, createCipheriv, createDecipheriv, createHash} from 'node:crypto';
import {promisify} from 'node:util';

const derive=promisify(scrypt);
const params={N:131072,r:8,p:1,maxmem:192*1024*1024};
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const temporaryPassword=()=>randomBytes(18).toString('base64url');
export function passwordValid(value){return typeof value==='string'&&value.length>=16&&value.length<=128;}
export function safeHashForVerification(value,fallback){
  if(typeof value!=='string'||typeof fallback!=='string')return fallback;
  const parts=value.split('$');
  if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$131072$8$1'||!/^[-_A-Za-z0-9]+$/.test(parts[4])||!/^[-_A-Za-z0-9]+$/.test(parts[5]))return fallback;
  if(Buffer.from(parts[4],'base64url').length!==16||Buffer.from(parts[5],'base64url').length!==64)return fallback;
  return value;
}
export async function hashPassword(password){
  if(!passwordValid(password))throw new Error('Пароль должен содержать от 16 до 128 символов.');
  const salt=randomBytes(16),key=await derive(password,salt,64,params);
  return ['scrypt','131072','8','1',salt.toString('base64url'),key.toString('base64url')].join('$');
}
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||password.length>128)return false;
  const parts=String(encoded).split('$');
  if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$131072$8$1')return false;
  const salt=Buffer.from(parts[4],'base64url'),expected=Buffer.from(parts[5],'base64url');
  if(salt.length!==16||expected.length!==64)return false;
  const actual=await derive(password,salt,64,params);return timingSafeEqual(actual,expected);
}
export function vaultKey(value){const key=Buffer.from(value??'','base64');if(key.length!==32)throw new Error('Set an independent 32-byte EPSILON_VAULT_KEY.');return key;}
export function seal(password,key,context){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(context));
  return {iv:iv.toString('base64'),ciphertext:Buffer.concat([cipher.update(password,'utf8'),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')};
}
export function unseal(record,key,context){
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64'));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(record.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8');
}
