// Real weather for the company location. Open-Meteo needs no key and allows browser requests, so no secret ever ships in dist/.
// Everything outside the network call is pure, so the mapping can be tested without a browser.
const ENDPOINT='https://api.open-meteo.com/v1/forecast';
const CACHE_KEY='tool-portal-weather-v1',CACHE_SCHEMA=2;   // schema 2 added the 3-day outlook and recent rain; older entries are refetched instead of shown without them
const FRESH_MS=15*60*1000,STALE_MS=3*60*60*1000,TIMEOUT_MS=8000;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

export const weatherLabels={clear:'晴朗',partly:'多雲',cloudy:'陰天',fog:'霧',drizzle:'毛毛雨',rain:'下雨',snow:'下雪',thunder:'雷雨',windy:'大風',rainbow:'彩虹'};

// Hand-picked states used for the preview menu. They go through the same renderer as real data.
export const weatherPresets={
  clear:{kind:'clear',cloud:.08,rain:0,snow:0,fog:0,thunder:0,wind:.2},
  partly:{kind:'partly',cloud:.5,rain:0,snow:0,fog:0,thunder:0,wind:.25},
  cloudy:{kind:'cloudy',cloud:.95,rain:0,snow:0,fog:0,thunder:0,wind:.3},
  fog:{kind:'fog',cloud:.7,rain:0,snow:0,fog:.9,thunder:0,wind:.05},
  drizzle:{kind:'drizzle',cloud:.9,rain:.3,snow:0,fog:0,thunder:0,wind:.2},
  rain:{kind:'rain',cloud:1,rain:.8,snow:0,fog:0,thunder:0,wind:.4},
  snow:{kind:'snow',cloud:.95,rain:0,snow:.8,fog:0,thunder:0,wind:.25},
  thunder:{kind:'thunder',cloud:1,rain:1,snow:0,fog:0,thunder:1,wind:.7},
  windy:{kind:'windy',cloud:.35,rain:0,snow:0,fog:0,thunder:0,wind:1},
  // Previewing a rainbow ignores the sun's height (it would otherwise only show in the right hours), but still needs daylight.
  rainbow:{kind:'rainbow',cloud:.45,rain:0,snow:0,fog:0,thunder:0,wind:.15,rainbow:1,forceRainbow:true}
};

// Beaufort scale in plain Chinese, from wind speed in m/s.
export function windLabel(speed){
  const steps=[[.3,'無風'],[1.6,'軟風'],[3.4,'輕風'],[5.5,'微風'],[8,'和風'],[10.8,'清勁風'],[13.9,'強風'],[17.2,'疾風'],[20.8,'烈風']];
  return (steps.find(([limit])=>speed<limit)??[0,'暴風'])[1];
}
export function visibilityLabel(meters){
  if(!Number.isFinite(meters))return null;
  return meters>=10000?`${Math.round(meters/1000)} 公里以上`:meters>=1000?`${(meters/1000).toFixed(1)} 公里`:`${Math.round(meters)} 公尺`;
}

// WMO weather interpretation codes -> renderer state. Wind: 2 m/s is calm, 12 m/s and above is the strongest we draw.
// Open-Meteo reports "fog" (45/48) whenever its model visibility is low, even at 50-70% humidity where there is no real fog.
// Trust it only when the air is nearly saturated and visibility is genuinely short; otherwise fall back to the cloud cover.
const isFoggy=(rh,visibility)=>Number.isFinite(rh)&&Number.isFinite(visibility)&&rh>=92&&visibility<1000;
export function mapWeather({weather_code:rawCode,cloud_cover:cover=0,wind_speed_10m:speed=0,relative_humidity_2m:rh,visibility}){
  const code=(rawCode===45||rawCode===48)&&!isFoggy(rh,visibility)?(cover>=85?3:cover>=40?2:0):rawCode;
  const sky=clamp(cover/100),wind=clamp((speed-2)/10);
  let kind='clear',cloud=Math.min(sky,.3),rain=0,snow=0,fog=0,thunder=0;
  if(code===2){kind='partly';cloud=clamp(sky,.4,.7);}
  else if(code===3){kind='cloudy';cloud=Math.max(sky,.85);}
  else if(code===45||code===48){kind='fog';fog=code===48?1:.85;cloud=Math.max(sky,.6);}
  else if(code>=51&&code<=57){kind='drizzle';rain={51:.25,53:.37,55:.49,56:.3,57:.4}[code]??.3;}
  else if(code>=61&&code<=67){kind='rain';rain={61:.45,63:.7,65:1,66:.6,67:.9}[code]??.6;}
  else if(code>=71&&code<=77){kind='snow';snow={71:.4,73:.7,75:1,77:.35}[code]??.5;}
  else if(code>=80&&code<=82){kind='rain';rain=[.5,.8,1][code-80];}
  else if(code===85||code===86){kind='snow';snow=code===85?.6:1;}
  else if(code>=95&&code<=99){kind='thunder';rain=code===95?.8:1;thunder=code===95?.7:1;}
  const wet=Math.max(rain,snow);
  if(wet>0)cloud=Math.max(cloud,.8+.2*wet);
  return {kind,cloud,rain,snow,fog,thunder,wind};
}

