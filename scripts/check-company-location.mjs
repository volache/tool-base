import assert from 'node:assert/strict';
globalThis.window=globalThis;
const {validLocation,getLocationMoonTimes}=await import('../dist/company-location.js');
const taipei={name:'台北',lat:25.033,lng:121.5654,timeZone:'Asia/Taipei'};
assert(validLocation(taipei));assert(validLocation({...taipei,lat:0,lng:0}));
for(const bad of [{lat:91},{lng:-181},{lat:NaN},{timeZone:'Not/AZone'}])assert(!validLocation({...taipei,...bad}));
const instant=new Date('2026-10-17T18:00:00Z');
for(const [timeZone,date] of [['Asia/Taipei','2026-10-18'],['Pacific/Kiritimati','2026-10-18'],['Pacific/Pago_Pago','2026-10-17']]){
  const location={...taipei,timeZone},result=getLocationMoonTimes(location,instant);
  assert.equal(result.date,date);
  assert(result.rise||result.set,'Expected a rise or set event at this latitude');
  const formatter=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  for(const event of [result.rise,result.set].filter(Boolean)){
    const parts=formatter.formatToParts(event),key=['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');assert.equal(key,date,'Event was assigned to the wrong company calendar day');
  }
}
console.log('Company location: validation and moon events pass for three time zones across the date boundary.');
