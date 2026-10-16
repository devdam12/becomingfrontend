import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';

function headers(res:ServerResponse) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Cache-Control','no-store');
}

export default async function handler(req:IncomingMessage,res:ServerResponse) {
  headers(res);
  try {
    if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const backend=process.env.BACKEND_URL;
    const proxySecret=process.env.API_PROXY_SECRET || '';
    if(!backend || (process.env.NODE_ENV==='production' && proxySecret.length<32))throw new Error('Frontend environment is incomplete.');
    const hasSession=req.headers.cookie?.split(';').some(value=>/^conference_session=.+$/.test(value.trim()));
    if(!hasSession){res.writeHead(302,{Location:'/admin/login'});res.end();return;}
    const session=await fetch(new URL('/api/admin/session',backend),{headers:{cookie:req.headers.cookie||'','x-conference-proxy':proxySecret},signal:AbortSignal.timeout(10000)});
    if(session.status===401){res.writeHead(302,{Location:'/admin/login'});res.end();return;}
    if(!session.ok){res.writeHead(session.status===403?403:503);res.end('Administrator access is unavailable. Please try again.');return;}
    const content=await readFile(resolve(process.cwd(),'public','admin.html'));
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
  } catch {
    res.writeHead(503);res.end('The administrator page is temporarily unavailable. Please try again.');
  }
}
