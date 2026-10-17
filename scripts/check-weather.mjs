import assert from 'node:assert/strict';
const {mapWeather,adaptToBiome,validateCurrent,fetchWeather,createWeatherService,weatherPresets,weatherLabels}=await import('../dist/weather.js');
const read=(code,cloud=0,wind=0)=>mapWeather({weather_code:code,cloud_cover:cloud,wind_speed_10m:wind});
// WMO code mapping
assert.equal(read(0,5).kind,'clear');assert(read(0,100).cloud<=.3,'A clear-sky code never draws a heavy cloud deck.');
assert.equal(read(2,10).kind,'partly');assert(read(2,10).cloud>=.4);
assert(read(3,20).cloud>=.85);
assert(read(45).fog>.8&&read(48).fog===1);
assert.equal(read(53).kind,'drizzle');assert(read(53).rain<read(63).rain&&read(63).rain<read(65).rain);
assert.equal(read(81).kind,'rain');assert.equal(read(75).kind,'snow');assert.equal(read(86).snow,1);
assert.equal(read(95).kind,'thunder');assert.equal(read(99).thunder,1);assert(read(95).rain>0);
for(const code of [61,63,65,71,73,75,80,81,82,95]){const s=read(code,10);assert(s.cloud>=.8,`Precipitation code ${code} must close the sky.`);}
assert.equal(read(0,0,0).wind,0);assert.equal(read(0,0,2).wind,0);assert.equal(read(0,0,12).wind,1);assert.equal(read(0,0,40).wind,1);assert(read(0,0,7).wind>.4&&read(0,0,7).wind<.6);
for(let code=0;code<=99;code++){const s=read(code,50,5);for(const key of ['cloud','rain','snow','fog','thunder','wind'])assert(s[key]>=0&&s[key]<=1,`${code}.${key}`);}
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
for(const bad of [null,{},{current:{}},{current:{...good.current,weather_code:3.5}},{current:{...good.current,cloud_cover:140}},{current:{...good.current,wind_speed_10m:'4'}},{current:{...good.current,temperature_2m:NaN}},{current:{...good.current,weather_code:120}}])assert.throws(()=>validateCurrent(bad));
// Network behaviour with a fake fetch
const location={lat:23.99113,lng:121.61124,timeZone:'Asia/Taipei'};
let calls=[];const okFetch=async url=>{calls.push(url);return {ok:true,json:async()=>good};};
await fetchWeather(location,{fetchImpl:okFetch});
const url=new URL(calls[0]);assert.equal(url.hostname,'api.open-meteo.com');assert.equal(url.searchParams.get('latitude'),'23.99');assert.equal(url.searchParams.get('longitude'),'121.61');
assert(![...url.searchParams.keys()].some(k=>/key|token|secret/i.test(k)),'No credential may be sent.');
await assert.rejects(fetchWeather(location,{fetchImpl:async()=>({ok:false,status:500})}));
await assert.rejects(fetchWeather(location,{fetchImpl:async()=>({ok:true,json:async()=>({current:{}})})}));
// Service: cache, freshness, failure fallback, stale expiry
const memory=()=>{const data={};return {getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;}};};
let clock=1_000_000,fetches=0,fail=false;
const fetchImpl=async()=>{fetches++;if(fail)throw new Error('offline');return {ok:true,json:async()=>good};};
const storage=memory(),seen=[];
const service=createWeatherService({getLocation:()=>location,onChange:s=>seen.push(s),fetchImpl,storage,now:()=>clock});
await service.update();assert.equal(fetches,1);assert.equal(service.snapshot().status,'ok');assert.equal(service.snapshot().state.kind,'cloudy');assert.equal(service.snapshot().temperature,22);
await service.update();assert.equal(fetches,1,'A fresh reading is not fetched again.');
clock+=16*60*1000;await service.update();assert.equal(fetches,2,'Readings older than 15 minutes refresh.');
fail=true;clock+=16*60*1000;await service.update();assert.equal(service.snapshot().status,'error');assert.equal(service.snapshot().state.kind,'cloudy','The last good reading is kept after a failure.');
clock+=3*60*60*1000;await service.update();assert.equal(service.snapshot().state,null,'After 3 hours without data the scene returns to clear.');
// A second page load reuses the cache instead of calling the network
fail=false;clock+=1000;const second=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl,storage,now:()=>clock});
await second.update();const before=fetches;
const third=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl,storage,now:()=>clock});await third.update();assert.equal(fetches,before,'A fresh cache serves a new page load.');
// Disabled or no location: no network at all
let quiet=0;const off=createWeatherService({getLocation:()=>null,onChange(){},fetchImpl:async()=>{quiet++;return {ok:true,json:async()=>good};},storage:memory(),now:()=>clock});
await off.update();assert.equal(quiet,0);assert.equal(off.snapshot().status,'nolocation');
const disabled=createWeatherService({getLocation:()=>location,onChange(){},fetchImpl:async()=>{quiet++;return {ok:true,json:async()=>good};},storage:memory(),now:()=>clock});
disabled.setEnabled(false);await disabled.update();assert.equal(quiet,0);assert.equal(disabled.snapshot().status,'off');
assert(seen.length>0);
console.log('Weather: WMO mapping, biome adaptation, validation, cache, failure fallback and no-credential requests pass.');
