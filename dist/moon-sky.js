import './vendor/suncalc.js';
import {readCompanyLocation,getLocationDayBounds,getLocationMoonTimes} from './company-location.js';

export function getMoonSkyState(time,location){
  const date=new Date(time),p=globalThis.SunCalc.getMoonPosition(date,location.lat,location.lng),illumination=globalThis.SunCalc.getMoonIllumination(date);
  const c=Math.cos(p.altitude);
  return {altitude:p.altitude,azimuth:p.azimuth,direction:[c*Math.sin(p.azimuth),Math.sin(p.altitude),-c*Math.cos(p.azimuth)],tilt:illumination.angle-p.parallacticAngle};
}

export function initMoonSky(world,{beginPreview,endPreview}){
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let location=readCompanyLocation(),enabled=true,preview=false,playing=false,bounds,previewTime,previewEvents,previous,lastFrame=0,raf=0,previewCloseTimer=0;
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
  function drawPath(){
    if(!preview||!location||!bounds)return;
    const width=innerWidth,height=innerHeight,parts=[];
    for(let i=0;i<=96;i++){
      const state=getMoonSkyState(bounds.start+(bounds.end-bounds.start)*i/96,location),sinAltitude=Math.sin(state.altitude);
      if(state.altitude<-.03){parts.push(null);continue;}
      const x=(state.azimuth/Math.PI*1.5+1)*width/2,y=(1-(.025+sinAltitude*1.62))*height/2;
      parts.push([x,y]);
    }
    let penUp=true,d='',first,last;for(const point of parts){if(!point){penUp=true;continue;}if(!first)first=point;last=point;d+=`${penUp?'M':'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)} `;penUp=false;}
    $('moon-preview-path').setAttribute('viewBox',`0 0 ${width} ${height}`);$('moon-preview-path').querySelector('path').setAttribute('d',d);
    const labels=[...$('moon-preview-compass').children];
    [[first,labels[0]],[last,labels[1]]].forEach(([point,label])=>{if(!point||!label)return;label.style.left=`${Math.max(14,Math.min(width-114,point[0]-48))}px`;label.style.top=`${Math.max(72,Math.min(height-42,point[1]-42))}px`;});
  }
  function frame(now){
    raf=0;if(!preview||!playing)return;
    const delta=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;
    previewTime+=delta/30000*(bounds.end-bounds.start);
    if(previewTime>=bounds.end){previewTime=bounds.end-1;playing=false;}
    timeLabel();apply();if(playing)raf=requestAnimationFrame(frame);
  }
  function stopPreview(){
    if(!preview)return;cancelAnimationFrame(raf);raf=0;playing=false;preview=false;
    const panel=$('moon-preview');panel.classList.remove('is-opening');panel.classList.add('is-closing');
    clearTimeout(previewCloseTimer);previewCloseTimer=setTimeout(()=>{panel.hidden=true;panel.classList.remove('is-closing');},190);
    $('moon-preview-compass').hidden=true;$('moon-preview-path').setAttribute('hidden','');apply();endPreview(previous);$('moon-preview-start').focus({preventScroll:true});
  }
  $('moon-tracking').addEventListener('change',event=>{enabled=event.target.checked;try{localStorage.setItem('tool-portal-moon-tracking',String(enabled));}catch{}apply();});
  $('moon-preview-start').addEventListener('click',()=>{
    if(!location||preview)return;bounds=getLocationDayBounds(location);previewEvents=getLocationMoonTimes(location);previewTime=bounds.start;preview=true;playing=!reduced.matches;previous=beginPreview();
    $('moon-preview-rise').disabled=!previewEvents.rise;$('moon-preview-set').disabled=!previewEvents.set;
    const panel=$('moon-preview');clearTimeout(previewCloseTimer);panel.hidden=false;panel.classList.remove('is-closing');panel.classList.add('is-opening');requestAnimationFrame(()=>panel.classList.remove('is-opening'));
    $('moon-preview-compass').hidden=false;$('moon-preview-path').removeAttribute('hidden');drawPath();$('moon-preview-play').disabled=reduced.matches;$('moon-preview-motion-hint').textContent=reduced.matches?'已依減少動態效果偏好停止播放，可拖曳時間。':'東方在畫面左側，月亮由左向右升起、落下。';
    timeLabel();apply();$('moon-preview-range').focus();lastFrame=0;if(playing)raf=requestAnimationFrame(frame);
  });
  $('moon-preview-play').addEventListener('click',()=>{if(!preview)return;playing=!playing;if(playing&&previewTime>=bounds.end-1)previewTime=bounds.start;lastFrame=0;timeLabel();cancelAnimationFrame(raf);if(playing)raf=requestAnimationFrame(frame);});
  $('moon-preview-range').addEventListener('input',event=>{if(!preview)return;playing=false;cancelAnimationFrame(raf);previewTime=bounds.start+Number(event.target.value)/1440*(bounds.end-bounds.start-1);timeLabel();apply();});
  for(const type of ['rise','set'])$(`moon-preview-${type}`).addEventListener('click',()=>{if(!preview||!previewEvents[type])return;playing=false;cancelAnimationFrame(raf);previewTime=previewEvents[type].getTime();timeLabel();apply();});
  $('moon-preview-stop').addEventListener('click',stopPreview);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&preview){event.preventDefault();stopPreview();}});
  reduced.addEventListener('change',()=>{if(preview){$('moon-preview-play').disabled=reduced.matches;if(reduced.matches){playing=false;cancelAnimationFrame(raf);timeLabel();}}});
  document.addEventListener('visibilitychange',()=>{lastFrame=0;});
  window.addEventListener('resize',drawPath);
  window.addEventListener('company-location-change',event=>{stopPreview();location=event.detail;apply();});
  apply();return {stopPreview};
}
