import './vendor/suncalc.js';
const storageKey='tool-portal-company-location-v1';
export function validLocation(value){
  if(!value||typeof value.name!=='string'||value.name.length>40||!Number.isFinite(value.lat)||Math.abs(value.lat)>90||!Number.isFinite(value.lng)||Math.abs(value.lng)>180||typeof value.timeZone!=='string')return false;
  try{new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format();return true;}catch{return false;}
}
export function dayKey(date,timeZone){
  const parts=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
}
export function readCompanyLocation(){try{const value=JSON.parse(localStorage.getItem(storageKey));return validLocation(value)?value:null;}catch{return null;}}
export function getLocationDayBounds(location,now=new Date()){
  const key=dayKey(now,location.timeZone),utc=Date.parse(`${key}T00:00:00Z`);
  function boundary(target,center){let lo=center-18*3600000,hi=center+18*3600000;while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(dayKey(new Date(mid),location.timeZone)<target)lo=mid;else hi=mid;}return hi;}
  const next=new Date(utc+86400000).toISOString().slice(0,10);
  return {start:boundary(key,utc),end:boundary(next,utc+86400000),date:key};
}
export function getLocationMoonTimes(location,now=new Date()){
  const key=dayKey(now,location.timeZone),utcDay=Date.parse(`${key}T00:00:00Z`),rise=[],set=[];
  // SunCalc 1.9 searches a UTC day. Search adjacent days, then filter by the
  // company's civil date, even when the browser is in another time zone.
  for(const offset of [-1,0,1]){
    const events=globalThis.SunCalc.getMoonTimes(new Date(utcDay+offset*86400000),location.lat,location.lng,true);
    for(const [type,list] of [['rise',rise],['set',set]])if(events[type] instanceof Date&&Number.isFinite(events[type].getTime())&&dayKey(events[type],location.timeZone)===key)list.push(events[type]);
  }
  rise.sort((a,b)=>a-b);set.sort((a,b)=>a-b);
  return {date:key,rise:rise[0],set:set[0]};
}
export function initCompanyLocation(){
  const $=id=>document.getElementById(id),dialog=$('location-dialog'),form=$('location-form');
  let saved,lastDay='',closeTimer;
  function closeLocation(){if(!dialog.open||dialog.classList.contains('is-closing'))return;dialog.classList.add('is-closing');closeTimer=setTimeout(()=>{dialog.close();dialog.classList.remove('is-closing');},190);}
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeLocation();});
  try{const value=JSON.parse(localStorage.getItem(storageKey));if(validLocation(value))saved=value;}catch{}
  function refresh(force=false){
    $('location-label').textContent=saved?.name||'未設定';$('location-clear').disabled=!saved;
    $('location-moon-times').hidden=!saved;
    if(!saved)return;
    const key=dayKey(new Date(),saved.timeZone);if(!force&&key===lastDay)return;lastDay=key;
    const result=getLocationMoonTimes(saved),format=new Intl.DateTimeFormat('zh-TW',{timeZone:saved.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    $('location-moon-date').textContent=`${result.date.replaceAll('-','/')} · ${saved.timeZone}`;
    $('location-moon-rise').textContent=result.rise?format.format(result.rise):'今日無月升';
    $('location-moon-set').textContent=result.set?format.format(result.set):'今日無月落';
  }
  $('location-edit').addEventListener('click',()=>{
    $('location-name').value=saved?.name||'';$('location-lat').value=saved?.lat??'';$('location-lng').value=saved?.lng??'';$('location-timezone').value=saved?.timeZone||'Asia/Taipei';
    clearTimeout(closeTimer);dialog.classList.remove('is-closing');$('location-message').textContent='';dialog.showModal();$('location-name').focus();
  });
  $('location-close').addEventListener('click',closeLocation);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeLocation();});
  const presets={taipei:['台北',25.033,121.5654],taichung:['台中',24.1477,120.6736],kaohsiung:['高雄',22.6273,120.3014],hualien:['花蓮',23.9911,121.6112]};
  document.querySelectorAll('[data-location-preset]').forEach(button=>button.addEventListener('click',()=>{
    const [name,lat,lng]=presets[button.dataset.locationPreset];$('location-name').value=name;$('location-lat').value=lat;$('location-lng').value=lng;$('location-timezone').value='Asia/Taipei';$('location-message').textContent=`已填入${name}市中心座標，可調整後儲存。`;
  }));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const next={name:$('location-name').value.trim()||'自訂地點',lat:Number($('location-lat').value),lng:Number($('location-lng').value),timeZone:$('location-timezone').value.trim()};
    if(!$('location-lat').value.trim()||!$('location-lng').value.trim()||!validLocation(next)){$('location-message').textContent='請確認經緯度範圍及時區名稱，例如 Asia/Taipei。';return;}
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{$('location-message').textContent='瀏覽器無法儲存設定，請確認儲存空間或隱私設定。';return;}
    saved=next;refresh(true);window.dispatchEvent(new CustomEvent('company-location-change',{detail:saved}));closeLocation();$('announcer').textContent=`已將公司所在地設為${saved.name}。`;
  });
  $('location-clear').addEventListener('click',()=>{
    try{localStorage.removeItem(storageKey);}catch{$('location-message').textContent='無法清除設定，請稍後再試。';return;}
    saved=undefined;lastDay='';refresh();window.dispatchEvent(new CustomEvent('company-location-change',{detail:null}));closeLocation();$('announcer').textContent='已清除公司所在地。';
  });
  refresh(true);setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
