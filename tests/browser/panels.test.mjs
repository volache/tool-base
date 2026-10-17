import {clearWeather,sleep} from './harness.mjs';

const NOON='2026-10-18T12:00:00+08:00';
const rect=(page,selector)=>page.run(`const b=q(${JSON.stringify(selector)}).getBoundingClientRect();return {width:b.width,height:b.height,top:b.top,bottom:b.bottom,left:b.left,right:b.right};`);
const visible=(page,selector)=>page.run(`const e=q(${JSON.stringify(selector)});return !!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;`);

async function openSunPreview(page){
  await page.run("q('#settings-toggle').click();await w(600);q('#sun-preview-start').click();await w(1500);");
  await page.waitFor("!q('#sun-preview').hidden");
}

export async function 日月預覽面板可縮小並仍可拖曳時間({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await openSunPreview(page);
  const full=await rect(page,'#sun-preview');
  await page.run("q('#sun-preview .panel-collapse').click();await w(400);");
  const small=await rect(page,'#sun-preview');
  assert(small.height<full.height*.55,`縮小後應明顯變矮：${Math.round(full.height)} → ${Math.round(small.height)}`);
  assert(small.height<230,`縮小後的高度應小於 230px：${Math.round(small.height)}`);
  assert.equal(await visible(page,'#sun-preview-range'),true,'縮小後仍保留時間滑桿');
  assert.equal(await visible(page,'#sun-preview-time'),true);
  assert.equal(await visible(page,'#sun-preview-play'),true,'縮小後仍保留播放鈕');
  assert.equal(await visible(page,'#sun-preview-rise'),false,'細節與說明被收起');
  assert.equal(await page.run("return q('#sun-preview .panel-collapse').getAttribute('aria-expanded');"),'false');
  // 縮小狀態下仍可拖曳時間
  await page.run("const r=q('#sun-preview-range');r.value='600';r.dispatchEvent(new Event('input',{bubbles:true}));await w(400);");
  assert.equal(await page.run("return q('#sun-preview-time').textContent;"),'10:00');
  await page.screenshot('collapsed');
  await page.run("q('#sun-preview .panel-collapse').click();await w(400);");
  const again=await rect(page,'#sun-preview');
  assert(Math.abs(again.height-full.height)<4,`展開後恢復原高：${Math.round(full.height)} vs ${Math.round(again.height)}`);
  assert.equal(await visible(page,'#sun-preview-rise'),true);
}

export async function 月亮預覽面板同樣可縮小且重新整理後記住({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run("q('#settings-toggle').click();await w(600);q('#moon-preview-start').click();await w(1500);q('#moon-preview .panel-collapse').click();await w(400);");
  assert.equal(await page.run("return q('#moon-preview').classList.contains('is-collapsed');"),true);
  await page.goto();
  await page.run("q('#settings-toggle').click();await w(600);q('#moon-preview-start').click();await w(1500);");
  assert.equal(await page.run("return q('#moon-preview').classList.contains('is-collapsed');"),true,'重新整理後仍是縮小狀態');
  assert.equal(await page.run("return q('#sun-preview').classList.contains('is-collapsed');"),false,'太陽面板各自記錄，不受影響');
}

export async function 飛碟面板可縮小只留航線選擇與狀態({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await page.run("q('#settings-toggle').click();await w(600);q('#edit-ufo').disabled=false;q('#edit-ufo').click();await w(1500);");
  await page.waitFor("!q('#route-editor').hidden");
  const full=await rect(page,'.route-panel');
  await page.run("q('.route-panel .panel-collapse').click();await w(400);");
  const small=await rect(page,'.route-panel');
  assert(small.height<full.height*.45,`縮小後應明顯變矮：${Math.round(full.height)} → ${Math.round(small.height)}`);
  assert(small.height<260,`縮小後高度：${Math.round(small.height)}`);
  assert.equal(await visible(page,'#route-choice'),true,'仍可選擇航線');
  assert.equal(await visible(page,'#route-status'),true);
  assert.equal(await visible(page,'#point-add'),false,'編輯細節被收起');
  assert.equal(await visible(page,'#route-overlay'),true,'航線編輯畫面仍在');
  // 軌跡操作區域變大：右側原本被面板蓋住的區域現在是空的
  const covered=await page.run("const p=q('.route-panel').getBoundingClientRect();return document.elementFromPoint(p.left+40,Math.min(innerHeight-20,p.top+420))?.closest('.route-panel')===null;");
  assert.equal(covered,true,'面板下方原本被蓋住的位置現在不被面板擋住');
  await page.screenshot('route-collapsed');
}

export async function 縮小按鈕可用鍵盤操作且標示正確({open,assert}){
  const page=await open({now:NOON,weather:clearWeather});await page.goto();
  await openSunPreview(page);
  await page.run("q('#sun-preview .panel-collapse').focus();");
  assert.equal(await page.run("return q('#sun-preview .panel-collapse').getAttribute('aria-label');"),'縮小面板');
  await page.key('Enter',13);
  assert.equal(await page.run("return q('#sun-preview').classList.contains('is-collapsed');"),true);
  assert.equal(await page.run("return q('#sun-preview .panel-collapse').getAttribute('aria-label');"),'展開面板');
  assert.equal(await page.run("return document.activeElement===q('#sun-preview .panel-collapse');"),true,'切換後焦點不離開按鈕');
  await page.key(' ',32);
  assert.equal(await page.run("return q('#sun-preview').classList.contains('is-collapsed');"),false);
}

export async function 手機版縮小後面板很矮({open,assert}){
  const page=await open({viewport:[375,760],now:NOON,weather:clearWeather});await page.goto();
  await openSunPreview(page);
  const full=await rect(page,'#sun-preview');
  await page.run("q('#sun-preview .panel-collapse').click();await w(400);");
  const small=await rect(page,'#sun-preview');
  assert(small.height<full.height*.7&&small.height<200,`手機縮小後：${Math.round(full.height)} → ${Math.round(small.height)}`);
  assert(small.left>=0&&small.right<=375,'不超出畫面');
  await sleep(300);
}
