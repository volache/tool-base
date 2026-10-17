// A toy-brick town: pastel blocks with window grids, street lamps, a dark asphalt road under the dinosaur and two side roads with cars.
// Everything lives on the terrain belt, which is turned 45 degrees: "x" below is the lateral position across the road, "z" runs along it.
// Roads, markings and cars therefore all share one diagonal direction.
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

  // Road layout (lateral positions): dinosaur road |x| < 7.2, sidewalk 7.2-8.1, side roads 8.1-12.7 (two lanes each, same direction).
  const SIDE_ROAD=10.4,LANE=1.15,ROAD_TOP=-.285,MARK_Y=-.27;
  const roads=new THREE.Group();roads.visible=false;belt.add(roads);
  for(const [x,width] of [[0,14.4],[-SIDE_ROAD,4.6],[SIDE_ROAD,4.6]]){
    const slab=new THREE.Mesh(cube,materials.asphalt);slab.position.set(x,ROAD_TOP-.01,-8);slab.scale.set(width,.02,260);slab.receiveShadow=true;roads.add(slab);
  }

  chunks.forEach(({group},chunkIndex)=>{
    const town=new THREE.Group();group.add(town);towns.push(town);
    const bodies=Object.fromEntries(bodyKeys.map(key=>[key,[]])),roofs=[],glass=[],lit=[],poles=[],beacons=[],lamps=[],glows=[],dashes=[],edges=[],zebra=[];
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
    // Markings move with the ground (they live in the chunk), so the road visibly streams past.
    for(const z of [-5,0,5])dashes.push([0,MARK_Y,z,.22,.02,2.4]);                       // dashed centre line under the dinosaur
    for(const side of [-1,1]){
      edges.push([side*6.9,MARK_Y,0,.2,.02,15]);                                           // road edge lines
      edges.push([side*8.15,MARK_Y,0,.16,.02,15],[side*12.65,MARK_Y,0,.16,.02,15]);        // side road edges
      for(const z of [-5,0,5])dashes.push([side*SIDE_ROAD,MARK_Y,z,.16,.02,2.4]);          // lane divider of each side road
      for(const z of [-3.75,3.75]){
        poles.push([side*7.65,1.4,z,.14,3.4,.14]);lamps.push([side*7.35,3.12,z,.6,.16,.3]);glows.push([side*7.5,-.27,z,1.7,1,1.7]);
      }
    }
    // A zebra crossing every third chunk, across all three roads.
    if(chunkIndex%3===0)for(let x=-12.6;x<=12.6;x+=1.4)if(Math.abs(x)<6.9||(Math.abs(x)>8.4&&Math.abs(x)<12.4))zebra.push([x,MARK_Y,2.5,.7,.02,2.6]);
    for(const key of bodyKeys)batch(town,cube,materials[key],bodies[key],false);
    batch(town,cube,materials.roof,roofs,false);batch(town,cube,materials.glass,glass,false);batch(town,cube,litWindow,lit,false);
    batch(town,cube,materials.pole,poles,false);batch(town,cube,beacon,beacons,false);batch(town,cube,lamp,lamps,false);
    batch(town,cube,materials.lane,[...dashes,...zebra],false);batch(town,cube,materials.yellow,edges,false);batch(town,glowGeometry,glow,glows,false);
  });

  // The ground's scattered plates, studs and pebbles would poke through the side roads: shrink those inside the road bands while the city is shown.
  const dummy=new THREE.Object3D();let masked=null;
  function maskRoads(active){
    if(masked===active)return;masked=active;
    for(const chunk of chunks)for(const [mesh,positions] of chunk.ground??[]){
      positions.forEach((p,i)=>{
        const hide=active&&Math.abs(p[0])>7.4&&Math.abs(p[0])<13.6,scale=hide?0:1;
        dummy.position.set(p[0],p[1],p[2]);dummy.scale.set((p[3]??1)*scale,(p[4]??1)*scale,(p[5]??1)*scale);dummy.rotation.set(0,p[6]??0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;
    }
  }

  // Cars: body, cab and four lights, all instanced and parented to the belt so they follow the diagonal roads.
  // Right-hand traffic: with the dinosaur running along -z, cars on the +x road go the same way, cars on the -x road come toward it.
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
      // Relative to the ground a +x car moves toward -z (same way as the dinosaur); a -x car moves toward +z.
      const facing=-side,z=(((rank*LOOP/perRoad+(side>0?0:LOOP/perRoad/2)+time*velocity)%LOOP)+LOOP)%LOOP-75;
      const x=side*SIDE_ROAD+(rank%2?LANE:-LANE);
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
    enabled=active;towns.forEach(town=>town.visible=active);roads.visible=active;for(const mesh of carGroup)mesh.visible=active;maskRoads(active);
    for(const key of Object.keys(materials))materials[key].color.copy(day[key]).lerp(night[key],mix);
    litWindow.emissiveIntensity=mix*1.7;litWindow.color.set('#b5d2e2').lerp(new THREE.Color('#ffe2a3'),mix);
    lamp.emissiveIntensity=mix*2.4;glow.opacity=mix*.3;beacon.emissiveIntensity=mix*1.6;headMaterial.emissiveIntensity=mix*2.2;tailMaterial.emissiveIntensity=.15+mix*1.2;
  }
  return {setPalette,animate,setQuality(value){quality=value;setCount();},setActivity(value){activity=value;setCount();}};
}
