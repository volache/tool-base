// Minimal browser test harness: drives a real (headless) Chromium-family browser over the DevTools protocol, no dependencies.
// Each session starts with a fixed company location, a fixed clock and a mocked weather service, so tests are deterministic and offline.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import zlib from 'node:zlib';

export const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
export const outputDir=join(root,'.test-output');
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export function findBrowser(){
  const candidates=[process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge'].filter(Boolean);
  return candidates.find(path=>existsSync(path))??null;
}

const freePort=()=>new Promise((done,fail)=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>done(port));});server.on('error',fail);});

// Static preview server (the project's own preview.mjs) on a free port.
export async function startServer(){
  const port=await freePort();
  const child=spawn(process.execPath,['preview.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
  for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}await sleep(100);}
  return {url:`http://127.0.0.1:${port}/`,stop:()=>child.kill()};
}

export const defaultLocation={name:'測試地點',lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'};

// A fixed weather answer in the shape Open-Meteo returns, plus a three-day outlook.
export const sampleWeather={
  current:{time:'2026-10-18T12:00',weather_code:2,cloud_cover:55,wind_speed_10m:3.4,temperature_2m:27.4,relative_humidity_2m:68,visibility:24140},
  daily:{time:['2026-10-18','2026-10-19','2026-10-20'],weather_code:[2,61,0],temperature_2m_max:[30,28,31],temperature_2m_min:[24,23,24],precipitation_probability_max:[10,70,5],cloud_cover_mean:[50,90,15]}
};

function decodePng(buffer){
  let position=8,width,height,colorType;const chunks=[];
  while(position<buffer.length){
    const length=buffer.readUInt32BE(position),type=buffer.toString('ascii',position+4,position+8),data=buffer.subarray(position+8,position+8+length);
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);colorType=data[9];}
    if(type==='IDAT')chunks.push(data);
    position+=12+length;
  }
  const bytes=colorType===6?4:3,raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*bytes,pixels=Buffer.alloc(height*stride);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    for(let x=0;x<stride;x++){
      const a=x>=bytes?pixels[y*stride+x-bytes]:0,b=y?pixels[(y-1)*stride+x]:0,c=x>=bytes&&y?pixels[(y-1)*stride+x-bytes]:0,v=raw[y*(stride+1)+1+x];
      let value;
      if(filter===0)value=v;else if(filter===1)value=v+a;else if(filter===2)value=v+b;else if(filter===3)value=v+((a+b)>>1);
      else{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);value=v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);}
      pixels[y*stride+x]=value&255;
    }
  }
  return {width,height,bytes,pixels};
}

