import {sampleWeather} from './harness.mjs';

const chipState=session=>session.run(`const c=q('#current-weather'),r=c.getBoundingClientRect();return {hidden:c.hidden,text:c.textContent.trim().replace(/\\s+/g,' '),expanded:c.getAttribute('aria-expanded'),box:[r.x,r.y,r.width,r.height]};`);
const popState=session=>session.run(`const p=q('#weather-popover'),r=p.getBoundingClientRect();return {hidden:p.hidden,title:q('#weather-pop-title').textContent,temp:q('#weather-pop-temp').textContent,details:qa('#weather-pop-details div').map(d=>d.textContent),forecast:qa('#weather-pop-forecast li').map(li=>li.textContent.replace(/\\s+/g,' ').trim()),note:q('#weather-pop-note').textContent,refreshHidden:q('#weather-pop-refresh').hidden,box:[r.left,r.top,r.right,r.bottom],focus:document.activeElement?.id};`);

export async function 標題列顯示目前天氣({open,assert}){
  const page=await open({});await page.goto();
  await page.waitFor("!q('#current-weather').hidden",15000,'天氣標籤出現');
  const chip=await chipState(page);
  assert.match(chip.text,/多雲/);assert.match(chip.text,/27°C/);
  assert.equal(chip.expanded,'false');
}

export async function 點開可看詳細與未來三天({open,assert}){
  const page=await open({});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.click('#current-weather');
  await page.waitFor("!q('#weather-popover').hidden");
  const pop=await popState(page),chip=await chipState(page);
  assert.equal(chip.expanded,'true');assert.equal(pop.title,'多雲');assert.equal(pop.temp,'27°C');
  assert(pop.details.some(d=>d.includes('濕度')&&d.includes('68%')),`濕度：${pop.details}`);
  assert(pop.details.some(d=>d.includes('風')&&d.includes('微風')&&d.includes('3.4 m/s')),`風：${pop.details}`);
  assert(pop.details.some(d=>d.includes('雲量')&&d.includes('55%')));
  assert(pop.details.some(d=>d.includes('能見度')&&d.includes('24 公里以上')));
  assert.equal(pop.forecast.length,3);
  assert.match(pop.forecast[0],/今天.*多雲.*24–30°C.*降雨 10%/);
  assert.match(pop.forecast[1],/明天.*下雨.*23–28°C.*降雨 70%/);
  assert.match(pop.forecast[2],/後天.*晴朗.*24–31°C.*降雨 5%/);
  assert.match(pop.note,/Open-Meteo/);
  assert.equal(pop.focus,'weather-pop-close','開啟後焦點移到關閉鈕');
  await page.screenshot('open');
}

export async function Esc與點外面都能關閉並還原焦點({open,assert}){
  const page=await open({});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  await page.key('Escape',27);
  await page.waitFor("q('#weather-popover').hidden",5000,'Esc 關閉');
  assert.equal((await chipState(page)).expanded,'false');
  assert.equal(await page.run("return document.activeElement.id;"),'current-weather','焦點回到天氣標籤');
  assert.equal(await page.run("return q('#settings').hidden;"),true,'Esc 不應連帶開啟或關閉設定');
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  await page.run("document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));");
  await page.waitFor("q('#weather-popover').hidden",5000,'點外面關閉');
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  await page.click('#current-weather');
  await page.waitFor("q('#weather-popover').hidden",5000,'再按標籤關閉');
}

export async function 立即更新會重新取得資料({open,assert}){
  const page=await open({});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  const before=await page.run("return window.__weatherCalls;");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  await page.run("window.__weatherBody={...${JSON.stringify(sampleWeather)},current:{...${JSON.stringify(sampleWeather.current)},temperature_2m:31.6,weather_code:63}};".replace('${JSON.stringify(sampleWeather)}',JSON.stringify(sampleWeather)).replace('${JSON.stringify(sampleWeather.current)}',JSON.stringify(sampleWeather.current)));
  await page.click('#weather-pop-refresh');
  await page.waitFor("q('#weather-pop-temp').textContent==='32°C'",10000,'顯示新氣溫');
  assert((await page.run("return window.__weatherCalls;"))>before,'應該重新呼叫天氣服務');
  assert.equal(await page.run("return q('#weather-pop-title').textContent;"),'下雨');
}

export async function 預覽時標示並隱藏實際數據({open,assert}){
  const page=await open({});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.run("q('#settings-toggle').click();await w(500);q('#weather-preview').click();await w(300);qa('#weather-preview-options li').find(li=>li.textContent.includes('下雪')).click();await w(600);");
  const chip=await chipState(page);
  assert.match(chip.text,/下雪（預覽）/);assert(!/°C/.test(chip.text),'預覽時不顯示氣溫');
  await page.run("q('#settings-close').click();await w(500);");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  const pop=await popState(page);
  assert.equal(pop.title,'下雪');assert.equal(pop.temp,'');assert.equal(pop.details.length,0);assert.equal(pop.forecast.length,0);
  assert.match(pop.note,/天氣預覽/);assert.equal(pop.refreshHidden,true);
}

export async function 沒有所在地時不顯示({open,assert}){
  const page=await open({location:null});await page.goto();
  assert.equal((await chipState(page)).hidden,true);
  assert.equal(await page.run("return q('#weather-link').disabled;"),true);
}

export async function 手機版不超出畫面({open,assert}){
  const page=await open({viewport:[375,760]});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");await page.run('await w(400);');
  const pop=await popState(page);
  assert(pop.box[0]>=0&&pop.box[2]<=375,`左右不超出：${pop.box}`);
  assert(pop.box[1]>=0&&pop.box[3]<=760,`上下不超出：${pop.box}`);
  assert.equal(await page.run('return document.documentElement.scrollWidth>innerWidth;'),false,'不應橫向捲動');
  await page.screenshot('mobile');
}

export async function 舊版快取沒有預報時會立刻重新取得({open,assert}){
  // 舊版程式存下的天氣（沒有 schema、沒有三日預報）仍在有效期內，使用者升級後卻看不到預報
  const old=JSON.stringify({key:'23.99,121.61',at:Date.now()-60000,current:sampleWeather.current});
  const page=await open({storage:{'tool-portal-weather-v1':old}});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  const pop=await popState(page);
  assert.equal(pop.forecast.length,3,'升級後應立刻有三日預報');
  assert((await page.run('return window.__weatherCalls;'))>=1,'應重新呼叫天氣服務');
}

export async function 預報缺少時顯示說明而不是整段消失({open,assert}){
  const noDaily={current:sampleWeather.current};
  const page=await open({weather:noDaily});await page.goto();
  await page.waitFor("!q('#current-weather').hidden");
  await page.click('#current-weather');await page.waitFor("!q('#weather-popover').hidden");
  assert.equal(await page.run("return qa('#weather-pop-forecast li').length;"),0);
  assert.equal(await page.run("return !q('#weather-pop-forecast-empty').hidden&&!q('#weather-pop-forecast-section').hidden;"),true,'顯示「預報尚未取得」的說明');
}
