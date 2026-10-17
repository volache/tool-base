import {clearWeather,sleep} from './harness.mjs';

const NOON='2026-10-18T12:00:00+08:00',NIGHT='2026-10-18T21:30:00+08:00';
const PICK_CITY="q('[data-biome=\"city\"]').click();";
// 亮起的窗戶、路燈與車燈是奶油色的亮點（約 224,224,192）
const isWarmLight=(r,g,b)=>.2126*r+.7152*g+.0722*b>190&&r-b>=26;

export async function 切換到城市後場景與按鈕狀態正確({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run(PICK_CITY+'await w(12000);');
  const state=await page.run("return {active:q('.biome.active').dataset.biome,pressed:q('[data-biome=\"city\"]').getAttribute('aria-pressed'),scene:document.querySelector('[data-scene]')?.dataset.scene,label:q('[data-biome=\"city\"]').getAttribute('aria-label')};");
  assert.deepEqual(state,{active:'city',pressed:'true',scene:'city',label:'城市'});
}

export async function 白天的城市有粉彩建築而不是空曠平原({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run("q('#launcher-toggle').click();"+PICK_CITY+'await w(12000);');
  // 建築是橘米、粉紅、淡藍、淡綠等粉彩色塊；整個畫面要有足夠的非天空非地面顏色
  const buildings=await page.scan([0,150,1400,520],(r,g,b)=>(r>200&&g>170&&b>130&&r-b>35)||(r>190&&g<160&&b<150&&r-g>35));
  assert(buildings>3000,`應該看得到大量建築色塊：${buildings}`);
}

export async function 夜晚的城市窗戶與路燈會亮({open,assert}){
  const night=await open({now:NIGHT,weather:clearWeather});await night.goto();
  await night.run("q('#launcher-toggle').click();"+PICK_CITY+'await w(12000);');
  // 右側沒有介面的區域：夜晚整體很暗，只有亮起的窗戶、路燈與車燈是奶油暖色的亮點
  const strip=[1030,200,1400,700],area=(strip[2]-strip[0])*(strip[3]-strip[1]);
  const lights=await night.scan(strip,isWarmLight);
  const dark=await night.scan(strip,(r,g,b)=>.2126*r+.7152*g+.0722*b<90);
  assert(dark>area*.6,`夜晚的城市應該大致是暗的：暗像素 ${dark}/${area}`);
  assert(lights>120,`夜晚應有大量亮起的窗戶：${lights}`);
}

export async function 自動輪換會經過城市({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run("q('[data-biome=\"forest\"]').click();await w(12000);q('#settings-toggle').click();await w(500);");
  // 輪換順序在 app.js 內；直接確認「森林」之後是「城市」
  const next=await page.run("return fetch('./app.js').then(r=>r.text()).then(t=>{const m=/const order=\\[([^\\]]*)\\]/.exec(t);const order=m[1].replace(/'/g,'').split(',');return order[(order.indexOf('forest')+1)%order.length];});");
  assert.equal(next,'city');
}

export async function 城市場景在三種畫質下都不報錯({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run(PICK_CITY+'await w(9000);q("#settings-toggle").click();await w(600);');
  for(const label of ['輕量','精緻','均衡']){
    await page.run(`q('#quality').click();await w(250);qa('#quality-options li').find(li=>li.textContent.includes(${JSON.stringify(label)})).click();await w(2500);`);
  }
  await sleep(500);
}
