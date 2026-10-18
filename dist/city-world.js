// A toy-brick town: pastel blocks with window grids, street lamps, a two-way street under the dinosaur and a one-way road on each side with cars.
// Everything lives on the terrain belt, which is turned 45 degrees: "x" below is the lateral position across the road, "z" runs along it.
// Roads, markings and cars therefore all share one diagonal direction.

// Road layout, in lateral positions (x) and plan-view marking rectangles [x, y, z, width, height, length], following Taiwan road-marking practice:
// a solid double yellow line separates opposing traffic, white dashed lines separate lanes of the same direction, white solid lines mark the edges,
// and each direction has a white stop line before the crosswalk, seen from the way its traffic is moving. Traffic keeps right.
export const ROAD={
  centerX:-1.5,          // the double yellow line; the dinosaur's lane (x = 0) is the first lane to its right
  halfWidth:6,           // two 3-metre lanes each way
  laneWidth:3,
  sidewalk:.9,
  sideWidth:4.6,
  sideLane:1.15,
  markY:-.268,markHeight:.02,
  glowY:-.245,           // lamp glow sits clearly above the markings: coplanar surfaces would z-fight and flicker
  roadTop:-.285,
  chunkLength:15,
  crosswalkZ:2.5,crosswalkLength:2.6,stopGap:.9,stopThickness:.4,
  dashClear:4.5          // lane dashes keep at least this far from a crosswalk's stop lines
};
// Centre of a one-way side road: +1 is the right-hand side (same direction as the dinosaur), -1 the left (oncoming).
export const sideRoadX=side=>ROAD.centerX+side*(ROAD.halfWidth+ROAD.sidewalk+ROAD.sideWidth/2);
// A right-of-centre lane of the two-way street carries traffic the dinosaur's way (towards -z); the left lanes come the other way.
// Between a crosswalk's two stop lines there is no double yellow and no lane dashes, and lane dashes keep a clear distance beyond each stop line.
// A crosswalk sits in every third chunk (the chunks form a ring), and dashes also respect crosswalks in the neighbouring chunks.
export function roadMarkings(chunkIndex,chunkCount=9){
  const {centerX,halfWidth,laneWidth,markY,markHeight,chunkLength,crosswalkZ,crosswalkLength,stopGap,stopThickness,dashClear}=ROAD;
  const mark=(x,z,width,length)=>[x,markY,z,width,markHeight,length];
  const hasCrosswalk=index=>(((index%chunkCount)+chunkCount)%chunkCount)%3===0;
  const half=crosswalkLength/2,sameZ=crosswalkZ+half+stopGap,oncomingZ=crosswalkZ-half-stopGap;
  const sameEdge=sameZ+stopThickness/2,oncomingEdge=oncomingZ-stopThickness/2;      // outer edges of the two stop lines
  const crosswalk=hasCrosswalk(chunkIndex);
  const yellow=[],white=[],dashes=[],zebra=[],stops=[];
  // Double solid yellow, continuous across chunks except between the two stop lines of a crosswalk.
  const spans=crosswalk?[[-chunkLength/2,oncomingEdge],[sameEdge,chunkLength/2]]:[[-chunkLength/2,chunkLength/2]];
  for(const [from,to] of spans)for(const dx of [-.15,.15])yellow.push(mark(centerX+dx,(from+to)/2,.12,to-from));
  const edgeXs=[centerX-halfWidth,centerX+halfWidth,sideRoadX(-1)-ROAD.sideWidth/2,sideRoadX(-1)+ROAD.sideWidth/2,sideRoadX(1)-ROAD.sideWidth/2,sideRoadX(1)+ROAD.sideWidth/2];
  for(const x of edgeXs)white.push(mark(x,0,.16,chunkLength));                                   // solid edge lines
  // Lane dividers are dashed white. Dashes are left out wherever they would come within dashClear of a crosswalk's stop lines.
  const clearZones=[];
  for(const shift of [-1,0,1])if(hasCrosswalk(chunkIndex+shift))clearZones.push([shift*chunkLength+oncomingEdge-dashClear,shift*chunkLength+sameEdge+dashClear]);
  for(const x of [centerX-laneWidth,centerX+laneWidth,sideRoadX(-1),sideRoadX(1)])for(const z of [-5,0,5]){
    if(clearZones.some(([from,to])=>z+1.2>from&&z-1.2<to))continue;
    dashes.push(mark(x,z,.16,2.4));
  }
  if(crosswalk){
    const roads=[[centerX-halfWidth,centerX+halfWidth],[sideRoadX(-1)-ROAD.sideWidth/2,sideRoadX(-1)+ROAD.sideWidth/2],[sideRoadX(1)-ROAD.sideWidth/2,sideRoadX(1)+ROAD.sideWidth/2]];
    // Each road gets its own evenly spaced, centred set of stripes, so the pattern is unbroken across the road (including over the centre
    // line, where there is no yellow between the stop lines) and leaves an equal margin at both kerbs, clear of the solid edge lines.
    for(const [from,to] of roads){
      const width=to-from,count=Math.max(2,Math.floor((width-.4)/1.4)),start=(from+to)/2-(count-1)*1.4/2;
      for(let i=0;i<count;i++)zebra.push(mark(start+i*1.4,crosswalkZ,.7,crosswalkLength));
    }
    // Stop lines: traffic moving towards -z (right of the yellow line, and the right-hand side road) stops on the +z side of the crosswalk; the opposite direction on the -z side.
    const inset=.12,span=(from,to,z)=>mark((from+to)/2,z,to-from,stopThickness);
    stops.push(span(centerX+.22+inset,centerX+halfWidth-inset,sameZ),span(sideRoadX(1)-ROAD.sideWidth/2+inset,sideRoadX(1)+ROAD.sideWidth/2-inset,sameZ));
    stops.push(span(centerX-halfWidth+inset,centerX-.22-inset,oncomingZ),span(sideRoadX(-1)-ROAD.sideWidth/2+inset,sideRoadX(-1)+ROAD.sideWidth/2-inset,oncomingZ));
  }
  return {yellow,white,dashes,zebra,stops};
}
// Ground pieces (plates, studs, pebbles, sprouts) must not poke through the asphalt. The band is wider than the road itself because the
// pieces have size (up to about 1.8 across) and some are offset toward the road from their centre (pebbles +0.3): anything whose centre lies
// within 1.1 of the street edge, or within 0.6 of a side-road edge, is cleared. Lane plates below the asphalt are cleared too, which is invisible.
export function isRoadBand(x){return (x<-6.4&&x>-14.3)||(x>4.6&&x<11);}

