import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),useDist=process.argv[2]==='dist';
createServer(async(req,res)=>{try{const file=resolve(root,useDist?'dist/index.html':'index.html');const data=await readFile(file);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('Preview missing');}}).listen(5173,'127.0.0.1',()=>console.log('http://127.0.0.1:5173'));
