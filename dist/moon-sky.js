import './vendor/suncalc.js';
import {readCompanyLocation,getLocationDayBounds,getLocationMoonTimes} from './company-location.js';

export function getMoonSkyState(time,location){
  const date=new Date(time),p=globalThis.SunCalc.getMoonPosition(date,location.lat,location.lng),illumination=globalThis.SunCalc.getMoonIllumination(date);
  const c=Math.cos(p.altitude);
  return {altitude:p.altitude,azimuth:p.azimuth,direction:[c*Math.sin(p.azimuth),Math.sin(p.altitude),-c*Math.cos(p.azimuth)],tilt:illumination.angle-p.parallacticAngle};
}

export function initMoonSky(world,{beginPreview,endPreview}){
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let location=readCompanyLocation(),enabled=true,preview=false,playing=false,bounds,previewTime,previewEvents,previous,lastFrame=0,raf=0;
  try{enabled=localStorage.getItem('tool-portal-moon-tracking')!=='false';}catch{}
  function status(state){
    if(!location)return;
    const degrees=state.altitude*180/Math.PI,az=(state.azimuth*180/Math.PI+540)%360;
    const directions=['北','東北','東','東南','南','西南','西','西北'],direction=directions[Math.round(az/45)%8];
    const label=degrees<-.86?'月亮在地平線下':!state.inView?'月亮位於鏡頭外':`${direction}方 · 高度 ${Math.max(0,degrees).toFixed(1)}°`;
    const node=$('moon-sky-status');if(node.textContent!==label)node.textContent=label;
    node.dataset.altitude=String(degrees);node.dataset.inView=String(state.inView);
  }
  function apply(){
    $('moon-tracking').checked=enabled;$('moon-tracking').disabled=!location;$('moon-preview-start').disabled=!location;
    $('moon-tracking-hint').textContent=location?'鏡頭朝南；月亮可能位於鏡頭外或地平線下。':'請先設定公司所在地。';
    if(!location||!enabled&&!preview)$('moon-sky-status').textContent='固定位置 · 當日月相';
    world.setMoonTracking({location,enabled:!!location&&(enabled||preview),previewTime:preview?previewTime:null,onStatus:status});
  }
  function timeLabel(){
    const date=new Date(previewTime),format=new Intl.DateTimeFormat('zh-TW',{timeZone:location.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    $('moon-preview-time').textContent=format.format(date);$('moon-preview-time').dateTime=date.toISOString();
    $('moon-preview-location').textContent=`${location.name} · ${bounds.date.replaceAll('-','/')} · ${location.timeZone}`;
    $('moon-preview-range').value=String(Math.round((previewTime-bounds.start)/(bounds.end-bounds.start)*1440));
    $('moon-preview-play').textContent=playing?'暫停預覽':'播放預覽';$('moon-preview-play').setAttribute('aria-pressed',String(playing));
  }
  function frame(now){
    raf=0;if(!preview||!playing)return;
    const delta=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;
    previewTime+=delta/30000*(bounds.end-bounds.start);
    if(previewTime>=bounds.end){previewTime=bounds.end-1;playing=false;}
    timeLabel();apply();if(playing)raf=requestAnimationFrame(frame);
  }
  function stopPreview(){
    if(!preview)return;cancelAnimationFrame(raf);raf=0;playing=false;preview=false;$('moon-preview').hidden=true;
    apply();endPreview(previous);$('moon-preview-start').focus({preventScroll:true});
  }
  $('moon-tracking').addEventListener('change',event=>{enabled=event.target.checked;try{localStorage.setItem('tool-portal-moon-tracking',String(enabled));}catch{}apply();});
  $('moon-preview-start').addEventListener('click',()=>{
    if(!location||preview)return;bounds=getLocationDayBounds(location);previewEvents=getLocationMoonTimes(location);previewTime=bounds.start;preview=true;playing=!reduced.matches;previous=beginPreview();
    $('moon-preview-rise').disabled=!previewEvents.rise;$('moon-preview-set').disabled=!previewEvents.set;
    $('moon-preview').hidden=false;$('moon-preview-play').disabled=reduced.matches;$('moon-preview-motion-hint').textContent=reduced.matches?'已依減少動態效果偏好停止播放，可拖曳時間。':'24 小時濃縮為 30 秒；拖曳時間可暫停檢視。';
    timeLabel();apply();$('moon-preview-range').focus();lastFrame=0;if(playing)raf=requestAnimationFrame(frame);
  });
  $('moon-preview-play').addEventListener('click',()=>{if(!preview)return;playing=!playing;if(playing&&previewTime>=bounds.end-1)previewTime=bounds.start;lastFrame=0;timeLabel();cancelAnimationFrame(raf);if(playing)raf=requestAnimationFrame(frame);});
  $('moon-preview-range').addEventListener('input',event=>{if(!preview)return;playing=false;cancelAnimationFrame(raf);previewTime=bounds.start+Number(event.target.value)/1440*(bounds.end-bounds.start-1);timeLabel();apply();});
  for(const type of ['rise','set'])$(`moon-preview-${type}`).addEventListener('click',()=>{if(!preview||!previewEvents[type])return;playing=false;cancelAnimationFrame(raf);previewTime=previewEvents[type].getTime();timeLabel();apply();});
  $('moon-preview-stop').addEventListener('click',stopPreview);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&preview){event.preventDefault();stopPreview();}});
  reduced.addEventListener('change',()=>{if(preview){$('moon-preview-play').disabled=reduced.matches;if(reduced.matches){playing=false;cancelAnimationFrame(raf);timeLabel();}}});
  document.addEventListener('visibilitychange',()=>{lastFrame=0;});
  window.addEventListener('company-location-change',event=>{stopPreview();location=event.detail;apply();});
  apply();return {stopPreview};
}
