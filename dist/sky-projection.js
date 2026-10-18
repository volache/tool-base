import {getLocationDayBounds} from './company-location.js';
// Cache civil-day boundaries as well as the peak: no Intl/binary searches per frame.
export function createPanoramaHeight(readState){
  let cache;
  return (state,time,location)=>{
    const key=`${location.lat}:${location.lng}:${location.timeZone}`;
    if(!cache||cache.key!==key||time<cache.start||time>=cache.end){
      const bounds=getLocationDayBounds(location,new Date(time));let peak=.01;
      for(let i=0;i<=192;i++)peak=Math.max(peak,Math.sin(readState(bounds.start+(bounds.end-bounds.start)*i/192,location).altitude));
      cache={...bounds,key,peak};
    }
    // At altitude 0 the sun's centre sits 0.2 above the screen centre: its lower edge then just meets the terrain's far edge (0.134), where it has already faded out completely.
    // The peak height is unchanged (0.825 on desktop).
    const amplitude=globalThis.innerWidth<600?.5:.625;
    return .2+Math.sin(state.altitude)/cache.peak*amplitude;
  };
}
