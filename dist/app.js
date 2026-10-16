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
const clockTime=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockDate=new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',weekday:'short'});
function updateClock(){
  const now=new Date(),label=clockTime.format(now);
  if($('#current-time').textContent!==label)$('#current-time').textContent=label;
  $('#current-time').dateTime=now.toISOString();
  $('#current-time').title=`本機時間 · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  $('#current-date').textContent=clockDate.format(now);
}
updateClock();setInterval(updateClock,1000);
let uiTransition;
function transitionTools(){
  if(reduced.matches||!document.startViewTransition){renderTools();return;}
  uiTransition?.skipTransition();
  uiTransition=document.startViewTransition(renderTools);
  uiTransition.finished.catch(()=>{});
}

function renderTools() {
  const q = input.value.trim().toLocaleLowerCase();
  currentQuery=q;
  const filtered=tools.filter(t=>`${t.title} ${t.description} ${t.keywords}`.toLocaleLowerCase().includes(q));
  grid.replaceChildren(...filtered.map(t=>{
    const item=document.createElement(t.url ? 'a' : 'button');
    item.className='tool-tile';
    item.dataset.tool=t.id;
    item.style.viewTransitionName=`tool-${t.id}`;
    if(t.url){item.href=t.url;item.target='_blank';item.rel='noopener noreferrer';}
    else item.type='button';
    const art=iconURLs[t.icon] ? Object.assign(document.createElement('img'),{src:iconURLs[t.icon],alt:'',className:'tool-art',width:120,height:120}) : Object.assign(document.createElement('span'),{textContent:fallbackIcons[t.icon],className:'tool-fallback'});
    art.setAttribute('aria-hidden','true');
    const title=Object.assign(document.createElement('span'),{textContent:t.title,className:'tool-name'});
    const hint=Object.assign(document.createElement('span'),{textContent:t.url?'開啟工具':'工具資訊',className:'tile-hint'});
    const arrow=Object.assign(document.createElement('span'),{textContent:'↗',className:'tile-arrow'});arrow.setAttribute('aria-hidden','true');
    item.append(art,title,hint,arrow);
    if(!t.url){item.setAttribute('aria-haspopup','dialog');item.addEventListener('click',()=>showTool(t,item));}
    else item.setAttribute('aria-label',`${t.title}（另開分頁）`);
    return item;
  }));
  $('#empty').hidden=filtered.length>0;
  $('#result-label').textContent=q ? `找到 ${filtered.length} 個工具` : '選一個工具，開始吧';
  $('#tool-count').textContent=`${filtered.length} 個工具`;
  $('#announcer').textContent=q ? `找到 ${filtered.length} 個工具` : '';
}
let closingDialog=false;
function openDialog(trigger){
  lastTrigger=trigger;dialog.showModal();
  if(!reduced.matches){
    const from=trigger.getBoundingClientRect(),to=dialog.getBoundingClientRect();
    const dx=(from.left+from.width/2-to.left-to.width/2)*.16,dy=(from.top+from.height/2-to.top-to.height/2)*.16;
    dialog.animate([{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.92)`},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
}
function showTool(t,trigger){
  $('#dialog-kicker').textContent='工具資訊';
  $('#dialog-title').textContent=t.title;
  $('#dialog-copy').textContent=t.description;
  $('#dialog-note').hidden=false;
  $('#demo-area').replaceChildren();
  $('#dialog-done').textContent='回到工具基地';
  openDialog(trigger);
}
function closeDialog({focusTarget}={}){
  if(closingDialog||!dialog.open)return;
  const finish=()=>{dialog.close();closingDialog=false;(focusTarget||lastTrigger)?.focus({preventScroll:true});if(focusTarget===input)input.select();};
  if(reduced.matches){finish();return;}
  closingDialog=true;
  dialog.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(8px) scale(.97)'}],{duration:150,easing:'ease-in'}).finished.then(finish,finish);
}
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
$('.dialog-close').addEventListener('click',closeDialog);
$('#dialog-done').addEventListener('click',closeDialog);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('#help').addEventListener('click',()=>{
  $('#dialog-kicker').textContent='使用說明';
  $('#dialog-title').textContent='歡迎來到工具基地';
  $('#dialog-copy').textContent='快速找到工作所需，讓每天的開始更輕快。';
  $('#dialog-note').hidden=true;
  $('#demo-area').innerHTML='<ul><li>點選工具可開啟服務或查看工具資訊。</li><li>輸入關鍵字尋找工具；按 Enter 或 Google 搜尋網路資訊。</li><li>按 Ctrl / ⌘ + K 快速搜尋，按 Esc 清除搜尋或關閉視窗。</li><li>下方可切換草原、沙漠與海岸；右上角可切換日夜、暫停動畫或調整畫質。</li></ul>';
  $('#dialog-done').textContent='開始探索';openDialog($('#help'));
});
function searchGoogle(){
  const query=input.value.trim();
  if(!query){input.focus();return;}
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`,'_blank','noopener,noreferrer');
}
$('.search').addEventListener('submit',e=>{e.preventDefault();searchGoogle();});
input.addEventListener('input',transitionTools);
$('#clear-search').addEventListener('click',()=>{input.value='';transitionTools();input.focus();});
$('#google-search-empty').addEventListener('click',searchGoogle);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.open){closeDialog({focusTarget:input});return;}input.focus();input.select();}
  if(e.key==='Escape'&&!dialog.open){if(!$('#settings').hidden)toggleSettings(false);else if(currentQuery){input.value='';transitionTools();}}
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
  $('#announcer').textContent=`已切換為${({grass:'草原',desert:'沙漠',coast:'海岸'})[b]}環境`;
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
  if(state.auto&&!state.paused){lastAuto+=stats.interval;if(lastAuto>=30){const order=['grass','desert','coast'];setBiome(order[(order.indexOf(state.biome)+1)%order.length]);lastAuto=0;}}
}
renderTools();updatePause();updateNight();
try{
  const {createWorld}=await import('./world.js');
  world=await createWorld($('#world'),{paused:state.paused,biome:state.biome,quality:state.quality,night:state.night,reducedMotion:reduced.matches,onStats:report});
  world.setBiome(state.biome);
  iconURLs=world.icons;
  renderTools();
  $('#render-status').textContent=reduced.matches?'已依系統偏好暫停背景，可手動播放。':'';
  document.documentElement.dataset.world='ready';
}catch(error){
  console.error('3D initialization failed:',error);
  $('#render-status').textContent='此裝置無法啟用 3D，仍可使用搜尋與工具入口。';
  $('#pause').disabled=true;$('#quality').disabled=true;$('#auto-biome').disabled=true;
  document.documentElement.dataset.world='fallback';
}
