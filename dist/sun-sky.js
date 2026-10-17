import './vendor/suncalc.js';
import {getLocationDayBounds,getLocationMoonTimes,dayKey,readCompanyLocation} from './company-location.js';
import {createPanoramaHeight} from './sky-projection.js';
import {initMoonSky,getMoonSkyState,getMoonPanoramaHeight} from './moon-sky.js';
export {getSkyNight,getTwilightState,getPreviewSpeed} from './sky-model.js';
export function getSunSkyState(time,location){const p=globalThis.SunCalc.getPosition(new Date(time),location.lat,location.lng);return {...p,tilt:0};}
const fallbackHeight=createPanoramaHeight(getSunSkyState),referenceHeight=createPanoramaHeight(getMoonSkyState);
let reference;
function displayState(state,time,location){
  const key=`${location.lat}:${location.lng}:${location.timeZone}`;
  if(!reference||reference.key!==key||time<reference.start||time>=reference.end){
    const bounds=getLocationDayBounds(location,new Date(time)),solar=getLocationSunTimes(location,new Date(time)),lunar=getLocationMoonTimes(location,new Date(time));
    let set=lunar.set;if(lunar.rise&&set&&set<lunar.rise)set=getLocationMoonTimes(location,new Date(bounds.end+3600000)).set;
    reference={...bounds,key,sunRise:+solar.rise,sunSet:+solar.set,moonRise:+lunar.rise,moonSet:+set};
  }
  const r=reference;
  if(![r.sunRise,r.sunSet,r.moonRise,r.moonSet].every(Number.isFinite)||r.sunSet<=r.sunRise||r.moonSet<=r.moonRise)return {state,time,moon:false};
  const sampleTime=r.moonRise+(time-r.sunRise)/(r.sunSet-r.sunRise)*(r.moonSet-r.moonRise);
  return {state:getMoonSkyState(sampleTime,location),time:sampleTime,moon:true};
}
export function getSunPanoramaHeight(state,time,location){const sample=displayState(state,time,location);return (sample.moon?referenceHeight:fallbackHeight)(sample.state,sample.time,location);}
export function getSunPanoramaX(state,time,location){return displayState(state,time,location).state.azimuth/Math.PI*1.5;}
export function getLocationSunTimes(location,now=new Date()){
  const bounds=getLocationDayBounds(location,now),events={date:bounds.date};
  for(const offset of [-1,0,1]){
    const times=globalThis.SunCalc.getTimes(new Date((bounds.start+bounds.end)/2+offset*86400000),location.lat,location.lng);
    for(const [type,name] of [['rise','sunrise'],['set','sunset']]){const value=times[name];if(value instanceof Date&&Number.isFinite(+value)&&dayKey(value,location.timeZone)===bounds.date)events[type]=value;}
  }return events;
}
export function initSunSky(world,callbacks){
  // Reuse the same panel structure, animations and keyboard controls as the moon.
  for(const id of ['moon-preview','moon-preview-path','moon-preview-compass']){
    const original=document.getElementById(id),clone=original.cloneNode(true);
    for(const el of [clone,...clone.querySelectorAll('*')])for(const attr of ['id','for','aria-labelledby'])if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).replaceAll('moon','sun'));
    original.after(clone);
  }
  const $=id=>document.getElementById(id);
  $('sun-preview-title').textContent='今日日出日落';
  $('sun-preview-rise').textContent='查看日出';$('sun-preview-set').textContent='查看日落';
  const labels=$('sun-preview-compass').children;labels[0].textContent='東 E · 日出';labels[1].textContent='西 W · 日落';
  $('sun-preview-note')?.remove();
  $('sun-preview').querySelector('.moon-preview-note').textContent='日月共用月亮的示意軌道；各自的升落時間、實際方位與高度依所在地計算。即時與預覽的位置一致。';
  function refresh(){
    const location=readCompanyLocation();$('sun-event-times').hidden=!location;if(!location)return;
    const times=getLocationSunTimes(location),format=new Intl.DateTimeFormat('zh-TW',{timeZone:location.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    $('sun-rise-time').textContent=times.rise?format.format(times.rise):'今日無日出';$('sun-set-time').textContent=times.set?format.format(times.set):'今日無日落';
  }
  refresh();window.addEventListener('company-location-change',refresh);setInterval(refresh,60000);
  return initMoonSky(world,callbacks,{kind:'sun',readState:getSunSkyState,getHeight:getSunPanoramaHeight,getHorizontal:getSunPanoramaX,pathState:getMoonSkyState,pathHeight:getMoonPanoramaHeight,pathHorizontal:state=>state.azimuth/Math.PI*1.5,getEvents:getLocationSunTimes,setTracking:'setSunTracking'});
}