export async function openSession(baseUrl,{viewport=[1400,820],location=defaultLocation,now=null,weather=sampleWeather,storage={},name='session'}={}){
  const browser=findBrowser();
  if(!browser)throw new Error('找不到 Chromium 系列瀏覽器（Edge 或 Chrome）。可用環境變數 BROWSER 指定路徑。');
  const profile=mkdtempSync(join(tmpdir(),'tool-base-test-')),debugPort=await freePort();
  const child=spawn(browser,['--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,`--window-size=${viewport[0]},${viewport[1]}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-first-run','--disable-extensions','about:blank'],{stdio:'ignore'});
  let targets;
  for(let i=0;i<80;i++){try{targets=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();if(targets.find(t=>t.type==='page'))break;}catch{}await sleep(150);}
  const target=targets?.find(t=>t.type==='page');if(!target)throw new Error('瀏覽器沒有啟動');
  const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);
  let nextId=0;const pending=new Map();
  const errors=[];
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);return;}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(arg=>arg.value??arg.description).join(' '));
  };
  const send=(method,params={})=>new Promise(resolveSend=>{const id=++nextId;pending.set(id,resolveSend);socket.send(JSON.stringify({id,method,params}));});

  mkdirSync(outputDir,{recursive:true});
  const session={
    send,baseUrl,errors,
    async eval(expression){
      const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(response.result?.exceptionDetails)throw new Error(response.result.exceptionDetails.exception?.description??response.result.exceptionDetails.text);
      return response.result?.result?.value;
    },
    // Run an async function body with q (querySelector), qa (querySelectorAll) and w (sleep) in scope.
    run:body=>session.eval(`(async()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],w=ms=>new Promise(r=>setTimeout(r,ms));${body}})()`),
    async waitFor(condition,timeout=15000,label=condition){
      const start=Date.now();
      while(Date.now()-start<timeout){try{if(await session.run(`return !!(${condition});`))return true;}catch{}await sleep(150);}
      throw new Error(`等待逾時：${label}`);
    },
    async goto(path='',wait=3500){await send('Page.navigate',{url:baseUrl+path});await session.waitFor("document.documentElement.dataset.world==='ready'||document.documentElement.dataset.world==='fallback'",30000,'3D 世界載入');await sleep(wait);},
    async click(selector){await session.run(`q(${JSON.stringify(selector)}).click();`);},
    // Enter and Space carry text so native buttons activate exactly as they do for a real keyboard.
    async key(key,code=0){const text=key==='Enter'?String.fromCharCode(13):key===' '?' ':undefined;for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code,...(type==='keyDown'&&text?{text}:{})});await sleep(120);},
    async viewport(width,height,mobile=false){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(1200);},
    async png(){const response=await send('Page.captureScreenshot',{format:'png'});return Buffer.from(response.result.data,'base64');},
    async screenshot(label){const buffer=await session.png();writeFileSync(join(outputDir,`${name}-${label}.png`),buffer);return buffer;},
    // Average colour of a rectangle [x0,y0,x1,y1] of the current page.
    async pixel(region=[40,150,160,230]){
      const {width,bytes,pixels}=decodePng(await session.png());let sum=[0,0,0],count=0;
      for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++){for(let k=0;k<3;k++)sum[k]+=pixels[(y*width+x)*bytes+k];count++;}
      return sum.map(v=>Math.round(v/count));
    },
    // Count pixels in [x0,y0,x1,y1] for which predicate(r,g,b) is true.
    async scan(region,predicate){
      const {width,bytes,pixels}=decodePng(await session.png());let count=0;
      for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++){const i=(y*width+x)*bytes;if(predicate(pixels[i],pixels[i+1],pixels[i+2]))count++;}
      return count;
    },
    async close(){try{socket.close();}catch{}child.kill();await sleep(300);try{rmSync(profile,{recursive:true,force:true});}catch{}}
  };

  // Everything below runs before the page's own scripts on every navigation.
  const injected=[];
  if(location)injected.push(`try{localStorage.setItem('tool-portal-company-location-v1',${JSON.stringify(JSON.stringify(location))});}catch{}`);
  for(const [key,value] of Object.entries(storage))injected.push(`try{localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(String(value))});}catch{}`);
  if(now!==null){
    injected.push(`(()=>{const offset=${Date.parse(now)}-Date.now(),Real=Date;class Shifted extends Real{constructor(...a){a.length?super(...a):super(Real.now()+offset);}static now(){return Real.now()+offset;}}window.Date=Shifted;})();`);
  }
  if(weather){
    injected.push(`(()=>{const real=window.fetch.bind(window),body=${JSON.stringify(weather)};window.__weatherCalls=0;window.fetch=(input,init)=>{const url=String(input?.url??input);if(url.startsWith('https://api.open-meteo.com/')){window.__weatherCalls++;return Promise.resolve(new Response(JSON.stringify(window.__weatherBody??body),{status:200,headers:{'Content-Type':'application/json'}}));}return real(input,init);};})();`);
  }
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:injected.join('\n')});
  await send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:1,mobile:viewport[0]<600});
  return session;
}

export function luminance([r,g,b]){return Math.round(.2126*r+.7152*g+.0722*b);}

export const clearWeather={
  current:{time:'2026-10-18T12:00',weather_code:0,cloud_cover:5,wind_speed_10m:1.5,temperature_2m:27,relative_humidity_2m:60,visibility:24000},
  daily:sampleWeather.daily
};

// Weather that is currently dry and partly cloudy but rained `minutesAgo` minutes before `nowIso` (hourly precipitation as Open-Meteo reports it).
export function recentRainWeather(nowIso,{minutesAgo=60,code=2,cloud=40}={}){
  const now=Date.parse(nowIso),offset=8*3600*1000,hour=3600*1000;
  const stamps=[];for(let i=6;i>=0;i--)stamps.push(Math.floor((now+offset)/hour)*hour-i*hour);
  const precipitation=stamps.map(stamp=>{const end=stamp-offset;return end<=now-minutesAgo*60000&&end>now-minutesAgo*60000-hour?1.4:0;});
  return {
    current:{...sampleWeather.current,weather_code:code,cloud_cover:cloud},
    daily:sampleWeather.daily,
    utc_offset_seconds:8*3600,
    hourly:{time:stamps.map(stamp=>new Date(stamp).toISOString().slice(0,16)),precipitation}
  };
}

// Pick an entry in the weather preview dropdown by its label, then wait for the scene to settle.
export async function choosePreset(page,label,settle=6500){
  await page.run(`if(q('#settings').hidden){q('#settings-toggle').click();await w(500);}q('#weather-preview').click();await w(250);qa('#weather-preview-options li').find(li=>li.textContent.trim()===${JSON.stringify(label)}).click();await w(300);`);
  await sleep(settle);
}
export async function closeSettings(page){await page.run("if(!q('#settings').hidden){q('#settings-close').click();await w(500);}");}

// "oklab(0.98 0.001 0.009 / 0.97)" -> 0.98
export const lightness=color=>Number(/\(([\d.]+)/.exec(color)?.[1]);
