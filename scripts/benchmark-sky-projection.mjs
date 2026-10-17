globalThis.window=globalThis;
const {getMoonSkyState,getMoonPanoramaHeight}=await import('../dist/moon-sky.js');
const {getLocationDayBounds}=await import('../dist/company-location.js');
const location={lat:23.9911,lng:121.6112,timeZone:'Asia/Taipei'},time=Date.parse('2026-10-17T04:00:00Z'),state=getMoonSkyState(time,location);
getMoonPanoramaHeight(state,time,location);
let start=performance.now();for(let i=0;i<200;i++)getLocationDayBounds(location,new Date(time+i*16));const previous=performance.now()-start;
start=performance.now();for(let i=0;i<200;i++)getMoonPanoramaHeight(state,time+i*16,location);const current=performance.now()-start;
console.log(JSON.stringify({samples:200,previousCivilDayWorkMs:+previous.toFixed(3),cachedProjectionMs:+current.toFixed(3),note:'CPU microbenchmark, not an FPS promise.'}));
