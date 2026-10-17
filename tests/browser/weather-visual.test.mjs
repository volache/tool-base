import {choosePreset,clearWeather,closeSettings,luminance,sleep} from './harness.mjs';

const SKY=[40,150,160,230];
const NOON='2026-10-18T12:00:00+08:00';

export async function 天氣越惡劣天空越暗({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  const reading={};
  for(const label of ['晴朗','陰天','下雨']){await choosePreset(page,label);reading[label]=luminance(await page.pixel(SKY));}
  assert(reading['晴朗']>reading['陰天']+8,`晴朗 ${reading['晴朗']} 應比陰天 ${reading['陰天']} 亮`);
  assert(reading['陰天']>reading['下雨']+3,`陰天 ${reading['陰天']} 應比下雨 ${reading['下雨']} 亮`);
}

export async function 霧天能見度低且畫面偏白({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await choosePreset(page,'晴朗');const clear=await page.pixel(SKY);
  await choosePreset(page,'霧');const fog=await page.pixel(SKY);
  assert(Math.max(...fog)-Math.min(...fog)<Math.max(...clear)-Math.min(...clear),`霧的天空飽和度應較低：霧 ${fog} 晴 ${clear}`);
}

export async function 雷雨會閃光({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await choosePreset(page,'雷雨',2500);await closeSettings(page);
  let base=Infinity,peak=0;
  for(let i=0;i<80;i++){const level=luminance(await page.pixel(SKY));base=Math.min(base,level);peak=Math.max(peak,level);if(peak-base>=25)return;}
  assert.fail(`20 多秒內沒偵測到閃光：最暗 ${base}、最亮 ${peak}`);
}

export async function 關閉天氣連動後回到晴天且標籤消失({open,assert}){
  const page=await open({now:NOON});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.run("q('#settings-toggle').click();await w(500);q('#weather-link').click();await w(800);");
  assert.equal(await page.run("return q('#current-weather').hidden;"),true);
  assert.match(await page.run("return q('#weather-status').textContent;"),/已關閉/);
  await page.run("q('#weather-link').click();await w(800);");
  await page.waitFor("!q('#current-weather').hidden",10000,'重新開啟後標籤回來');
}

export async function 天氣預覽只改本次瀏覽不會寫進儲存({open,assert}){
  const page=await open({now:NOON});await page.goto();
  await choosePreset(page,'下雪',1500);
  assert.equal(await page.run("return localStorage.getItem('tool-portal-weather-preview');"),null);
  await page.goto();await sleep(1500);
  assert.match(await page.run("return q('#current-weather').textContent;"),/多雲/,'重新整理後回到實際天氣');
}
