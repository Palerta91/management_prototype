import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const publicAssets=new Set(['/assets/login.js','/assets/login.css','/assets/pending.js','/assets/epsilon.svg']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
export function createAuthServer(service,{origin,production=true}={}){
  const canonical=new URL(origin);
  if(production&&canonical.protocol!=='https:')throw new Error('Production requires an HTTPS EPSILON_ORIGIN.');
  if(!production&&!['127.0.0.1','localhost','[::1]'].includes(canonical.hostname))throw new Error('Insecure development is restricted to loopback.');
  const cookieName=production?'__Host-epsilon_session':'epsilon_dev_session';
  const cookie=value=>cookieName+'='+value+'; Path=/; HttpOnly; SameSite=Strict'+(production?'; Secure':'');
  const server=createServer(async(req,res)=>{
    let path;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send=(status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
    const redirect=location=>{res.writeHead(303,{Location:location});res.end();};
    try{
      path=new URL(req.url,origin).pathname;
      if(path==='/healthz'){send(200,'ok\n','text/plain; charset=utf-8');return;}
      if(production&&req.headers['x-forwarded-proto']!=='https'){
        // Do not parse a password-bearing body on an insecure connection.
        if(!['GET','HEAD'].includes(req.method)){send(426,{error:'Вход доступен только по HTTPS.'});return;}
        res.writeHead(308,{Location:canonical.origin+req.url});res.end();return;
      }
      if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
      const rawCookie=String(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';
      if(path.startsWith('/api/')){
        if(!['GET','POST'].includes(req.method)){send(405,{error:'Метод не поддерживается.'});return;}
        let body={};
        if(req.method==='POST'){
          if(req.headers.origin!==canonical.origin||!String(req.headers['content-type']??'').startsWith('application/json')){send(403,{error:'Недопустимый источник запроса.'});return;}
          let length=0,parts=[];for await(const chunk of req){length+=chunk.length;if(length>65536){send(413,{error:'Слишком большой запрос.'});return;}parts.push(chunk);}
          try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{send(400,{error:'Некорректный JSON.'});return;}
          if(!body||typeof body!=='object'||Array.isArray(body)){send(400,{error:'Ожидается объект.'});return;}
        }
        // The proxy must overwrite X-Forwarded-For; only its last address is used.
        const ip=production?String(req.headers['x-forwarded-for']??req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
        const result=await service.handle(path,req.method,body,{cookie:rawCookie,csrf:String(req.headers['x-csrf-token']??''),ip});
        if(result.setSession)res.setHeader('Set-Cookie',cookie(result.setSession));
        if(result.clearSession)res.setHeader('Set-Cookie',cookie('')+'; Max-Age=0');
        send(result.status,result.body);return;
      }
      if(!['GET','HEAD'].includes(req.method)){send(405,{error:'Метод не поддерживается.'});return;}
      let filename;
      if(path==='/login'||path==='/account')filename='login.html';
      else if(publicAssets.has(path))filename=path.slice(1);
      else{
        const auth=await service.store.transaction(s=>{service.cleanup(s);const a=service.session(s,rawCookie);return a?{mustChange:a.account.mustChange,pending:service.onboardingRequired(s,a.account)}:null;});
        if(!auth){if(path.startsWith('/assets/'))send(401,{error:'Требуется вход.'});else redirect('/login');return;}
        if(auth.mustChange){if(path.startsWith('/assets/'))send(403,{error:'Сначала замените временный пароль.'});else redirect('/account');return;}
        if(auth.pending){if(path==='/pending')filename='pending.html';else{if(path.startsWith('/assets/'))send(403,{error:'Дождитесь добавления Вашего профиля Руководителем'});else redirect('/pending');return;}}
        else{if(path==='/pending'){redirect('/dashboard');return;}filename=path.startsWith('/assets/')?path.slice(1):'index.html';}
      }
      const file=resolve(root,filename);if(!file.startsWith(root.endsWith(sep)?root:root+sep)){send(404,{error:'Не найдено.'});return;}
      const content=await readFile(file);send(200,req.method==='HEAD'?'':content,types[extname(file)]??'application/octet-stream');
    }catch(error){
      // Never log bodies, cookies, credentials, hashes or arbitrary exception text.
      if(!res.headersSent)send(error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Не найдено.':'Сервис временно недоступен.'});else res.end();
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return server;
}
