// One continuous sky model shared by live mode and previews, driven only by the real sun altitude (radians).
// Night fades out between -11.5 and +3.4 degrees; the warm dawn/dusk tint peaks around the horizon and fades by about 17 degrees.
// azimuth > 0 means the sun is in the west (dusk), otherwise east (dawn).
const smooth=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export function getSkyNight(altitude){return 1-smooth(altitude,-.2,.06);}
export function getTwilightState(state){
  if(!state)return {amount:0,dusk:false};
  return {amount:smooth(state.altitude,-.22,-.04)*(1-smooth(state.altitude,.02,.3)),dusk:state.azimuth>0};
}
// Previews slow down while the sun is near the horizon so the dawn and dusk colours can be watched.
export function getPreviewSpeed(altitude){return 1-.75*smooth(altitude,-.26,-.12)*(1-smooth(altitude,.1,.3));}
