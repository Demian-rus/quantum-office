/* Build gate for redirected editor storage keys and native allowlists. */
export function verifyNativeStorageContract(sources,bootstrap,rust){
 const readList=(source,pattern,label)=>{const match=source.match(pattern);if(!match)throw Error('Native storage list not found: '+label);const keys=JSON.parse(match[1]);if(!Array.isArray(keys)||keys.some(k=>typeof k!=='string')||new Set(keys).size!==keys.length)throw Error('Invalid native storage list: '+label);return new Set(keys);};
 const js=readList(bootstrap,/const keys=(\[[^\]]*\]),allowed=/,'JavaScript'),native=readList(rust,/const KEYS:&\[&str\]=&(\[[^\]]*\]);/,'Rust');
 if(js.size!==native.size||[...js].some(k=>!native.has(k)))throw Error('Native storage allowlists differ');
 const code=Object.values(sources).join('\n'),definitions=new Map();
 for(const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*(['"])((?:quantum-office[.-]|quantum-studio-|qo-studio-)[\w.-]+)\2/g))definitions.set(m[1],m[3]);
 const used=new Set(),include=arg=>{const literal=arg.match(/^(['"])([^'"]+)\1$/),key=literal?literal[2]:definitions.get(arg);if(!key)throw Error('Unresolved native storage key: '+arg);used.add(key);if(!js.has(key))throw Error('Missing native storage key: '+key);};
 for(const [file,source] of Object.entries(sources))for(const m of source.matchAll(/(?:\b(?:globalThis\.)?localStorage|\bstorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*([^,)\n]+)\s*[,)]/g)){const arg=m[1].trim();if(arg==='key'){if(!['src/core/store.js','src/main.js','src/core/student-hub.js'].includes(file))throw Error('Unresolved dynamic native storage key in '+file);}else include(arg);}
 // Existing forwarding helpers and the two explicit workspace key arrays.
 for(const m of code.matchAll(/\b(?:qoReadSetting|qoWriteSetting|qoDeskRead|qoHubRead|qoHubWrite)\s*\(\s*([^,)\n]+)\s*,/g)){const arg=m[1].trim();if(arg!=='key')include(arg);}
 for(const [file,pattern] of [['src/core/store.js',/\bfor\s*\(const key of \[([^\]]+)\]\)/g],['src/main.js',/\bconst keys=\[(STORE_KEY,[^\]]+)\]/g]])for(const m of sources[file].matchAll(pattern))for(const arg of m[1].split(','))include(arg.trim());
 for(const k of js)if(!used.has(k))throw Error('Native storage key not covered by editor contract: '+k);
 return [...used].sort();
}