// Rain that fell in the last few hours plus sunshine now makes a rainbow. lastWetAt is the end of the most recent rainy hour.
export function rainbowStrength(state,lastWetAt,now){
  if(!state||!Number.isFinite(lastWetAt))return 0;
  if(state.rain>=.15||state.snow>=.15||state.thunder>0||state.fog>.3)return 0;
  const age=now-lastWetAt;
  if(age<0||age>3*60*60*1000)return 0;
  const fade=age<=90*60*1000?1:1-(age-90*60*1000)/(90*60*1000);
  const open=1-clamp((state.cloud-.7)/.25);
  return clamp(fade*open);
}
// Open-Meteo's hourly precipitation at time T is the total of the hour ending at T. Returns the latest rainy hour end (ms) or null.
export function parseRecentRain(data,now=Date.now()){
  const hourly=data?.hourly,offset=Number(data?.utc_offset_seconds)||0;
  if(!hourly||!Array.isArray(hourly.time)||!Array.isArray(hourly.precipitation))return null;
  let latest=null;
  for(let i=0;i<hourly.time.length;i++){
    const amount=hourly.precipitation[i],stamp=Date.parse(`${hourly.time[i]}Z`)-offset*1000;
    if(typeof amount!=='number'||!(amount>=.2)||!Number.isFinite(stamp)||stamp>now)continue;
    if(latest===null||stamp>latest)latest=stamp;
  }
  return latest;
}

// The same weather reads differently in different scenes: no snow in the desert, and it never rains on the snowfield.
export function adaptToBiome(state,biome){
  if(!state)return null;
  const next={...state};
  if(biome==='snow'&&state.rain>0){next.snow=Math.max(state.snow,state.rain);next.rain=0;if(next.kind==='rain'||next.kind==='drizzle')next.kind='snow';}
  if(biome==='desert'&&state.snow>0){next.cloud=Math.max(state.cloud,.75);next.snow=0;if(next.kind==='snow')next.kind='cloudy';}
  next.groundSnow=biome==='snow'||biome==='desert'?0:next.snow;
  return next;
}

export function validateCurrent(data){
  const current=data?.current;
  if(!current||typeof current!=='object')throw new Error('天氣資料格式不正確');
  const read=(key,min,max,integer=false)=>{
    const value=current[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`天氣欄位 ${key} 不正確`);
    return value;
  };
  const result={weather_code:read('weather_code',0,99,true),cloud_cover:read('cloud_cover',0,100),wind_speed_10m:read('wind_speed_10m',0,120),temperature_2m:read('temperature_2m',-90,70)};
  // Optional fields: older cached readings do not have them, and the fog check simply treats them as "not foggy".
  if(current.relative_humidity_2m!==undefined)result.relative_humidity_2m=read('relative_humidity_2m',0,100);
  if(current.visibility!==undefined)result.visibility=read('visibility',0,1000000);
  return result;
}

// Daily outlook: never throws, a malformed day is simply skipped. Open-Meteo's daily code can also say "fog" over dry air,
// so each day is mapped from its code and mean cloud cover through the same rules as the current reading.
export function parseDaily(data){
  const daily=data?.daily;
  if(!daily||!Array.isArray(daily.time))return [];
  const number=(list,index,min,max)=>{const value=list?.[index];return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;};
  const days=[];
  for(let i=0;i<Math.min(daily.time.length,3);i++){
    const code=number(daily.weather_code,i,0,99),tmax=number(daily.temperature_2m_max,i,-90,70),tmin=number(daily.temperature_2m_min,i,-90,70);
    if(typeof daily.time[i]!=='string'||code===null||tmax===null||tmin===null)continue;
    days.push({date:daily.time[i],code,tmax,tmin,pop:number(daily.precipitation_probability_max,i,0,100),cloud:number(daily.cloud_cover_mean,i,0,100)??50});
  }
  return days;
}
export function mapDaily(days=[]){
  return days.map(day=>{const state=mapWeather({weather_code:day.code,cloud_cover:day.cloud,wind_speed_10m:0});return {date:day.date,kind:state.kind,label:weatherLabels[state.kind],tmin:day.tmin,tmax:day.tmax,pop:day.pop};});
}

