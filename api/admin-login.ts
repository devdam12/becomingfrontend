import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';

export default async function handler(req:IncomingMessage,res:ServerResponse) {
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  try {
    const content=await readFile(resolve(process.cwd(),'public','login.html'));
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
  } catch {
    res.writeHead(503);res.end('The login page is temporarily unavailable. Please try again.');
  }
}
