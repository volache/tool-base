import assert from 'node:assert/strict';
globalThis.window=globalThis;
const {getMoonSkyState}=await import('../dist/moon-sky.js');
const {getLocationMoonTimes,getLocationDayBounds,dayKey}=await import('../dist/company-location.js');
const location={name:'台北',lat:25.033,lng:121.5654,timeZone:'Asia/Taipei'},now=new Date('2026-10-17T05:00:00Z');
const events=getLocationMoonTimes(location,now);
assert(getMoonSkyState(events.rise.getTime()-600000,location).altitude<0);
assert(getMoonSkyState(events.rise.getTime()+600000,location).altitude>0);
assert(getMoonSkyState(events.set.getTime()-600000,location).altitude>0);
assert(getMoonSkyState(events.set.getTime()+600000,location).altitude<0);
for(let i=0;i<1440;i+=15){
  const time=now.getTime()+i*60000,a=getMoonSkyState(time,location),b=getMoonSkyState(time+1000,location);
  assert(Math.abs(Math.hypot(...a.direction)-1)<1e-10);
  assert(Math.hypot(...a.direction.map((v,j)=>v-b.direction[j]))<.0001,'Moon motion is discontinuous');
}
for(const [timeZone,date,hours] of [['Asia/Taipei','2026-10-17T12:00:00Z',24],['America/New_York','2026-03-08T12:00:00Z',23],['America/New_York','2026-11-01T12:00:00Z',25]]){
  const data={...location,timeZone},bounds=getLocationDayBounds(data,new Date(date));
  assert.equal((bounds.end-bounds.start)/3600000,hours);
  assert.equal(dayKey(new Date(bounds.start),timeZone),bounds.date);
  assert.notEqual(dayKey(new Date(bounds.start-1),timeZone),bounds.date);
  assert.equal(dayKey(new Date(bounds.end-1),timeZone),bounds.date);
}
console.log('Moon sky: rise/set horizon crossings, continuous motion, and 23/24/25-hour civil days pass.');
