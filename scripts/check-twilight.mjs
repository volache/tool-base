import assert from 'node:assert/strict';
globalThis.window=globalThis;
const {getSunSkyState,getLocationSunTimes,getTwilightState}=await import('../dist/sun-sky.js');
const location={lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'};
const events=getLocationSunTimes(location,new Date('2026-10-17T04:00:00Z'));
const at=t=>getTwilightState(getSunSkyState(t,location));
const dawn=at(+events.rise),dusk=at(+events.set);
assert(dawn.amount>.6&&!dawn.dusk,'Sunrise must be a strong east/dawn twilight.');
assert(dusk.amount>.6&&dusk.dusk,'Sunset must be a strong west/dusk twilight.');
assert.equal(at((+events.rise+ +events.set)/2).amount,0,'Midday has no twilight tint.');
assert.equal(at(+events.set+4*3600000).amount,0,'Deep night has no twilight tint.');
let previous=-1;
for(let m=-120;m<=120;m+=5){const a=at(+events.set+m*60000).amount;assert(a>=0&&a<=1);if(m>-120)assert(Math.abs(a-previous)<.2,'Twilight must change smoothly.');previous=a;}
assert.deepEqual(getTwilightState(null),{amount:0,dusk:false});
console.log('Twilight: dawn/dusk peak at the horizon, vanish at noon and deep night, and change smoothly.');
