import {clearWeather,sleep} from './harness.mjs';

const NOON='2026-10-18T12:00:00+08:00';
const openSettings=page=>page.run("if(q('#settings').hidden){q('#settings-toggle').click();await w(600);}q('#weather-preview').scrollIntoView({block:'center'});await w(300);");

export async function 下拉選單可用鍵盤操作({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();await openSettings(page);
  await page.run("q('#weather-preview').focus();");
  const highlighted=()=>page.run("return q('#weather-preview-options .highlighted')?.textContent;");
  await page.key('ArrowDown',40);
  assert.equal(await page.run("return q('#weather-preview').getAttribute('aria-expanded');"),'true','方向鍵會開啟');
  assert.equal(await highlighted(),'依實際天氣');
  await page.key('ArrowDown',40);await page.key('ArrowDown',40);await page.key('ArrowDown',40);
  assert.equal(await highlighted(),'陰天');
  await page.key('End',35);assert.equal(await highlighted(),'彩虹');
  await page.key('Home',36);assert.equal(await highlighted(),'依實際天氣');
  for(let i=0;i<3;i++)await page.key('ArrowDown',40);
  await page.key('Enter',13);
  assert.equal(await page.run("return q('#weather-preview-label').textContent;"),'陰天');
  assert.equal(await page.run("return q('#weather-preview').getAttribute('aria-expanded');"),'false');
  assert.equal(await page.run("return document.activeElement.id;"),'weather-preview','選取後焦點回到按鈕');
  await page.key('ArrowDown',40);await page.key('Escape',27);
  assert.equal(await page.run("return q('#weather-preview').getAttribute('aria-expanded')+' '+!q('#settings').hidden;"),'false true','Esc 只關選單，不關設定面板');
}

export async function 下拉選單可用滑鼠並點外面關閉({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();await openSettings(page);
  await page.click('#weather-preview');
  assert.equal(await page.run("return qa('#weather-preview-options li').length;"),11,'有 10 種天氣（含彩虹）加上「依實際天氣」');
  await page.run("qa('#weather-preview-options li').find(li=>li.textContent.trim()==='下雨').click();await w(300);");
  assert.equal(await page.run("return q('#weather-preview-label').textContent;"),'下雨');
  await page.click('#weather-preview');
  await page.run("q('#settings .settings-head').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await w(200);");
  assert.equal(await page.run("return q('#weather-preview').getAttribute('aria-expanded');"),'false','點外面會關閉');
}

export async function 天氣預覽標籤不斷行({open,assert}){
  for(const [width,height] of [[1400,820],[375,760]]){
    const page=await open({viewport:[width,height],now:NOON,weather:clearWeather});await page.goto();await openSettings(page);
    const lineHeight=await page.run("const l=q('#weather-preview-field');return l.getBoundingClientRect().height/parseFloat(getComputedStyle(l).lineHeight);");
    assert(lineHeight<1.5,`${width}px 寬：「天氣預覽」應單行，行數約 ${lineHeight.toFixed(2)}`);
    await page.close();
  }
}

export async function 標題列的天氣與時間不重疊也不超出畫面({open,assert}){
  for(const [width,height,mobile] of [[1400,820,false],[820,900,false],[375,760,true]]){
    const page=await open({viewport:[width,height],now:NOON,weather:clearWeather});await page.goto();
    await page.waitFor("!q('#current-weather').hidden");
    const box=await page.run("const r=s=>{const b=q(s).getBoundingClientRect();return [b.left,b.top,b.right,b.bottom];};return {chip:r('#current-weather'),time:r('#current-time'),controls:r('.header-controls'),overflow:document.documentElement.scrollWidth>innerWidth};");
    const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
    assert(!overlap(box.chip,box.time),`${width}px：天氣與時間重疊`);
    assert(!overlap(box.chip,box.controls),`${width}px：天氣與控制按鈕重疊`);
    assert(box.chip[0]>=0&&box.chip[2]<=width,`${width}px：天氣超出畫面`);
    assert.equal(box.overflow,false,`${width}px：不應橫向捲動`);
    await page.close();
  }
}

export async function 飛碟面板開啟時透明度只增不減沒有閃爍({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run("q('#settings-toggle').click();await w(600);q('#edit-ufo').disabled=false;");
  const samples=await page.run(`const out=[];const t0=performance.now();(function f(){const panel=q('.route-panel');if(panel&&!q('#route-editor').hidden)out.push(+getComputedStyle(panel).opacity);if(performance.now()-t0<2500)requestAnimationFrame(f);})();q('#edit-ufo').click();await w(2800);return out;`);
  assert(samples.length>=3,`取樣太少：${samples}`);
  assert.equal(samples.at(-1),1,`最後應完全顯示：${samples}`);
  for(let i=1;i<samples.length;i++)assert(samples[i]>=samples[i-1]-0.001,`透明度不應回落（閃爍）：${samples}`);
}

export async function 手機版六個場景按鈕放得下且保留目前名稱({open,assert}){
  const page=await open({viewport:[375,760],now:NOON,weather:clearWeather});await page.goto();
  const info=await page.run("const b=q('.biome-switch').getBoundingClientRect();return {left:b.left,right:b.right,buttons:qa('.biome').length,labels:qa('.biome').filter(x=>getComputedStyle(x.querySelector('span')).display!=='none').map(x=>x.textContent.trim()),overflow:document.documentElement.scrollWidth>innerWidth};");
  assert.equal(info.buttons,6);assert(info.left>=0&&info.right<=375,`切換列超出畫面：${info.left}–${info.right}`);
  assert.deepEqual(info.labels,['草原'],'手機上只顯示目前場景的名稱');assert.equal(info.overflow,false);
  await page.run("q('[data-biome=\"city\"]').click();await w(400);");
  assert.deepEqual(await page.run("return qa('.biome').filter(x=>getComputedStyle(x.querySelector('span')).display!=='none').map(x=>x.textContent.trim());"),['城市']);
  await sleep(500);
}
