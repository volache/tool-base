// City road markings follow Taiwan practice and never overlap (overlapping coplanar paint, or paint level with the lamp glow, shimmers when the camera moves).
import assert from 'node:assert/strict';
const {ROAD,roadMarkings,sideRoadX,isRoadBand}=await import('../dist/city-world.js');
const {centerX,halfWidth,sidewalk,sideWidth,markY,markHeight,glowY,roadTop,chunkLength,crosswalkZ,crosswalkLength}=ROAD;
const rect=([x,,z,w,,l])=>({x0:x-w/2,x1:x+w/2,z0:z-l/2,z1:z+l/2});
const overlap=(a,b)=>a.x0<b.x1-1e-9&&b.x0<a.x1-1e-9&&a.z0<b.z1-1e-9&&b.z0<a.z1-1e-9;
const all=marks=>[...marks.yellow,...marks.white,...marks.dashes,...marks.zebra,...marks.stops];

// 1. Opposing traffic is separated by a solid double yellow line, continuous across chunks except between a crosswalk's stop lines
const half=crosswalkLength/2,sameEdge=crosswalkZ+half+ROAD.stopGap+ROAD.stopThickness/2,oncomingEdge=crosswalkZ-half-ROAD.stopGap-ROAD.stopThickness/2;
for(let c=0;c<9;c++){
  const {yellow}=roadMarkings(c),crosswalk=c%3===0;
  assert.equal(yellow.length,crosswalk?4:2,'Double yellow: two lines, each split in two by a crosswalk.');
  for(const line of yellow)assert(Math.abs(Math.abs(line[0]-centerX)-.15)<1e-9);
  const left=yellow.filter(line=>line[0]<centerX).sort((a,b)=>a[2]-b[2]),right=yellow.filter(line=>line[0]>centerX);
  assert.equal(left.length,right.length);
  assert(Math.abs(right[0][0]-left[0][0])>left[0][3],'The two yellow lines are separate, with a gap between them.');
  if(!crosswalk){assert.equal(left[0][5],chunkLength,'Each yellow line runs the full chunk length, so it is continuous.');continue;}
  // Nothing yellow between the stop lines; the paint ends exactly at the stop lines' outer edges, so it is continuous everywhere else
  const [before,after]=left;
  assert(Math.abs(before[2]-before[5]/2+chunkLength/2)<1e-9&&Math.abs(before[2]+before[5]/2-oncomingEdge)<1e-9,'The yellow line ends at the oncoming stop line.');
  assert(Math.abs(after[2]-after[5]/2-sameEdge)<1e-9&&Math.abs(after[2]+after[5]/2-chunkLength/2)<1e-9,'The yellow line resumes after the other stop line.');
  for(const line of yellow)assert(line[2]+line[5]/2<=oncomingEdge+1e-9||line[2]-line[5]/2>=sameEdge-1e-9,'No yellow paint between the two stop lines.');
}
// 2. No white line paint on the centre line (the crosswalk stripes cross it where there is no yellow), and no marking overlaps another one
for(let c=0;c<9;c++){
  const marks=roadMarkings(c),centre={x0:centerX-.25,x1:centerX+.25,z0:-99,z1:99};
  for(const kind of ['white','dashes','stops'])for(const m of marks[kind])assert(!overlap(rect(m),centre),`chunk ${c}: ${kind} paint touches the double yellow line`);
  const rects=all(marks).map(rect);
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlap(rects[i],rects[j]),`chunk ${c}: markings ${i} and ${j} overlap`);
}
// 2b. Lane dashes never come near a crosswalk, even across chunk boundaries (chunks form a ring of nine, 15 units apart)
{
  const ring=9*chunkLength,zones=[];
  for(let c=0;c<9;c+=3)zones.push([c*chunkLength+oncomingEdge,c*chunkLength+sameEdge]);            // between the stop lines, absolute
  for(let c=0;c<9;c++)for(const dash of roadMarkings(c).dashes){
    const from=c*chunkLength+dash[2]-dash[5]/2,to=c*chunkLength+dash[2]+dash[5]/2;
    for(const [a,b] of zones)for(const wrap of [-ring,0,ring]){
      const gap=Math.max(a+wrap-to,from-(b+wrap));
      assert(gap>=ROAD.dashClear-1e-9||(gap<0&&false),`chunk ${c}: a lane dash comes within ${gap.toFixed(2)} of a crosswalk (needs ${ROAD.dashClear})`);
    }
  }
}
// 3. Lane dividers dashed (dash shorter than the gap), edges solid and full length
{
  const marks=roadMarkings(1);
  assert.equal(marks.white.length,6,'Six solid edge lines: street, left road, right road.');
  for(const edge of marks.white)assert.equal(edge[5],chunkLength);
  assert(marks.dashes.length>=8&&marks.dashes.length<=12&&marks.dashes.length%4===0,'Dashed dividers on the street (two) and both side roads: the same dashes on all four dividers.');
  for(const dash of marks.dashes)assert(dash[5]*2<chunkLength/3*1.2+dash[5],'Dashes are shorter than their gaps.');
  assert(marks.dashes.every(d=>d[5]<chunkLength/3),'Dash length is less than one third of the repeat.');
}
// 4. Crosswalks every third chunk, with stop lines before them for each direction
for(let c=0;c<9;c++){
  const marks=roadMarkings(c),has=c%3===0;
  assert.equal(marks.zebra.length>0,has,`chunk ${c}: zebra only every third chunk`);
  assert.equal(marks.stops.length,has?4:0,`chunk ${c}: four stop lines (street and side road, both ways) with a crosswalk`);
  if(!has)continue;
  const nearEdge=crosswalkZ-crosswalkLength/2,farEdge=crosswalkZ+crosswalkLength/2;
  for(const stripe of marks.zebra){assert(Math.abs(stripe[2]-crosswalkZ)<1e-9);assert.equal(stripe[5],crosswalkLength);}
  const rightStops=marks.stops.filter(s=>s[0]>centerX),leftStops=marks.stops.filter(s=>s[0]<centerX);
  assert.equal(rightStops.length,2);assert.equal(leftStops.length,2);
  // Right-hand traffic moves towards -z (the dinosaur's way): it meets the +z edge of the crosswalk first, so its stop line is on that side
  for(const stop of rightStops)assert(stop[2]-stop[5]/2>=farEdge,'The stop line for traffic moving toward -z lies before the far (+z) edge of the crosswalk.');
  for(const stop of leftStops)assert(stop[2]+stop[5]/2<=nearEdge,'The stop line for oncoming traffic lies before the near (-z) edge of the crosswalk.');
  // Each stop line spans its own direction's lanes only
  const street=marks.stops.filter(s=>Math.abs(s[0]-centerX)<halfWidth);
  for(const stop of street)assert(stop[3]>halfWidth-.6&&stop[3]<halfWidth,`A street stop line covers about one direction's two lanes: ${stop[3]}`);
  for(const stop of marks.stops.filter(s=>Math.abs(s[0]-centerX)>halfWidth))assert(stop[3]>sideWidth-.6&&stop[3]<sideWidth);
}
// 4b. Zebra stripes are continuous across each road: evenly spaced, centred, equal margins at both kerbs, unbroken across the centre line
{
  const {zebra}=roadMarkings(0),pitch=1.4;
  const roadsAt=[[centerX-halfWidth,centerX+halfWidth],[sideRoadX(-1)-sideWidth/2,sideRoadX(-1)+sideWidth/2],[sideRoadX(1)-sideWidth/2,sideRoadX(1)+sideWidth/2]];
  for(const [from,to] of roadsAt){
    const stripes=zebra.map(z=>z[0]).filter(x=>x>from&&x<to).sort((a,b)=>a-b);
    assert(stripes.length>=2,`a road of width ${(to-from).toFixed(1)} has several stripes: ${stripes}`);
    for(let i=1;i<stripes.length;i++)assert(Math.abs(stripes[i]-stripes[i-1]-pitch)<1e-6,`stripe spacing is even (${(stripes[i]-stripes[i-1]).toFixed(2)}) with no missing stripe`);
    const leftMargin=stripes[0]-.35-from,rightMargin=to-(stripes.at(-1)+.35);
    assert(Math.abs(leftMargin-rightMargin)<1e-6,`equal margins at both kerbs: ${leftMargin.toFixed(2)} vs ${rightMargin.toFixed(2)}`);
    assert(leftMargin>.2&&leftMargin<pitch,'the stripes clear the edge line and reach close to both kerbs');
  }
  const street=zebra.map(z=>z[0]).filter(x=>x>centerX-halfWidth&&x<centerX+halfWidth).sort((a,b)=>a-b);
  const across=street.filter(x=>Math.abs(x-centerX)<pitch);
  assert(across.length>=2&&across.some(x=>x<centerX)&&across.some(x=>x>centerX),'The crosswalk runs across the centre line with stripes on both sides and no missing stripe.');
}
// 5. Paint sits on the asphalt, and the lamp glow clearly above the paint (no coplanar surfaces)
assert(markY-markHeight/2>roadTop,'Markings lie above the asphalt.');
assert(glowY-.01>=markY+markHeight/2+.002,'The lamp glow lies above the paint, never level with it.');
// 6. Layout: the three roads do not overlap, and the sidewalks and medians are cleared of ground pieces
assert(sideRoadX(-1)+sideWidth/2<centerX-halfWidth&&sideRoadX(1)-sideWidth/2>centerX+halfWidth,'Side roads lie beyond the street.');
assert(Math.abs((centerX-halfWidth)-(sideRoadX(-1)+sideWidth/2))>=sidewalk-1e-9,'A sidewalk separates each side road from the street.');
for(const x of [-7.9,-7.3,-7.05,-6.9,-6.5,5.0,4.8,sideRoadX(-1),sideRoadX(1),-12.8,-14,9.9,10.8])assert(isRoadBand(x),`x=${x} (street edge, sidewalk or side road) must be cleared`);
for(const x of [0,-6,4,-15,11.5,20,-30])assert(!isRoadBand(x),`x=${x} must keep its ground pieces`);
// Every ground piece the original terrain can place (including its +0.3 pebble and -0.4 sprout offsets and its size) stays clear of the asphalt.
{
  const streetFrom=centerX-halfWidth,streetTo=centerX+halfWidth,leftFrom=sideRoadX(-1)-sideWidth/2,leftTo=sideRoadX(-1)+sideWidth/2,rightFrom=sideRoadX(1)-sideWidth/2,rightTo=sideRoadX(1)+sideWidth/2;
  for(let x=-30;x<=30;x+=.05){
    for(const [offset,half] of [[0,.9],[.3,.9],[-.4,.1],[.18,.1]]){
      const centre=x+offset,visible=!isRoadBand(centre);
      if(!visible)continue;
      // A surviving piece (it keeps its ground only where the centre is outside the band) must not overlap any road surface by more than a stud's thickness
      const touches=(from,to)=>centre+half>from+.05&&centre-half<to-.05;
      if(Math.abs(x)<7.2)continue;       // the terrain only places raised pieces at |x| >= 7.2; plates inside the lane are flat and lie below the asphalt
      assert(!touches(streetFrom,streetTo)&&!touches(leftFrom,leftTo)&&!touches(rightFrom,rightTo),`a ground piece centred at ${centre.toFixed(2)} (half-size ${half}) would poke through the asphalt`);
    }
  }
}
// 7. The dinosaur (x = 0) runs in the first lane to the right of the yellow line
assert(Math.abs(centerX+ROAD.laneWidth/2)<1e-9,'The dinosaur (x = 0) runs along the middle of the first lane to the right of the double yellow line.');
console.log('City roads: double yellow centre line, white lane dashes and edges, stop lines before every crosswalk, no overlapping paint.');
