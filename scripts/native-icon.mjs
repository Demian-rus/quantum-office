import {mkdirSync,writeFileSync} from 'node:fs';
const n=32,maskStride=4,bytes=n*n*4+maskStride*n,ico=Buffer.alloc(22+40+bytes);
ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=n;ico[7]=n;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(40+bytes,14);ico.writeUInt32LE(22,18);
ico.writeUInt32LE(40,22);ico.writeInt32LE(n,26);ico.writeInt32LE(n*2,30);ico.writeUInt16LE(1,34);ico.writeUInt16LE(32,36);ico.writeUInt32LE(n*n*4,42);
for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p=62+(y*n+x)*4,ring=Math.abs(Math.hypot(x-15.5,y-15.5)-10)<1.8,tail=x>=18&&x<=26&&Math.abs(x-y)<2;ico[p]=ring||tail?240:48;ico[p+1]=ring||tail?240:32;ico[p+2]=ring||tail?240:19;ico[p+3]=255;}
mkdirSync('src-tauri/icons',{recursive:true});writeFileSync('src-tauri/icons/icon.ico',ico);
