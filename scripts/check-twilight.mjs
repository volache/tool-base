import assert from 'node:assert/strict';
globalThis.window=globalThis;
const {getSunSkyState,getLocationSunTimes}=await import('../dist/sun-sky.js');
const {getSkyNight,getTwilightState,getPreviewSpeed}=await import('../dist/sky-model.js');
const location={lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'};
for(const day of ['2026-03-20','2026-06-21','2026-10-17','2026-12-21']){
  const events=getLocationSunTimes(location,new Date(`${day}T04:00:00Z`));
  const at=t=>{const s=getSunSkyState(t,location);return {...getTwilightState(s),night:getSkyNight(s.altitude)};};
  const rise=at(+events.rise),set=at(+events.set);
  assert(rise.amount>.9&&!rise.dusk,`${day}: sunrise must be a strong east/dawn twilight.`);
  assert(set.amount>.9&&set.dusk,`${day}: sunset must be a strong west/dusk twilight.`);
  assert(rise.night<.25&&rise.night>0,`${day}: the sky is already mostly day at sunrise.`);
  assert.equal(at((+events.rise+ +events.set)/2).amount,0,'Midday has no twilight tint.');
  assert.equal(at((+events.rise+ +events.set)/2).night,0,'Midday is full day.');
  assert.equal(at(+events.set+4*3600000).amount,0,'Deep night has no twilight tint.');
  assert.equal(at(+events.set+4*3600000).night,1,'Deep night is full night.');
  // Simulate a 30 second preview at 60 fps using the same speed curve the preview uses: the sky must change gently every frame.
  const bounds=[+events.rise-6*3600000,+events.set+6*3600000];let time=bounds[0],previous=at(time),worst=0,frames=0;
  while(time<bounds[1]&&frames<20000){
    const speed=getPreviewSpeed(getSunSkyState(time,location).altitude);
    time+=16.7*speed/30000*86400000;frames++;
    const next=at(time);worst=Math.max(worst,Math.abs(next.night-previous.night),Math.abs(next.amount-previous.amount));previous=next;
  }
  assert(worst<.012,`${day}: sky changes too abruptly between frames (${worst.toFixed(4)}).`);
}
assert.deepEqual(getTwilightState(null),{amount:0,dusk:false});
assert(getPreviewSpeed(1)===1&&getPreviewSpeed(-1)===1&&getPreviewSpeed(-.02)<.5,'Preview slows only near the horizon.');
console.log('Sky model: dawn/dusk follow real sunrise/sunset, midday and deep night are neutral, and playback changes stay gradual.');
