import assert from 'node:assert/strict';
const {mapWeather,adaptToBiome,validateCurrent,fetchWeather,createWeatherService,weatherPresets,weatherLabels,parseDaily,mapDaily,windLabel,visibilityLabel,rainbowStrength,parseRecentRain}=await import('../dist/weather.js');
const read=(code,cloud=0,wind=0,extra={})=>mapWeather({weather_code:code,cloud_cover:cloud,wind_speed_10m:wind,...extra});
const daily={time:['2026-10-18','2026-10-19','2026-10-20','bad'],weather_code:[45,63,96,1],temperature_2m_max:[29,27.5,30,25],temperature_2m_min:[23,22,24,20],precipitation_probability_max:[6,80,90,0],cloud_cover_mean:[20,95,100,0]};
const saturated={relative_humidity_2m:96,visibility:300};
// WMO code mapping
assert.equal(read(0,5).kind,'clear');assert(read(0,100).cloud<=.3,'A clear-sky code never draws a heavy cloud deck.');
assert.equal(read(2,10).kind,'partly');assert(read(2,10).cloud>=.4);
assert(read(3,20).cloud>=.85);
assert(read(45,60,0,saturated).fog>.8&&read(48,60,0,saturated).fog===1);
// Model "fog" at ordinary humidity (Open-Meteo reports it over dry air) must not draw fog.
for(const extra of [{},{relative_humidity_2m:70,visibility:300},{relative_humidity_2m:96,visibility:3000},{relative_humidity_2m:91,visibility:200}])assert.equal(read(45,30,0,extra).fog,0,'False model fog is ignored.');
assert.equal(read(45,10,0,{relative_humidity_2m:60,visibility:300}).kind,'clear');assert.equal(read(45,50,0,{relative_humidity_2m:60,visibility:300}).kind,'partly');assert.equal(read(45,95,0,{relative_humidity_2m:60,visibility:300}).kind,'cloudy');
assert.equal(read(53).kind,'drizzle');assert(read(53).rain<read(63).rain&&read(63).rain<read(65).rain);
assert.equal(read(81).kind,'rain');assert.equal(read(75).kind,'snow');assert.equal(read(86).snow,1);
assert.equal(read(95).kind,'thunder');assert.equal(read(99).thunder,1);assert(read(95).rain>0);
for(const code of [61,63,65,71,73,75,80,81,82,95]){const s=read(code,10);assert(s.cloud>=.8,`Precipitation code ${code} must close the sky.`);}
assert.equal(read(0,0,0).wind,0);assert.equal(read(0,0,2).wind,0);assert.equal(read(0,0,12).wind,1);assert.equal(read(0,0,40).wind,1);assert(read(0,0,7).wind>.4&&read(0,0,7).wind<.6);
for(let code=0;code<=99;code++){const s=read(code,50,5,saturated);for(const key of ['cloud','rain','snow','fog','thunder','wind'])assert(s[key]>=0&&s[key]<=1,`${code}.${key}`);}
for(const [name,preset] of Object.entries(weatherPresets)){assert(weatherLabels[name],name);for(const key of ['cloud','rain','snow','fog','thunder','wind'])assert(preset[key]>=0&&preset[key]<=1);}
// Biome adaptation
const rain=weatherPresets.rain,snow=weatherPresets.snow;
assert.equal(adaptToBiome(rain,'snow').rain,0);assert(adaptToBiome(rain,'snow').snow>0,'Rain becomes snow on the snowfield.');
assert.equal(adaptToBiome(snow,'desert').snow,0);assert(adaptToBiome(snow,'desert').cloud>=.75,'Desert snow is shown as overcast.');
assert.equal(adaptToBiome(snow,'grass').groundSnow,snow.snow);assert.equal(adaptToBiome(snow,'desert').groundSnow,0);assert.equal(adaptToBiome(rain,'grass').rain,rain.rain);
assert.equal(adaptToBiome(null,'grass'),null);
// Validation rejects anything unexpected
const good={current:{weather_code:3,cloud_cover:80,wind_speed_10m:4,temperature_2m:22}};
assert.deepEqual(validateCurrent(good),good.current);
const withExtras={current:{...good.current,relative_humidity_2m:80,visibility:24000}};assert.deepEqual(validateCurrent(withExtras),withExtras.current);
assert.throws(()=>validateCurrent({current:{...good.current,relative_humidity_2m:140}}));
for(const bad of [null,{},{current:{}},{current:{...good.current,weather_code:3.5}},{current:{...good.current,cloud_cover:140}},{current:{...good.current,wind_speed_10m:'4'}},{current:{...good.current,temperature_2m:NaN}},{current:{...good.current,weather_code:120}}])assert.throws(()=>validateCurrent(bad));
// Network behaviour with a fake fetch
const location={lat:23.99113,lng:121.61124,timeZone:'Asia/Taipei'};
let calls=[];const withDaily={...good,daily};const okFetch=async url=>{calls.push(url);return {ok:true,json:async()=>withDaily};};
await fetchWeather(location,{fetchImpl:okFetch});
const url=new URL(calls[0]);assert.equal(url.hostname,'api.open-meteo.com');assert.equal(url.searchParams.get('forecast_days'),'3');assert.equal(url.searchParams.get('latitude'),'23.99');assert.equal(url.searchParams.get('longitude'),'121.61');
assert(![...url.searchParams.keys()].some(k=>/key|token|secret/i.test(k)),'No credential may be sent.');
await assert.rejects(fetchWeather(location,{fetchImpl:async()=>({ok:false,status:500})}));
await assert.rejects(fetchWeather(location,{fetchImpl:async()=>({ok:true,json:async()=>({current:{}})})}));
// Daily outlook: malformed days are skipped, never thrown; model "fog" over dry air is mapped through cloud cover
const days=parseDaily({daily});assert.equal(days.length,3,'Only the next three days are kept.');
assert.deepEqual(parseDaily({}),[]);assert.deepEqual(parseDaily({daily:{time:'x'}}),[]);
assert.equal(parseDaily({daily:{...daily,weather_code:[45,'x',96]}}).length,2,'A malformed day is skipped.');
const outlook=mapDaily(days);assert.equal(outlook[0].kind,'clear','Daily model fog over clear skies reads as clear.');assert.equal(outlook[1].kind,'rain');assert.equal(outlook[2].kind,'thunder');assert.equal(outlook[1].pop,80);assert.equal(outlook[0].label,'晴朗');
assert.deepEqual(mapDaily(),[]);
// Rainbow: needs rain in the last 3 hours, none falling now, and the sun breaking through
const HOUR=3600000,T0=Date.UTC(2026,9,18,6,0,0);
const dry={...read(2,40),rainbow:0};
assert.equal(rainbowStrength(dry,T0-30*60000,T0),1,'Just after the rain, with sun: full strength.');
assert(rainbowStrength(dry,T0-2.25*HOUR,T0)>0&&rainbowStrength(dry,T0-2.25*HOUR,T0)<1,'The rainbow fades between 1.5 and 3 hours.');
assert.equal(rainbowStrength(dry,T0-4*HOUR,T0),0,'No rainbow long after the rain.');
assert.equal(rainbowStrength(dry,null,T0),0,'No rain history, no rainbow.');
assert.equal(rainbowStrength(read(63,100),T0-HOUR,T0),0,'Still raining: no rainbow.');
assert.equal(rainbowStrength(read(95,100),T0-HOUR,T0),0,'Thunderstorm: no rainbow.');
assert.equal(rainbowStrength({...dry,cloud:1},T0-HOUR,T0),0,'A solid overcast hides it.');
assert.equal(rainbowStrength(dry,T0+HOUR,T0),0,'Rain in the future is not history.');
assert(weatherPresets.rainbow.forceRainbow&&weatherPresets.rainbow.rainbow===1);assert.equal(weatherLabels.rainbow,'彩虹');
// Hourly rain: Open-Meteo gives local-time stamps and a UTC offset (Taipei is +8)
const rainData={utc_offset_seconds:28800,hourly:{time:['2026-10-18T10:00','2026-10-18T11:00','2026-10-18T12:00','2026-10-18T13:00'],precipitation:[0,1.4,0.1,0]}};
assert.equal(parseRecentRain(rainData,Date.UTC(2026,9,18,6,0,0)),Date.UTC(2026,9,18,3,0,0),'11:00 local = 03:00 UTC is the last rainy hour; 0.1 mm does not count.');
assert.equal(parseRecentRain(rainData,Date.UTC(2026,9,18,2,30,0)),null,'Hours after "now" are forecast, not history.');
assert.equal(parseRecentRain({}),null);assert.equal(parseRecentRain({hourly:{time:['x'],precipitation:[3]}}),null);
// Plain-language wind and visibility
assert.equal(windLabel(0),'無風');assert.equal(windLabel(2),'輕風');assert.equal(windLabel(6),'和風');assert.equal(windLabel(15),'疾風');assert.equal(windLabel(30),'暴風');
assert.equal(visibilityLabel(24140),'24 公里以上');assert.equal(visibilityLabel(3200),'3.2 公里');assert.equal(visibilityLabel(620),'620 公尺');assert.equal(visibilityLabel(null),null);assert.equal(visibilityLabel(undefined),null);
// Service: cache, freshness, failure fallback, stale expiry
const memory=()=>{const data={};return {getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;}};};
let clock=1_000_000,fetches=0,fail=false;
const fetchImpl=async()=>{fetches++;if(fail)throw new Error('offline');return {ok:true,json:async()=>good};};
const storage=memory(),seen=[];
const service=createWeatherService({getLocation:()=>location,onChange:s=>seen.push(s),fetchImpl,storage,now:()=>clock});
await service.update();assert.equal(fetches,1);assert.equal(service.snapshot().status,'ok');assert.equal(service.snapshot().state.kind,'cloudy');assert.equal(service.snapshot().temperature,22);assert.equal(service.snapshot().forecast.length,0,'No daily data yet in this fake response.');
await service.update();assert.equal(fetches,1,'A fresh reading is not fetched again.');
clock+=16*60*1000;await service.update();assert.equal(fetches,2,'Readings older than 15 minutes refresh.');
fail=true;clock+=16*60*1000;await service.update();assert.equal(service.snapshot().status,'error');assert.equal(service.snapshot().state.kind,'cloudy','The last good reading is kept after a failure.');
clock+=3*60*60*1000;await service.update();assert.equal(service.snapshot().state,null,'After 3 hours without data the scene returns to clear.');
// A second page load reuses the cache instead of calling the network
fail=false;clock+=1000;const second=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl,storage,now:()=>clock});
await second.update();const before=fetches;
const third=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl,storage,now:()=>clock});await third.update();assert.equal(fetches,before,'A fresh cache serves a new page load.');
// A cache written by an older version (no schema, no outlook) must not be served: it is refetched so the forecast appears at once
{
  const old=memory();old.setItem('tool-portal-weather-v1',JSON.stringify({key:'23.99,121.61',at:clock-1000,current:good.current}));
  let refetched=0;const service=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl:async()=>{refetched++;return {ok:true,json:async()=>withDaily};},storage:old,now:()=>clock});
  await service.update();assert.equal(refetched,1,'An old-schema cache is not trusted.');assert.equal(service.snapshot().forecast.length,3,'The fresh fetch brings the three-day outlook.');
  const reload=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl:async()=>{refetched++;return {ok:true,json:async()=>withDaily};},storage:old,now:()=>clock});
  await reload.update();assert.equal(refetched,1,'The upgraded cache is served on the next load.');assert.equal(reload.snapshot().forecast.length,3);
}
// Disabled or no location: no network at all
let quiet=0;const off=createWeatherService({getLocation:()=>null,onChange(){},fetchImpl:async()=>{quiet++;return {ok:true,json:async()=>good};},storage:memory(),now:()=>clock});
await off.update();assert.equal(quiet,0);assert.equal(off.snapshot().status,'nolocation');
const disabled=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl:async()=>{quiet++;return {ok:true,json:async()=>good};},storage:memory(),now:()=>clock});
disabled.setEnabled(false);await disabled.update();assert.equal(quiet,0);assert.equal(disabled.snapshot().status,'off');
assert(seen.length>0);
console.log('Weather: WMO mapping, biome adaptation, validation, cache, failure fallback and no-credential requests pass.');