export function createCityWorld(THREE,{belt,chunks,cube,batch,random,groundSpeed}){
  const pairs={beige:['#e6c9a8','#6b6670'],blue:['#9db9d8','#47607f'],coral:['#dc9087','#7b5560'],sage:['#b7cba8','#5a6f63'],cream:['#e4dfd2','#6c6f78'],roof:['#7d8790','#3e4753'],lane:['#eef1f3','#9aa2ab'],yellow:['#e8c04a','#8f7b3a'],pole:['#6a747c','#3b444c'],glass:['#a9c7d9','#26344a'],asphalt:['#4b545c','#20272f']};
  const materials={},day={},night={};
  for(const [key,[d,n]] of Object.entries(pairs)){day[key]=new THREE.Color(d);night[key]=new THREE.Color(n);materials[key]=new THREE.MeshStandardMaterial({color:d,roughness:key==='asphalt'?.95:.86});}
  // Lit windows glow warm at night; the others stay dark glass.
  const litWindow=new THREE.MeshStandardMaterial({color:'#b5d2e2',roughness:.4,emissive:'#ffcf7a',emissiveIntensity:0});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff2cf',roughness:.5,emissive:'#ffd98c',emissiveIntensity:0});
  const glow=new THREE.MeshBasicMaterial({color:'#ffd58a',transparent:true,opacity:0,depthWrite:false});
  const beacon=new THREE.MeshStandardMaterial({color:'#e65a4f',roughness:.5,emissive:'#ff4a3a',emissiveIntensity:0});
  const bodyKeys=['beige','blue','coral','sage','cream'];
  const glowGeometry=new THREE.CylinderGeometry(1,1,.02,20);
  const towns=[];

  const {centerX,halfWidth,sidewalk,sideWidth,sideLane,roadTop,glowY}=ROAD;
  const roads=new THREE.Group();roads.visible=false;belt.add(roads);
  for(const [x,width] of [[centerX,halfWidth*2],[sideRoadX(-1),sideWidth],[sideRoadX(1),sideWidth]]){
    const slab=new THREE.Mesh(cube,materials.asphalt);slab.position.set(x,roadTop-.01,-8);slab.scale.set(width,.02,260);slab.receiveShadow=true;roads.add(slab);
  }
  // Lamps stand on the sidewalks between the street and the side roads, with their arms over the street.
  const lampSides=[[centerX-halfWidth-sidewalk/2,1],[centerX+halfWidth+sidewalk/2,-1]];

  chunks.forEach(({group},chunkIndex)=>{
    const town=new THREE.Group();group.add(town);towns.push(town);
    const bodies=Object.fromEntries(bodyKeys.map(key=>[key,[]])),roofs=[],glass=[],lit=[],poles=[],beacons=[],lamps=[],glows=[];
    for(const side of [-1,1])for(let slot=0;slot<3;slot++){
      // The belt is turned 45 degrees, so left-side blocks slide along a line that crosses the camera (distance |19.8 - x|).
      // They therefore start well past x = 38; right-side blocks never come closer than about 32 units, and may stand nearer the lane.
      // Blocks near the lane stay low so passing buildings never wall off the screen; the skyline rises farther out.
      const w=3+random()*2.6,d=3.2+random()*1.3,inner=side>0?15+random()*25:38+random()*12,h=3.5+Math.pow(random(),1.6)*(4.5+(inner-15)*.45);
      const cx=side*(inner+w/2),z=(slot-1)*5+(random()-.5)*1.2;
      bodies[bodyKeys[Math.floor(random()*bodyKeys.length)]].push([cx,h/2-.3,z,w,h,d]);
      roofs.push([cx,h-.12,z,w+.3,.36,d+.3],[cx+(random()-.5)*w*.4,h+.25,z+(random()-.5)*d*.3,.9,.45,.8]);
      const floors=Math.floor((h-1.2)/1.7),columns=Math.max(1,Math.floor((w-.6)/1.25)),depthColumns=Math.max(1,Math.floor((d-.6)/1.25));
      for(let floor=0;floor<floors;floor++){
        const y=.6+floor*1.7;
        for(let column=0;column<columns;column++)(random()<.42?lit:glass).push([cx-(columns-1)*.625+column*1.25,y,z+d/2+.03,.62,.8,.08]);
        for(let column=0;column<depthColumns;column++)(random()<.42?lit:glass).push([cx-side*(w/2+.03),y,z-(depthColumns-1)*.625+column*1.25,.08,.8,.62]);
      }
      if(h>11){poles.push([cx,h+.9,z,.12,2,.12]);beacons.push([cx,h+2,z,.24,.24,.24]);}
    }
    for(const [x,towardStreet] of lampSides)for(const z of [-3.75,3.75]){
      poles.push([x,1.4,z,.14,3.4,.14]);lamps.push([x+towardStreet*.3,3.12,z,.6,.16,.3]);glows.push([x+towardStreet*.2,glowY,z,1.7,1,1.7]);
    }
    // Markings move with the ground (they live in the chunk), so the road visibly streams past.
    const marks=roadMarkings(chunkIndex,chunks.length);
    for(const key of bodyKeys)batch(town,cube,materials[key],bodies[key],false);
    batch(town,cube,materials.roof,roofs,false);batch(town,cube,materials.glass,glass,false);batch(town,cube,litWindow,lit,false);
    batch(town,cube,materials.pole,poles,false);batch(town,cube,beacon,beacons,false);batch(town,cube,lamp,lamps,false);
    batch(town,cube,materials.lane,[...marks.white,...marks.dashes,...marks.zebra,...marks.stops],false);batch(town,cube,materials.yellow,marks.yellow,false);
    batch(town,glowGeometry,glow,glows,false);
  });

  // Cars: body, cab and four lights, all instanced and parented to the belt so they follow the diagonal roads.
  // Right-hand traffic: with the dinosaur running along -z, cars on the right road go the same way, cars on the left road come toward it.
  // Every car on a road shares that road's speed and is spaced evenly around the loop, so they never touch.
  const MAX_CARS=12,LOOP=135,carColors=['#e07a5f','#3d85c6','#f2c14e','#81b29a','#f4f1de','#b56576'];
  const bodyMesh=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.55}),MAX_CARS);
  const cabMesh=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:'#c9dbe6',roughness:.3}),MAX_CARS);
  const headMaterial=new THREE.MeshStandardMaterial({color:'#fff6d8',roughness:.4,emissive:'#fff0b8',emissiveIntensity:0});
  const tailMaterial=new THREE.MeshStandardMaterial({color:'#d94a4a',roughness:.4,emissive:'#ff3030',emissiveIntensity:.15});
  const headMesh=new THREE.InstancedMesh(cube,headMaterial,MAX_CARS*2),tailMesh=new THREE.InstancedMesh(cube,tailMaterial,MAX_CARS*2);
  const carGroup=[bodyMesh,cabMesh,headMesh,tailMesh];
  for(let i=0;i<MAX_CARS;i++)bodyMesh.setColorAt(i,new THREE.Color(carColors[i%carColors.length]));
  for(const mesh of carGroup){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.visible=false;belt.add(mesh);}
  const transform=new THREE.Object3D(),roadSpeed={'1':3.2,'-1':4.4};
  let enabled=false,quality='balanced',activity=1,perRoad=4;
  function setCount(){
    perRoad=Math.max(1,Math.round((quality==='low'?2:quality==='high'?6:4)*Math.min(1,.4+activity*.6)));
    for(const mesh of carGroup)mesh.count=mesh===headMesh||mesh===tailMesh?perRoad*4:perRoad*2;
  }
  setCount();
  function place(mesh,index,x,y,z,sx,sy,sz){transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(0,0,0);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);}
  function animate(time){
    if(!enabled)return;
    for(let slot=0;slot<perRoad*2;slot++){
      const side=slot%2?1:-1,rank=Math.floor(slot/2),velocity=groundSpeed-side*roadSpeed[side];
      // Relative to the ground a right-road car moves toward -z (same way as the dinosaur); a left-road car moves toward +z.
      const facing=-side,z=(((rank*LOOP/perRoad+(side>0?0:LOOP/perRoad/2)+time*velocity)%LOOP)+LOOP)%LOOP-75;
      const x=sideRoadX(side)+(rank%2?sideLane:-sideLane);
      place(bodyMesh,slot,x,.07,z,1,.5,1.9);place(cabMesh,slot,x,.45,z-facing*.1,.82,.38,1);
      for(const lateral of [-1,1]){
        const light=slot*2+(lateral>0?1:0);
        place(headMesh,light,x+lateral*.3,.1,z+facing*.97,.22,.14,.06);
        place(tailMesh,light,x+lateral*.3,.1,z-facing*.97,.22,.14,.06);
      }
    }
    for(const mesh of carGroup)mesh.instanceMatrix.needsUpdate=true;
  }
  function setPalette(active,mix){
    enabled=active;towns.forEach(town=>town.visible=active);roads.visible=active;for(const mesh of carGroup)mesh.visible=active;
    for(const key of Object.keys(materials))materials[key].color.copy(day[key]).lerp(night[key],mix);
    litWindow.emissiveIntensity=mix*1.7;litWindow.color.set('#b5d2e2').lerp(new THREE.Color('#ffe2a3'),mix);
    lamp.emissiveIntensity=mix*2.4;glow.opacity=mix*.3;beacon.emissiveIntensity=mix*1.6;headMaterial.emissiveIntensity=mix*2.2;tailMaterial.emissiveIntensity=.15+mix*1.2;
  }
  return {setPalette,animate,setQuality(value){quality=value;setCount();},setActivity(value){activity=value;setCount();}};
}
