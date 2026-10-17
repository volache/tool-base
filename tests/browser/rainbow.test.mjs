import {choosePreset,clearWeather,closeSettings,recentRainWeather} from './harness.mjs';

const AFTERNOON='2026-10-18T16:30:00+08:00';   // 太陽低、在西方，彩虹在東方（畫面左側）
const NOON='2026-10-18T12:00:00+08:00';
// 彩虹的綠色帶（混色後約 129,214,162）：天空（偏藍）、黃昏的暖色天空、雲與太陽都不會有綠色像素。
// 範圍只取地平線以上、標題列以下，避開草地與品牌色方塊。
const SKY_BAND=[0,85,1400,330];
const isRainbowGreen=(r,g,b)=>g>r+35&&g>b+25;
const rainbowPixels=page=>page.scan(SKY_BAND,isRainbowGreen);

export async function 預覽彩虹會畫出彩色弧線({open,assert}){
  const page=await open({now:AFTERNOON,weather:clearWeather});await page.goto();
  await closeSettings(page);const before=await rainbowPixels(page);
  await choosePreset(page,'彩虹',9000);await closeSettings(page);
  const after=await rainbowPixels(page);
  assert(before<40,`晴天不應有彩虹色：${before}`);
  assert(after>before+600,`彩虹預覽應出現大量綠色帶像素：${before} → ${after}`);
  assert.equal(await page.run("return q('#weather-pop-hint').hidden;"),false,'彩虹預覽時詳情有提示');
}

export async function 雨後放晴時真實資料也會出彩虹({open,assert}){
  const weather=recentRainWeather(AFTERNOON,{minutesAgo:60,code:2,cloud:40});
  const page=await open({now:AFTERNOON,weather});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");await page.run('await w(8000);');
  const count=await rainbowPixels(page);
  assert(count>600,`雨後放晴應該有彩虹：${count}`);
}

export async function 正午太陽太高不會出彩虹({open,assert}){
  const weather=recentRainWeather(NOON,{minutesAgo:60,code:2,cloud:40});
  const page=await open({now:NOON,weather});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");await page.run('await w(8000);');
  const count=await rainbowPixels(page);
  assert(count<40,`太陽高時不應有彩虹：${count}`);
}

export async function 沒有下過雨或正在下雨都不會出彩虹({open,assert}){
  const never=await open({now:AFTERNOON,weather:{...clearWeather,current:{...clearWeather.current,weather_code:2,cloud_cover:40}},name:'never'});
  await never.goto();await never.run('await w(8000);');
  const neverCount=await rainbowPixels(never);await never.close();
  const raining=recentRainWeather(AFTERNOON,{minutesAgo:30,code:63,cloud:100});
  const now=await open({now:AFTERNOON,weather:raining,name:'raining'});await now.goto();await now.run('await w(8000);');
  const rainingCount=await rainbowPixels(now);
  assert(neverCount<40,`沒下過雨不該有彩虹：${neverCount}`);
  assert(rainingCount<40,`正在下雨不該有彩虹：${rainingCount}`);
}

export async function 久遠的雨不會再出彩虹({open,assert}){
  const weather=recentRainWeather(AFTERNOON,{minutesAgo:5*60,code:2,cloud:40});
  // 過去 6 小時資料只涵蓋到 5 小時前，仍然超過 3 小時的上限
  const page=await open({now:AFTERNOON,weather});await page.goto();await page.run('await w(8000);');
  assert((await rainbowPixels(page))<40,'3 小時以前的雨不該出彩虹');
}
