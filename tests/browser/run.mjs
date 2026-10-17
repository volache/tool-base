// Runs every tests/browser/*.test.mjs file against a freshly started preview server.
// Usage: npm run test:browser [-- filter]    (needs Edge or Chrome; set BROWSER=/path/to/browser to choose one)
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {findBrowser,openSession,startServer} from './harness.mjs';

const directory=fileURLToPath(new URL('./',import.meta.url));
const filter=process.argv[2];
if(!findBrowser()){console.log('找不到 Edge 或 Chrome，略過瀏覽器測試。可用環境變數 BROWSER 指定路徑。');process.exit(0);}

const files=readdirSync(directory).filter(file=>file.endsWith('.test.mjs')&&(!filter||file.includes(filter))).sort();
const server=await startServer();
let failed=0,passed=0;
for(const file of files){
  const tests=await import(pathToFileURL(join(directory,file)).href);
  for(const [name,test] of Object.entries(tests).filter(([,value])=>typeof value==='function')){
    const label=`${file.replace('.test.mjs','')} › ${name}`,started=Date.now(),sessions=[];
    try{
      await Promise.race([
        test({assert,open:async options=>{const session=await openSession(server.url,{name:`${file.replace('.test.mjs','')}-${name}`,...options});sessions.push(session);return session;},baseUrl:server.url}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('測試逾時（180 秒）')),180000))
      ]);
      for(const session of sessions)if(session.errors.length)throw new Error(`頁面出現 JavaScript 錯誤：\n${session.errors.slice(0,3).join('\n')}`);
      passed++;console.log(`  ✓ ${label}  (${((Date.now()-started)/1000).toFixed(1)}s)`);
    }catch(error){
      failed++;console.log(`  ✗ ${label}\n      ${String(error.message??error).split('\n').join('\n      ')}`);
    }finally{for(const session of sessions)await session.close();}
  }
}
server.stop();
console.log(`\n瀏覽器測試：${passed} 通過，${failed} 失敗。失敗時的截圖在 .test-output/`);
process.exit(failed?1:0);
