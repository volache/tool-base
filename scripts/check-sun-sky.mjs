import assert from 'node:assert/strict';
globalThis.window=globalThis;
const {getSunSkyState,getSunPanoramaHeight,getSunPanoramaX,getLocationSunTimes}=await import('../dist/sun-sky.js');
const {getMoonSkyState,getMoonPanoramaHeight}=await import('../dist/moon-sky.js');
const {getLocationDayBounds,getLocationMoonTimes,dayKey}=await import('../dist/company-location.js');
for(const location of [{lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'},{lat:35.6762,lng:139.6503,timeZone:'Asia/Tokyo'},{lat:40.7128,lng:-74.006,timeZone:'America/New_York'}]){
  const now=new Date('2026-10-17T12:00:00Z'),events=getLocationSunTimes(location,now),bounds=getLocationDayBounds(location,now);
  assert(events.rise&&events.set);assert.equal(dayKey(events.rise,location.timeZone),events.date);assert.equal(dayKey(events.set,location.timeZone),events.date);
  assert(getSunSkyState(+events.rise-600000,location).altitude<0);assert(getSunSkyState(+events.rise+600000,location).altitude>0);
  assert(getSunSkyState(+events.set-600000,location).altitude>0);assert(getSunSkyState(+events.set+600000,location).altitude<0);
  let peak=-Infinity;
  for(let i=0;i<=192;i++){const t=bounds.start+(bounds.end-bounds.start)*i/192,state=getSunSkyState(t,location),a=getSunPanoramaHeight(state,t,location),b=getSunPanoramaHeight(state,t,location);assert.equal(a,b);if(t<bounds.end)peak=Math.max(peak,a);}
  assert(Math.abs(peak-.825)<.01,'Sun arc must fit safely inside the viewport.');
}
const polar={lat:69.6492,lng:18.9553,timeZone:'Europe/Oslo'};
const summer=getLocationSunTimes(polar,new Date('2026-06-21T12:00:00Z'));assert.equal(summer.rise,undefined);assert.equal(summer.set,undefined);
const hualien={lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'},date=new Date('2026-10-17T04:00:00Z'),sun=getLocationSunTimes(hualien,date),moon=getLocationMoonTimes(hualien,date);
for(const p of [0,.25,.5,.75,1]){const time=+sun.rise+p*(sun.set-sun.rise),referenceTime=+moon.rise+p*(moon.set-moon.rise),a=getSunSkyState(time,hualien),b=getMoonSkyState(referenceTime,hualien);assert(Math.abs(getSunPanoramaX(a,time,hualien)-b.azimuth/Math.PI*1.5)<1e-10);assert(Math.abs(getSunPanoramaHeight(a,time,hualien)-getMoonPanoramaHeight(b,referenceTime,hualien))<1e-10);}
console.log('Sun: rise/set, civil dates in three time zones, shared projection, safe arc height and polar day pass.');
