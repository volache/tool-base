// Real weather for the company location. Open-Meteo needs no key and allows browser requests, so no secret ever ships in dist/.
// Everything outside the network call is pure, so the mapping can be tested without a browser.
const ENDPOINT='https://api.open-meteo.com/v1/forecast';
const CACHE_KEY='tool-portal-weather-v1';
const FRESH_MS=15*60*1000,STALE_MS=3*60*60*1000,TIMEOUT_MS=8000;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

export const weatherLabels={clear:'晴朗',partly:'多雲',cloudy:'陰天',fog:'霧',drizzle:'毛毛雨',rain:'下雨',snow:'下雪',thunder:'雷雨',windy:'大風'};

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
  windy:{kind:'windy',cloud:.35,rain:0,snow:0,fog:0,thunder:0,wind:1}
};

// WMO weather interpretation codes -> renderer state. Wind: 2 m/s is calm, 12 m/s and above is the strongest we draw.
export function mapWeather({weather_code:code,cloud_cover:cover=0,wind_speed_10m:speed=0}){
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
  return {weather_code:read('weather_code',0,99,true),cloud_cover:read('cloud_cover',0,100),wind_speed_10m:read('wind_speed_10m',0,120),temperature_2m:read('temperature_2m',-90,70)};
}

const roundedCoordinate=value=>Math.round(value*100)/100;
export function weatherKey(location){return `${roundedCoordinate(location.lat)},${roundedCoordinate(location.lng)}`;}

export async function fetchWeather(location,{fetchImpl=globalThis.fetch,timeout=TIMEOUT_MS}={}){
  const query=new URLSearchParams({latitude:String(roundedCoordinate(location.lat)),longitude:String(roundedCoordinate(location.lng)),current:'weather_code,cloud_cover,wind_speed_10m,temperature_2m',wind_speed_unit:'ms',timezone:'auto'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetchImpl(`${ENDPOINT}?${query}`,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`天氣服務回應 ${response.status}`);
    return validateCurrent(await response.json());
  }finally{clearTimeout(timer);}
}

function readCache(storage,key,now){
  try{
    const entry=JSON.parse(storage.getItem(CACHE_KEY));
    if(entry&&entry.key===key&&Number.isFinite(entry.at)&&now-entry.at<STALE_MS)return {at:entry.at,current:validateCurrent({current:entry.current})};
  }catch{}
  return null;
}
function writeCache(storage,key,at,current){try{storage.setItem(CACHE_KEY,JSON.stringify({key,at,current}));}catch{}}

// Keeps the latest weather, refreshing every 15 minutes while the page is visible. Failures never surface as errors:
// the last good reading is kept for up to 3 hours, then the scene simply returns to clear.
export function createWeatherService({getLocation,onChange,fetchImpl,storage=globalThis.localStorage,now=()=>Date.now()}){
  let enabled=true,entry=null,status='idle',inflight=null,timer=0;
  function snapshot(){
    const location=getLocation();
    if(!enabled||!location)return {status:enabled?'nolocation':'off',state:null,temperature:null,updatedAt:null};
    return {status,state:entry?mapWeather(entry.current):null,temperature:entry?entry.current.temperature_2m:null,updatedAt:entry?.at??null};
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
        const current=await fetchWeather(location,{fetchImpl});
        entry={key,at:now(),current};writeCache(storage,key,entry.at,current);status='ok';
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
