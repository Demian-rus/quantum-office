import {readFileSync,writeFileSync} from 'node:fs';
const files=['src/core/lecture-model.js','src/core/lecture-radiation.js','src/core/lecture-project.js','src/core/lecture-radiation-visuals.js','lecture-lab/editor.js'];
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^\n]*\};?\r?\n/gm,'').replace(/^export /gm,'');
const js=files.map(p=>strip(readFileSync(p,'utf8').replace(/\r\n/g,'\n'))).join('\n\n').replace(/<\/script/gi,'<\\/script');
const html=readFileSync('lecture-lab/template.html','utf8').replace(/\r\n/g,'\n').replace('<!--QL_SCRIPT-->','<script>'+js+'</script>');
const target='lecture-lab/Quantum-Lectures.html';
if(process.argv.includes('--check')){if(readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==html)throw Error('Lecture lab stale');}else writeFileSync(target,html);
