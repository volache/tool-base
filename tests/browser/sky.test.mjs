import {clearWeather,lightness,luminance,sleep} from './harness.mjs';

const DAY='2026-10-18';   // 日出約 05:53、日落約 17:26（測試地點）
const at=time=>`${DAY}T${time}:00+08:00`;
const SKY=[40,150,160,230];

export async function 預覽與即時模式在同一時間看起來相同({open,assert}){
  for(const time of ['05:40','12:00','17:30','21:00']){
    const live=await open({now:at(time),weather:clearWeather,name:`live-${time}`});
    await live.goto();await sleep(5000);
    const liveColor=await live.pixel(SKY);await live.close();
    const preview=await open({now:at('00:10'),weather:clearWeather,name:`preview-${time}`});
    await preview.goto();
    const [hour,minute]=time.split(':').map(Number);
    await preview.run(`q('#settings-toggle').click();await w(500);q('#sun-preview-start').click();await w(1500);const r=q('#sun-preview-range');r.value=String(${hour*60+minute});r.dispatchEvent(new Event('input',{bubbles:true}));`);
    await sleep(6500);
    const previewColor=await preview.pixel(SKY);await preview.close();
    const worst=Math.max(...liveColor.map((value,index)=>Math.abs(value-previewColor[index])));
    assert(worst<=8,`${time}：即時 ${liveColor} 與預覽 ${previewColor} 相差 ${worst}`);
  }
}

export async function 晨昏偏暖白天偏藍夜晚偏暗({open,assert}){
  const sample=async time=>{const page=await open({now:at(time),weather:clearWeather,name:`t-${time}`});await page.goto();await sleep(5500);const color=await page.pixel(SKY);await page.close();return color;};
  const noon=await sample('12:00'),sunset=await sample('17:26'),sunrise=await sample('05:53'),night=await sample('21:00');
  assert(noon[2]>noon[0]+25,`正午天空偏藍：${noon}`);
  assert(sunset[0]>sunset[2]+20,`日落天空偏暖：${sunset}`);
  assert(sunrise[0]>=sunrise[2]-5&&sunrise[0]>noon[0]+20,`日出天空偏暖粉：${sunrise}`);
  assert(luminance(night)<90&&luminance(noon)>170,`夜晚應明顯比白天暗：夜 ${luminance(night)} 日 ${luminance(noon)}`);
}

export async function 設定所在地後天色預設自動且按鈕改為手動({open,assert}){
  const page=await open({now:at('12:00'),weather:clearWeather});await page.goto();
  assert.equal(await page.run("return document.documentElement.dataset.theme;"),'day');
  await page.run("q('#settings-toggle').click();await w(500);");
  assert.equal(await page.run("return q('#auto-sky').checked&&!q('#auto-sky').disabled;"),true,'有所在地時預設自動天色');
  await page.run("q('#settings-close').click();await w(400);q('#night').click();");
  await page.waitFor("document.documentElement.dataset.theme==='night'",30000,'手動切成夜晚');
  await page.run("q('#settings-toggle').click();await w(500);");
  assert.equal(await page.run("return q('#auto-sky').checked;"),false,'按下日夜鈕後自動天色關閉');
  await sleep(1500);
  assert.equal(await page.run("return document.documentElement.dataset.theme;"),'night','手動後不會被自動天色改回白天');
}

export async function 場景切換中按日夜鈕仍會生效({open,assert}){
  const page=await open({now:at('12:00'),weather:clearWeather});await page.goto();
  await page.run("q('[data-biome=\"forest\"]').click();await w(300);q('#night').click();");
  await page.waitFor("document.documentElement.dataset.theme==='night'&&parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--night'))>0.98",60000,'夜間配色完成');
}

export async function 手動切換日夜時介面顏色連續漸變({open,assert}){
  const page=await open({location:null,weather:clearWeather});await page.goto();
  const values=await page.run(`const out=[];const el=q('.search');q('#night').click();const t0=performance.now();while(performance.now()-t0<1500){out.push(getComputedStyle(el).backgroundColor);await w(80);}return out;`);
  const levels=values.map(lightness);
  assert(levels[0]-levels.at(-1)>.5,`亮度應從淺變深：${levels}`);
  for(let i=1;i<levels.length;i++){
    assert(levels[i]<=levels[i-1]+.01,`亮度不應回升：第 ${i} 筆 ${levels[i-1]} → ${levels[i]}`);
    assert(levels[i-1]-levels[i]<=.25,`不應突然跳變：第 ${i} 筆 ${levels[i-1]} → ${levels[i]}`);
  }
  assert(levels.some(value=>value>.4&&value<.8),`應該有中間色：${levels}`);
}

export async function 預覽太陽與月亮時天色符合該時間({open,assert}){
  const page=await open({now:at('00:10'),weather:clearWeather});await page.goto();
  const setTime=async(kind,minutes)=>{await page.run(`const r=q('#${kind}-preview-range');r.value=String(${minutes});r.dispatchEvent(new Event('input',{bubbles:true}));`);await sleep(6500);return page.pixel(SKY);};
  await page.run("q('#settings-toggle').click();await w(500);q('#moon-preview-start').click();await w(1500);");
  const moonNoon=await setTime('moon',12*60),moonDusk=await setTime('moon',17*60+26);
  assert(luminance(moonNoon)>170&&moonNoon[2]>moonNoon[0],`月亮預覽的正午是白天：${moonNoon}`);
  assert(moonDusk[0]>moonDusk[2]+15,`月亮預覽的日落也有暖色：${moonDusk}`);
  const moonNight=await setTime('moon',3*60);
  assert(luminance(moonNight)<90,`月亮預覽的凌晨 3 點是夜晚：${moonNight}`);
}

export async function 晴朗的夜裡月亮完整沒有被看不見的雲咬掉({open,assert}){
  const page=await open({now:at('21:30'),weather:clearWeather});await page.goto();
  await page.run("q('#launcher-toggle').click();await w(6500);");
  const bright=await page.scan([935,195,1070,285],(r,g,b)=>r>200&&g>190&&b>150);
  assert(bright>350,`晴夜應看得到完整的亮面月亮（亮面約 500 像素以上）：${bright}`);
}

export async function 月亮周圍有柔和光暈而且比遠處天空亮({open,assert}){
  const page=await open({now:at('21:30'),weather:clearWeather});await page.goto();
  await page.run("q('#launcher-toggle').click();await w(6500);");
  const ring=luminance(await page.pixel([1048,236,1066,244])),far=luminance(await page.pixel([640,236,660,244]));
  assert(ring>far+8,`月暈 ${ring} 應明顯比遠處天空 ${far} 亮`);
  const edge=luminance(await page.pixel([1075,236,1090,244]));
  assert(edge<ring&&edge>=far,`光暈向外逐漸淡出：環 ${ring} → 外圈 ${edge} → 遠處 ${far}`);
}