const roundedCoordinate=value=>Math.round(value*100)/100;
export function weatherKey(location){return `${roundedCoordinate(location.lat)},${roundedCoordinate(location.lng)}`;}

export async function fetchWeather(location,{fetchImpl=globalThis.fetch,timeout=TIMEOUT_MS}={}){
  const query=new URLSearchParams({latitude:String(roundedCoordinate(location.lat)),longitude:String(roundedCoordinate(location.lng)),current:'weather_code,cloud_cover,wind_speed_10m,temperature_2m,relative_humidity_2m,visibility',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,cloud_cover_mean',forecast_days:'3',hourly:'precipitation',past_hours:'6',forecast_hours:'1',wind_speed_unit:'ms',timezone:'auto'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetchImpl(`${ENDPOINT}?${query}`,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`天氣服務回應 ${response.status}`);
    const data=await response.json();
    return {current:validateCurrent(data),daily:parseDaily(data),lastWetAt:parseRecentRain(data)};
  }finally{clearTimeout(timer);}
}

function readCache(storage,key,now){
  try{
    const entry=JSON.parse(storage.getItem(CACHE_KEY));
    if(entry&&entry.schema===CACHE_SCHEMA&&entry.key===key&&Number.isFinite(entry.at)&&now-entry.at<STALE_MS)return {at:entry.at,current:validateCurrent({current:entry.current}),daily:parseDaily({daily:entry.daily}),lastWetAt:Number.isFinite(entry.lastWetAt)?entry.lastWetAt:null};
  }catch{}
  return null;
}
function writeCache(storage,key,at,current,daily,lastWetAt){try{storage.setItem(CACHE_KEY,JSON.stringify({schema:CACHE_SCHEMA,key,at,current,lastWetAt,daily:daily&&{time:daily.map(d=>d.date),weather_code:daily.map(d=>d.code),temperature_2m_max:daily.map(d=>d.tmax),temperature_2m_min:daily.map(d=>d.tmin),precipitation_probability_max:daily.map(d=>d.pop),cloud_cover_mean:daily.map(d=>d.cloud)}}));}catch{}}

// Keeps the latest weather, refreshing every 15 minutes while the page is visible. Failures never surface as errors:
// the last good reading is kept for up to 3 hours, then the scene simply returns to clear.
export function createWeatherService({getLocation,onChange,fetchImpl,storage=globalThis.localStorage,now=()=>Date.now()}){
  let enabled=true,entry=null,status='idle',inflight=null,timer=0;
  function snapshot(){
    const location=getLocation();
    if(!enabled||!location)return {status:enabled?'nolocation':'off',state:null,temperature:null,updatedAt:null};
    const current=entry?.current;
    return {status,state:entry?{...mapWeather(current),rainbow:rainbowStrength(mapWeather(current),entry.lastWetAt,now())}:null,temperature:entry?current.temperature_2m:null,updatedAt:entry?.at??null,
      details:entry?{humidity:current.relative_humidity_2m??null,wind:current.wind_speed_10m,cloud:current.cloud_cover,visibility:current.visibility??null}:null,
      forecast:entry?mapDaily(entry.daily):[]};
  }
  const notify=()=>onChange?.(snapshot());
  async function refresh(force=false){
    const location=getLocation();
    if(!enabled||!location){entry=null;notify();return;}
    const key=weatherKey(location);
    if(!force&&entry?.key===key&&now()-entry.at<FRESH_MS){notify();return;}
    if(entry&&entry.key!==key)entry=null;
    if(!entry){const cached=readCache(storage,key,now());if(cached)entry={...cached,key};}
    if(!force&&entry&&now()-entry.at<FRESH_MS){status='ok';notify();return;}
    if(inflight)return inflight;
    status='loading';
    inflight=(async()=>{
      try{
        const {current,daily,lastWetAt}=await fetchWeather(location,{fetchImpl});
        entry={key,at:now(),current,daily,lastWetAt};writeCache(storage,key,entry.at,current,daily,lastWetAt);status='ok';
      }catch{
        if(entry&&now()-entry.at>=STALE_MS)entry=null;
        status='error';
      }finally{inflight=null;notify();}
    })();
    return inflight;
  }
  function check(){if(typeof document==='undefined'||!document.hidden)refresh();}
  return {
    start(){clearInterval(timer);timer=setInterval(check,60000);if(typeof document!=='undefined')document.addEventListener('visibilitychange',check);return refresh();},
    refresh:()=>refresh(true),
    update:()=>refresh(),
    setEnabled(value){enabled=!!value;if(!enabled){entry=null;notify();}else return refresh();},
    snapshot
  };
}
