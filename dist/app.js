import {tools} from './tools.js';
import {initCompanyLocation,readCompanyLocation} from './company-location.js';
import {getSkyNight} from './sky-model.js';
import {createWeatherService,weatherPresets,weatherLabels,windLabel,visibilityLabel} from './weather.js';
import {createCombobox} from './combobox.js';
import {initMoonSky} from './moon-sky.js';
import {initSunSky} from './sun-sky.js';
import {initSkySettings} from './sky-settings.js';
import './vendor/lucide.min.js';

const $ = (s) => document.querySelector(s);
const grid = $('#tool-grid');
const input = $('#search');
const dialog = $('#tool-dialog');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let savedNight=false;
try{savedNight=localStorage.getItem('tool-portal-night')==='true';}catch{}
let savedRotation=30;
try{const value=Number(localStorage.getItem('tool-portal-rotation'));if(value>=10&&value<=120)savedRotation=Math.round(value/5)*5;}catch{}
const state = { paused: reduced.matches, biome: 'grass', quality: 'balanced', auto: false, rotation:savedRotation, night:savedNight };
let world;
// With a company location the sky follows the real sun (and dawn/dusk); the moon/sun button then switches to manual day/night.
let autoSky=true;try{autoSky=localStorage.getItem('tool-portal-auto-sky')!=='false';}catch{}
let routeEditing=false;
function saveAutoSky(){try{localStorage.setItem('tool-portal-auto-sky',String(autoSky));}catch{}}
function autoSkyLocation(){return autoSky&&!routeEditing?readCompanyLocation():null;}
function applyAutoSky(){
  const location=autoSkyLocation(),saved=readCompanyLocation();
  $('#auto-sky').checked=autoSky;$('#auto-sky').disabled=!saved;
  $('#auto-sky-hint').textContent=!saved?'請先設定公司所在地。':autoSky?'依所在地真實的日出日落調整日夜與晨昏':'以右上角按鈕手動切換日夜';
  if(!world)return;
  world.setAutoSky(location);
  if(location)state.night=world.isNight();
  updateNight();
}
{const location=autoSkyLocation();if(location)state.night=getSkyNight(globalThis.SunCalc.getPosition(new Date(),location.lat,location.lng).altitude)>.5;}
let activityMode='standard';try{const saved=localStorage.getItem('tool-portal-activity');if(['quiet','standard','rich'].includes(saved))activityMode=saved;}catch{}
function updateActivity(){document.querySelectorAll('button[data-activity]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.activity===activityMode)));world?.setActivity(activityMode);}
document.querySelectorAll('button[data-activity]').forEach(button=>button.addEventListener('click',()=>{activityMode=button.dataset.activity;try{localStorage.setItem('tool-portal-activity',activityMode);}catch{}updateActivity();}));
updateActivity();
let iconURLs = {};
let currentQuery = '';
let lastTrigger;
const fallbackIcons={chart:'chart-column',document:'files',board:'panels-top-left',calendar:'calendar-days',search:'search',form:'clipboard-list'};
function createIcon(name){const node=document.createElement('i');node.dataset.lucide=name;node.setAttribute('aria-hidden','true');return node;}
function refreshIcons(){globalThis.lucide.createIcons({attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});}
const clockTime=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockWeekday=new Intl.DateTimeFormat('zh-TW',{weekday:'short'});
function updateClock(){
  const now=new Date(),label=clockTime.format(now);
  if($('#current-time').textContent!==label)$('#current-time').textContent=label;
  $('#current-time').dateTime=now.toISOString();
  $('#current-time').title=`本機時間 · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  $('#current-date').textContent=`${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${clockWeekday.format(now)}`;
}
updateClock();setInterval(updateClock,1000);
initCompanyLocation();
initSkySettings(savedNight?'moon':'sun');
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
    const art=iconURLs[t.icon] ? Object.assign(document.createElement('img'),{src:iconURLs[t.icon],alt:'',className:'tool-art',width:120,height:120}) : Object.assign(document.createElement('span'),{className:'tool-fallback'});
    if(!iconURLs[t.icon])art.append(createIcon(fallbackIcons[t.icon]));
    art.setAttribute('aria-hidden','true');
    const title=Object.assign(document.createElement('span'),{textContent:t.title,className:'tool-name'});
    const hint=Object.assign(document.createElement('span'),{textContent:t.url?'開啟工具':'工具資訊',className:'tile-hint'});
    const arrow=Object.assign(document.createElement('span'),{className:'tile-arrow'});arrow.append(createIcon('arrow-up-right'));arrow.setAttribute('aria-hidden','true');
    item.append(art,title,hint,arrow);
    if(!t.url){item.setAttribute('aria-haspopup','dialog');item.addEventListener('click',()=>showTool(t,item));}
    else item.setAttribute('aria-label',`${t.title}（另開分頁）`);
    return item;
  }));
  $('#empty').hidden=filtered.length>0;
  $('#result-label').textContent=q ? `找到 ${filtered.length} 個工具` : '選一個工具，開始吧';
  $('#tool-count').textContent=`${filtered.length} 個工具`;
  $('#announcer').textContent=q ? `找到 ${filtered.length} 個工具` : '';
  refreshIcons();
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
  if($('#location-dialog').open||!$('#moon-preview').hidden||!$('#sun-preview')?.hidden)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.open){closeDialog({focusTarget:input});return;}input.focus();input.select();}
  if(e.key==='Escape'&&!dialog.open){if(!$('#settings').hidden)toggleSettings(false);else if(currentQuery){input.value='';transitionTools();}}
});
function updatePause(){
  $('#pause').setAttribute('aria-pressed',String(state.paused));
  $('#pause-icon').replaceChildren(createIcon(state.paused?'play':'pause'));
  const label=state.paused?'播放動畫':'暫停動畫';
  $('#pause').setAttribute('aria-label',label);$('#pause').title=label;
  world?.setPaused(state.paused);
  refreshIcons();
}
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;updatePause();});
function updateNight(){
  document.documentElement.dataset.theme=state.night?'night':'day';
  if(!world)document.documentElement.style.setProperty('--night',state.night?'1':'0');
  $('#night').setAttribute('aria-pressed',String(state.night));
  $('#night').setAttribute('aria-label',state.night?'切換白天模式':'切換黑夜模式');
  $('#night').title=state.night?'切換白天模式':'切換黑夜模式';
  $('#night').replaceChildren(createIcon(state.night?'sun':'moon'));
  document.querySelector('meta[name="theme-color"]').content=state.night?'#101c35':'#dceff2';
  world?.setNight(state.night);
  refreshIcons();
}
$('#night').addEventListener('click',()=>{
  if(autoSkyLocation()){autoSky=false;saveAutoSky();applyAutoSky();}
  state.night=!state.night;updateNight();
  try{localStorage.setItem('tool-portal-night',String(state.night));}catch{}
  $('#announcer').textContent=state.night?'已切換黑夜模式':'已切換白天模式';
});
reduced.addEventListener('change',e=>{if(e.matches){state.paused=true;updatePause();}});
function setBiome(b){
  lastAuto=0;
  state.biome=b;
  document.querySelectorAll('[data-biome]').forEach(btn=>{const active=btn.dataset.biome===b;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
  world?.setBiome(b);
  $('#announcer').textContent=`已切換為${({grass:'草原',desert:'沙漠',coast:'海岸',snow:'雪原',forest:'森林'})[b]}環境`;
}
document.querySelectorAll('[data-biome]').forEach(btn=>btn.addEventListener('click',()=>setBiome(btn.dataset.biome)));
let settingsCloseTimer=0;
function toggleSettings(force){
  const panel=$('#settings'),open=force??(panel.hidden||panel.classList.contains('is-closing'));
  clearTimeout(settingsCloseTimer);
  if(open){panel.hidden=false;panel.classList.remove('is-closing');requestAnimationFrame(()=>panel.classList.add('is-open'));}
  else{
    closeQuality();document.dispatchEvent(new Event('close-popups'));panel.classList.remove('is-open');panel.classList.add('is-closing');
    settingsCloseTimer=setTimeout(()=>{panel.hidden=true;panel.classList.remove('is-closing');$('#settings-toggle').focus({preventScroll:true});},190);
  }
  $('#settings-toggle').setAttribute('aria-expanded',String(open));
}
$('#settings-toggle').addEventListener('click',()=>toggleSettings());
$('#settings-close').addEventListener('click',()=>toggleSettings(false));
let launcherHidden=false;
function toggleLauncher(){launcherHidden=!launcherHidden;const launcher=$('.launcher'),button=$('#launcher-toggle');launcher.classList.toggle('is-hidden',launcherHidden);launcher.inert=launcherHidden;button.setAttribute('aria-pressed',String(launcherHidden));button.setAttribute('aria-label',launcherHidden?'顯示工具清單':'隱藏工具清單');button.title=launcherHidden?'顯示工具清單':'隱藏工具清單';button.innerHTML=`<i data-lucide="${launcherHidden?'panel-top-open':'panel-top-close'}" aria-hidden="true"></i>`;refreshIcons();}
$('#launcher-toggle').addEventListener('click',toggleLauncher);
document.addEventListener('pointerdown',e=>{
  if($('#location-dialog').open)return;
  if(!$('.quality-picker').contains(e.target))closeQuality();
  if(!$('#settings').hidden&&!$('#settings').contains(e.target)&&!$('#settings-toggle').contains(e.target))toggleSettings(false);
});
const qualityItems=[...document.querySelectorAll('[data-quality]')];
let qualityActive=0;
function highlightQuality(index){
  qualityActive=(index+qualityItems.length)%qualityItems.length;
  qualityItems.forEach((item,i)=>item.classList.toggle('highlighted',i===qualityActive));
  $('#quality').setAttribute('aria-activedescendant',qualityItems[qualityActive].id);
}
function openQuality(){
  if($('#quality').disabled)return;
  $('#quality-options').hidden=false;$('#quality').setAttribute('aria-expanded','true');
  highlightQuality(qualityItems.findIndex(item=>item.dataset.quality===state.quality));
}
function closeQuality(){
  $('#quality-options').hidden=true;$('#quality').setAttribute('aria-expanded','false');$('#quality').removeAttribute('aria-activedescendant');
}
function selectQuality(index){
  state.quality=qualityItems[index].dataset.quality;
  const labels={balanced:['均衡','清晰流暢，適合日常使用'],high:['精緻','更細緻的陰影與畫面'],low:['輕量','降低細節，節省電力']};
  const [name,description]=labels[state.quality];$('#quality-label').innerHTML=`<strong>${name}</strong><small>${description}</small>`;
  qualityItems.forEach((item,i)=>item.setAttribute('aria-selected',String(i===index)));
  world?.setQuality(state.quality);closeQuality();$('#quality').focus({preventScroll:true});
  $('#announcer').textContent=`畫質已設為${qualityItems[index].querySelector('strong').textContent}`;
}
$('#quality').addEventListener('click',()=>{$('#quality-options').hidden?openQuality():closeQuality();});
qualityItems.forEach((item,i)=>{
  item.addEventListener('click',()=>selectQuality(i));
  item.addEventListener('pointermove',()=>highlightQuality(i));
});
$('#quality').addEventListener('keydown',e=>{
  const open=!$('#quality-options').hidden;
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();if(!open)openQuality();
    if(e.key==='Home')highlightQuality(0);
    else if(e.key==='End')highlightQuality(qualityItems.length-1);
    else if(open)highlightQuality(qualityActive+(e.key==='ArrowDown'?1:-1));
  }else if(e.key==='Enter'||e.key===' '){e.preventDefault();open?selectQuality(qualityActive):openQuality();}
  else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();closeQuality();}
  else if(e.key==='Tab'&&open){selectQuality(qualityActive);}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){
    const i=qualityItems.findIndex(item=>item.dataset.quality.startsWith(e.key.toLowerCase()));
    if(i>=0){e.preventDefault();if(!open)openQuality();highlightQuality(i);}
  }
});
let lastAuto=0;
function updateRotation(){
  $('#rotation-controls').hidden=!state.auto;
  $('#rotation-speed').value=state.rotation;
  $('#rotation-label').textContent=`每 ${state.rotation} 秒`;
  $('#rotation-speed').setAttribute('aria-valuetext',`每 ${state.rotation} 秒切換場景`);
  $('#rotation-speed').style.setProperty('--range-progress',`${(state.rotation-10)/110*100}%`);
}
$('#auto-biome').addEventListener('change',e=>{state.auto=e.target.checked;lastAuto=0;updateRotation();});
$('#rotation-speed').addEventListener('input',e=>{
  state.rotation=Number(e.target.value);lastAuto=0;updateRotation();
  try{localStorage.setItem('tool-portal-rotation',String(state.rotation));}catch{}
});
updateRotation();
function report(stats){
  if(state.auto&&!state.paused){lastAuto+=stats.interval;if(lastAuto>=state.rotation){const order=['grass','desert','coast','snow','forest'];setBiome(order[(order.indexOf(state.biome)+1)%order.length]);lastAuto=0;}}
}
renderTools();updatePause();updateNight();
try{
  const {createWorld}=await import('./world.js');
  world=await createWorld($('#world'),{paused:state.paused,biome:state.biome,quality:state.quality,night:state.night,reducedMotion:reduced.matches,onStats:report,onSkyNight(night){state.night=night;updateNight();},onSkyMix(mix){document.documentElement.style.setProperty('--night',mix.toFixed(3));}});
  applyAutoSky();
  $('#auto-sky').addEventListener('change',event=>{autoSky=event.target.checked;saveAutoSky();applyAutoSky();$('#announcer').textContent=autoSky?'天色已改為隨所在地時間變化':'天色已改為手動切換';});
  window.addEventListener('company-location-change',applyAutoSky);
  // Weather: real conditions for the company location (on by default); the preview menu overrides them for this visit only.
  let weatherOn=true,weatherOverride='';
  try{weatherOn=localStorage.getItem('tool-portal-weather')!=='false';}catch{}
  const weatherClock=new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const weatherService=createWeatherService({getLocation:readCompanyLocation,onChange:renderWeather});
  const weatherIcons={'':'radio-tower',clear:'sun',partly:'cloud-sun',cloudy:'cloud',fog:'cloud-fog',drizzle:'cloud-drizzle',rain:'cloud-rain',snow:'snowflake',thunder:'cloud-lightning',windy:'wind',rainbow:'rainbow'};
  // Compact weather beside the clock: the real reading, or the previewed weather while previewing.
  function renderClockWeather(snapshot,location){
    const chip=$('#current-weather'),previewing=!!weatherOverride;
    const kind=previewing?weatherOverride:(weatherOn&&location&&snapshot.state?snapshot.state.kind:null);
    chip.hidden=!kind;
    if(!kind)return;
    const label=weatherLabels[kind],hasTemp=!previewing&&Number.isFinite(snapshot.temperature);
    $('#current-weather-label').textContent=previewing?`${label}（預覽）`:label;
    $('#current-weather-temp').textContent=hasTemp?`${Math.round(snapshot.temperature)}°C`:'';
    $('#current-weather-temp').hidden=!hasTemp;
    $('#current-weather-icon').replaceChildren(createIcon(weatherIcons[kind]));refreshIcons();
    chip.title=previewing?`天氣預覽：${label}`:`${label} · ${Math.round(snapshot.temperature)}°C · ${weatherClock.format(snapshot.updatedAt)} 更新 · 資料來源 Open-Meteo${snapshot.status==='error'?'（暫時無法更新）':''}`;
    chip.setAttribute('aria-label',chip.title);
  }
  // Details popover, opened from the chip beside the clock.
  const popover=$('#weather-popover'),chip=$('#current-weather');
  const dayNames=['今天','明天','後天'];
  function renderWeatherPopover(snapshot=weatherService.snapshot(),location=readCompanyLocation()){
    const previewing=!!weatherOverride,live=weatherOn&&location&&snapshot.state;
    const kind=previewing?weatherOverride:(live?snapshot.state.kind:null);
    if(!kind){if(!popover.hidden)closeWeatherPopover();return;}
    $('#weather-pop-kicker').textContent=previewing?'天氣預覽':'目前天氣';
    $('#weather-pop-title').textContent=weatherLabels[kind];
    $('#weather-pop-icon').replaceChildren(createIcon(weatherIcons[kind]));
    const showLive=!previewing&&live;
    $('#weather-pop-hint').hidden=!(showLive&&snapshot.state.rainbow>.3)&&weatherOverride!=='rainbow';
    $('#weather-pop-temp').textContent=showLive&&Number.isFinite(snapshot.temperature)?`${Math.round(snapshot.temperature)}°C`:'';
    const rows=showLive&&snapshot.details?[['濕度',snapshot.details.humidity!==null?`${Math.round(snapshot.details.humidity)}%`:null],['風',`${windLabel(snapshot.details.wind)} · ${snapshot.details.wind.toFixed(1)} m/s`],['雲量',`${Math.round(snapshot.details.cloud)}%`],['能見度',visibilityLabel(snapshot.details.visibility)]].filter(row=>row[1]):[];
    $('#weather-pop-details').replaceChildren(...rows.map(([name,value])=>{const box=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;box.append(dt,dd);return box;}));
    const forecast=showLive?snapshot.forecast:[];
    $('#weather-pop-forecast-section').hidden=!forecast.length;
    $('#weather-pop-forecast').replaceChildren(...forecast.map((day,index)=>{
      const row=document.createElement('li'),date=document.createElement('time'),name=document.createElement('span'),range=document.createElement('small');
      date.textContent=dayNames[index]??day.date.slice(5);date.dateTime=day.date;
      name.textContent=day.label;range.textContent=`${Math.round(day.tmin)}–${Math.round(day.tmax)}°C${day.pop!==null?` · 降雨 ${Math.round(day.pop)}%`:''}`;
      row.append(date,createIcon(weatherIcons[day.kind]),name,range);return row;
    }));
    $('#weather-pop-note').textContent=previewing?'目前是天氣預覽，不顯示實際數據。在設定中選擇「依實際天氣」即可回到真實資料。':'資料來自 Open-Meteo 的模型預報，氣溫可能與實際相差 1 到 2 度。';
    const refresh=$('#weather-pop-refresh'),loading=snapshot.status==='loading';
    refresh.hidden=previewing;refresh.disabled=loading;refresh.querySelector('span').textContent=loading?'更新中…':'立即更新';
    $('#weather-pop-updated').textContent=showLive&&snapshot.updatedAt?`${weatherClock.format(snapshot.updatedAt)} 更新${snapshot.status==='error'?'（暫時無法更新）':''}`:'';
    refreshIcons();
  }
  function openWeatherPopover(){
    if(chip.hidden)return;
    renderWeatherPopover();
    popover.hidden=false;popover.classList.remove('is-closing');popover.classList.add('is-opening');
    const done=event=>{if(event&&event.target!==popover)return;popover.classList.remove('is-opening');popover.removeEventListener('animationend',done);};
    popover.addEventListener('animationend',done);setTimeout(done,320);
    chip.setAttribute('aria-expanded','true');$('#weather-pop-close').focus({preventScroll:true});
  }
  let weatherPopoverTimer=0;
  function closeWeatherPopover(focus=false){
    if(popover.hidden)return;
    popover.classList.add('is-closing');chip.setAttribute('aria-expanded','false');
    clearTimeout(weatherPopoverTimer);weatherPopoverTimer=setTimeout(()=>{popover.hidden=true;popover.classList.remove('is-closing');},180);
    if(focus)chip.focus({preventScroll:true});
  }
  chip.addEventListener('click',()=>{popover.hidden||popover.classList.contains('is-closing')?openWeatherPopover():closeWeatherPopover();});
  $('#weather-pop-close').addEventListener('click',()=>closeWeatherPopover(true));
  $('#weather-pop-refresh').addEventListener('click',()=>{weatherService.refresh();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popover.hidden){event.preventDefault();event.stopPropagation();closeWeatherPopover(true);}},true);
  document.addEventListener('pointerdown',event=>{if(!popover.hidden&&!popover.contains(event.target)&&!chip.contains(event.target))closeWeatherPopover();});
  function renderWeather(snapshot=weatherService.snapshot()){
    const location=readCompanyLocation();
    $('#weather-link').checked=weatherOn;$('#weather-link').disabled=!location;
    let text;
    if(weatherOverride)text=`預覽：${weatherLabels[weatherOverride]}`;
    else if(!location)text='請先設定公司所在地。';
    else if(!weatherOn)text='已關閉，背景維持晴朗';
    else if(snapshot.state){
      text=`${weatherLabels[snapshot.state.kind]} · ${Math.round(snapshot.temperature)}°C · ${weatherClock.format(snapshot.updatedAt)} 更新`;
      if(snapshot.status==='error')text+='（暫時無法更新）';
    }else text=snapshot.status==='error'?'暫時無法取得天氣，先顯示晴朗':'取得天氣中…';
    $('#weather-status').textContent=text;
    renderClockWeather(snapshot,location);
    renderWeatherPopover(snapshot,location);
    world.setWeather(weatherOverride?weatherPresets[weatherOverride]:(weatherOn&&location?snapshot.state:null));
  }
  $('#weather-link').addEventListener('change',event=>{weatherOn=event.target.checked;try{localStorage.setItem('tool-portal-weather',String(weatherOn));}catch{}weatherService.setEnabled(weatherOn);renderWeather();$('#announcer').textContent=weatherOn?'已開啟天氣連動':'已關閉天氣連動';});
  createCombobox({
    button:$('#weather-preview'),list:$('#weather-preview-options'),value:'',
    items:[{value:'',label:'依實際天氣'},...Object.keys(weatherPresets).map(kind=>({value:kind,label:weatherLabels[kind]}))].map(item=>({...item,icon:weatherIcons[item.value]})),
    onChange(value){weatherOverride=value;renderWeather();$('#announcer').textContent=value?`天氣預覽：${weatherLabels[value]}`:'天氣預覽已改為依實際天氣';}
  });
  window.addEventListener('company-location-change',()=>{weatherService.refresh();renderWeather();});
  weatherService.setEnabled(weatherOn);weatherService.start();renderWeather();
  world.setBiome(state.biome);
  updateActivity();
  const skyPreview=()=>({
    beginPreview(){const previous={night:state.night,paused:state.paused,auto:state.auto,panelDelay:190};toggleSettings(false);$('#settings-toggle').disabled=true;state.auto=false;$('#auto-biome').checked=false;return previous;},
    endPreview(previous){Object.assign(state,previous);if(autoSkyLocation())state.night=world.isNight();$('#settings-toggle').disabled=false;$('#auto-biome').checked=state.auto;lastAuto=0;updateNight();updatePause();toggleSettings(true);}
  });
  const moonSky=initMoonSky(world,skyPreview());
  const sunSky=initSunSky(world,skyPreview());
  const {initRouteEditor}=await import('./route-editor.js');
  initRouteEditor(world,{
    begin(){moonSky.stopPreview();sunSky.stopPreview();routeEditing=true;applyAutoSky();const previous={night:state.night,paused:state.paused,auto:state.auto,panelDelay:190};toggleSettings(false);state.auto=false;state.paused=reduced.matches;state.night=true;updateNight();updatePause();return previous;},
    end(previous){routeEditing=false;Object.assign(state,previous);applyAutoSky();lastAuto=0;updateNight();updatePause();toggleSettings(true);}
  });
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
