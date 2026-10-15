import {tools} from './tools.js';

const $ = (s) => document.querySelector(s);
const grid = $('#tool-grid');
const input = $('#search');
const dialog = $('#tool-dialog');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let savedNight=false;
try{savedNight=localStorage.getItem('tool-portal-night')==='true';}catch{}
const state = { paused: reduced.matches, biome: 'grass', quality: 'balanced', auto: false, night:savedNight };
let world;
let iconURLs = {};
let currentQuery = '';
let lastTrigger;
const fallbackIcons={chart:'▥',document:'▤',board:'▦',calendar:'▣',search:'⌕',form:'▤'};

function renderTools() {
  const q = input.value.trim().toLocaleLowerCase();
  currentQuery=q;
  const filtered=tools.filter(t=>`${t.title} ${t.description} ${t.keywords}`.toLocaleLowerCase().includes(q));
  grid.replaceChildren(...filtered.map(t=>{
    const item=document.createElement(t.url ? 'a' : 'button');
    item.className='tool-tile';
    item.dataset.tool=t.id;
    if(t.url){item.href=t.url;item.target='_blank';item.rel='noopener noreferrer';}
    else item.type='button';
    const art=iconURLs[t.icon] ? Object.assign(document.createElement('img'),{src:iconURLs[t.icon],alt:'',className:'tool-art',width:120,height:120}) : Object.assign(document.createElement('span'),{textContent:fallbackIcons[t.icon],className:'tool-fallback'});
    art.setAttribute('aria-hidden','true');
    const title=Object.assign(document.createElement('span'),{textContent:t.title,className:'tool-name'});
    const hint=Object.assign(document.createElement('span'),{textContent:t.url?'開啟工具':'查看範例',className:'tile-hint'});
    const arrow=Object.assign(document.createElement('span'),{textContent:'↗',className:'tile-arrow'});arrow.setAttribute('aria-hidden','true');
    item.append(art,title,hint,arrow);
    if(!t.url){item.setAttribute('aria-haspopup','dialog');item.addEventListener('click',()=>showTool(t,item));}
    else item.setAttribute('aria-label',`${t.title}（另開分頁）`);
    return item;
  }));
  $('#empty').hidden=filtered.length>0;
  $('#result-label').textContent=q ? `找到 ${filtered.length} 個工具` : '選一個工具，開始吧';
  $('#announcer').textContent=q ? `找到 ${filtered.length} 個工具` : '';
}
function openDialog(trigger){lastTrigger=trigger;dialog.showModal();}
function showTool(t,trigger){
  $('#dialog-kicker').textContent='範例工具 · 尚未串接';
  $('#dialog-title').textContent=t.title;
  $('#dialog-copy').textContent=t.description;
  $('#dialog-note').hidden=false;
  $('#demo-area').replaceChildren();
  $('#dialog-done').textContent='回到工具基地';
  openDialog(trigger);
}
function closeDialog(){dialog.close();lastTrigger?.focus({preventScroll:true});}
$('.dialog-close').addEventListener('click',closeDialog);
$('#dialog-done').addEventListener('click',closeDialog);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('#help').addEventListener('click',()=>{
  $('#dialog-kicker').textContent='PROTOTYPE · 使用說明';
  $('#dialog-title').textContent='歡迎來到工具基地';
  $('#dialog-copy').textContent='這是一個真正由 3D 場景與網頁元件組成的可操作原型。';
  $('#dialog-note').hidden=true;
  $('#demo-area').innerHTML='<ul><li>點選大方塊可查看範例工具說明。實際公司網址尚未設定。</li><li>按 Ctrl / ⌘ + K 快速搜尋，按 Esc 清除搜尋或關閉視窗。</li><li>下方可切換草原、沙漠；右上角可暫停背景。</li><li>設定中可切換畫質、開啟每 30 秒輪換環境，並查看即時效能。</li></ul>';
  $('#dialog-done').textContent='開始探索';openDialog($('#help'));
});
function searchGoogle(){
  const query=input.value.trim();
  if(!query){input.focus();return;}
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`,'_blank','noopener,noreferrer');
}
$('.search').addEventListener('submit',e=>{e.preventDefault();searchGoogle();});
input.addEventListener('input',renderTools);
$('#clear-search').addEventListener('click',()=>{input.value='';renderTools();input.focus();});
$('#google-search-empty').addEventListener('click',searchGoogle);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.open)closeDialog();input.focus();input.select();}
  if(e.key==='Escape'&&!dialog.open){if(!$('#settings').hidden)toggleSettings(false);else if(currentQuery){input.value='';renderTools();}}
});
function updatePause(){
  $('#pause').setAttribute('aria-pressed',String(state.paused));
  $('#pause-icon').textContent=state.paused?'▷':'Ⅱ';
  $('#pause-label').textContent=state.paused?'播放動畫':'暫停動畫';
  world?.setPaused(state.paused);
}
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;updatePause();});
function updateNight(){
  document.documentElement.dataset.theme=state.night?'night':'day';
  $('#night').setAttribute('aria-pressed',String(state.night));
  $('#night').setAttribute('aria-label',state.night?'切換白天模式':'切換黑夜模式');
  $('#night').title=state.night?'切換白天模式':'切換黑夜模式';
  $('#night').textContent=state.night?'☀':'☾';
  document.querySelector('meta[name="theme-color"]').content=state.night?'#101c35':'#dceff2';
  world?.setNight(state.night);
}
$('#night').addEventListener('click',()=>{
  state.night=!state.night;updateNight();
  try{localStorage.setItem('tool-portal-night',String(state.night));}catch{}
  $('#announcer').textContent=state.night?'已切換黑夜模式':'已切換白天模式';
});
reduced.addEventListener('change',e=>{if(e.matches){state.paused=true;updatePause();}});
function setBiome(b){
  state.biome=b;
  document.querySelectorAll('[data-biome]').forEach(btn=>{const active=btn.dataset.biome===b;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
  world?.setBiome(b);
  $('#announcer').textContent=`已切換為${b==='grass'?'草原':'沙漠'}環境`;
}
document.querySelectorAll('[data-biome]').forEach(btn=>btn.addEventListener('click',()=>setBiome(btn.dataset.biome)));
function toggleSettings(force){const open=force??$('#settings').hidden;$('#settings').hidden=!open;$('#settings-toggle').setAttribute('aria-expanded',String(open));if(!open)$('#settings-toggle').focus({preventScroll:true});}
$('#settings-toggle').addEventListener('click',()=>toggleSettings());
$('#settings-close').addEventListener('click',()=>toggleSettings(false));
document.addEventListener('pointerdown',e=>{if(!$('#settings').hidden&&!$('#settings').contains(e.target)&&!$('#settings-toggle').contains(e.target)){$('#settings').hidden=true;$('#settings-toggle').setAttribute('aria-expanded','false');}});
$('#quality').addEventListener('change',e=>{state.quality=e.target.value;world?.setQuality(state.quality);});
$('#auto-biome').addEventListener('change',e=>{state.auto=e.target.checked;});
let lastAuto=0;
function report(stats){
  $('#diagnostics').replaceChildren(...Object.entries({'渲染':'Three.js / WebGL2','畫面更新':`${stats.fps} FPS`,'繪製呼叫':stats.calls,'三角形':stats.triangles.toLocaleString(),'動態':state.paused?'已暫停':document.hidden?'分頁暫停':'播放中'}).flatMap(([k,v])=>[Object.assign(document.createElement('dt'),{textContent:k}),Object.assign(document.createElement('dd'),{textContent:String(v)})]));
  if(state.auto&&!state.paused){lastAuto+=stats.interval;if(lastAuto>=30){setBiome(state.biome==='grass'?'desert':'grass');lastAuto=0;}}
}
renderTools();updatePause();updateNight();
try{
  const {createWorld}=await import('./world.js');
  world=await createWorld($('#world'),{paused:state.paused,biome:state.biome,quality:state.quality,night:state.night,onStats:report});
  iconURLs=world.icons;
  renderTools();
  $('#render-status').textContent=reduced.matches?'已依系統偏好暫停背景，可手動播放。':'3D 世界已就緒 · 恐龍準備出發';
  document.documentElement.dataset.world='ready';
}catch(error){
  console.error('3D initialization failed:',error);
  $('#render-status').textContent='此裝置無法啟用 3D，仍可使用搜尋與工具入口。';
  $('#pause').disabled=true;$('#quality').disabled=true;$('#auto-biome').disabled=true;
  document.documentElement.dataset.world='fallback';
}
