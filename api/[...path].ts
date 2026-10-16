import {request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {isIP} from 'node:net';

const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};

function securityHeaders(res:ServerResponse) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}

function backendUrl() {
  const value=process.env.BACKEND_URL;
  if(!value)throw new Error('BACKEND_URL is not configured.');
  const url=new URL(value);
  if(process.env.NODE_ENV==='production' && url.protocol!=='https:')throw new Error('Production BACKEND_URL must use HTTPS.');
  return url;
}

function proxy(req:IncomingMessage,res:ServerResponse,backend:URL,proxySecret:string) {
  const incoming=new URL(req.url||'/', 'https://frontend.local');
  const target=new URL(backend);target.pathname=incoming.pathname;target.search=incoming.search;
  const forwarded:IncomingHttpHeaders={...req.headers,host:target.host};
  delete forwarded['x-forwarded-for'];delete forwarded['x-forwarded-host'];delete forwarded['x-forwarded-proto'];
  forwarded['x-forwarded-for']=req.socket.remoteAddress || '';
  const edgeAddress=process.env.TRUST_PROXY==='1' ? String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim() : undefined;
  forwarded['x-conference-client-ip']=edgeAddress && isIP(edgeAddress) ? edgeAddress : req.socket.remoteAddress || '';
  forwarded['x-conference-proxy']=proxySecret;
  const request=(target.protocol==='https:'?httpsRequest:httpRequest)(target,{method:req.method,headers:forwarded,timeout:120000},upstream=>{
    res.writeHead(upstream.statusCode||502,upstream.headers);upstream.pipe(res);
    upstream.on('error',()=>res.destroy());
  });
  request.on('timeout',()=>request.destroy());
  request.on('error',()=>{if(res.headersSent)res.destroy();else{res.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message:'The server is temporarily unavailable. Please try again.'}));}});
  req.on('aborted',()=>request.destroy());req.pipe(request);
}

export default async function handler(req:IncomingMessage,res:ServerResponse) {
  securityHeaders(res);
  try {
    const backend=backendUrl();
    const proxySecret=process.env.API_PROXY_SECRET || '';
    if(process.env.NODE_ENV==='production' && proxySecret.length<32)throw new Error('Production requires API_PROXY_SECRET with at least 32 characters.');
    const pathname=decodeURIComponent(new URL(req.url||'/', 'https://frontend.local').pathname);
    if(pathname.startsWith('/api/')){proxy(req,res,backend,proxySecret);return;}
    if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405);res.end();return;}
    let file:string;
    if(pathname==='/admin'||pathname==='/admin.html'){
      res.setHeader('Cache-Control','no-store');
      const hasSession=req.headers.cookie?.split(';').some(value=>/^conference_session=.+$/.test(value.trim()));
      if(!hasSession){res.writeHead(302,{Location:'/admin/login'});res.end();return;}
      const session=await fetch(new URL('/api/admin/session',backend),{headers:{cookie:req.headers.cookie||'','x-conference-proxy':proxySecret},signal:AbortSignal.timeout(10000)});
      if(session.status===401){res.writeHead(302,{Location:'/admin/login'});res.end();return;}
      if(!session.ok){res.writeHead(session.status===403?403:503);res.end('Administrator access is unavailable. Please try again.');return;}
      file='admin.html';
    }else if(pathname==='/admin/login')file='login.html';
    else if(pathname==='/privacy')file='privacy.html';
    else if(/^\/[a-z-]+\.(js|css)$/.test(pathname))file=pathname.slice(1);
    else{res.writeHead(404);res.end('Page not found.');return;}
    const content=await readFile(resolve(process.cwd(),'public',file));
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
    res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
  } catch(error) {
    const message=error instanceof Error ? error.message : 'The frontend is temporarily unavailable.';
    res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end(process.env.NODE_ENV==='production' ? 'The frontend is temporarily unavailable.' : message);
  }
}
