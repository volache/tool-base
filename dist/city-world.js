// A toy-brick town: pastel blocks with window grids, street lamps and little cars driving beside the dinosaur's lane.
// Buildings ride the same terrain belt as every other scene; cars move on their own clock so they really drive past.
export function createCityWorld(THREE,{scene,chunks,cube,batch,random,groundSpeed}){
  const pairs={beige:['#e6c9a8','#6b6670'],blue:['#9db9d8','#47607f'],coral:['#dc9087','#7b5560'],sage:['#b7cba8','#5a6f63'],cream:['#e4dfd2','#6c6f78'],roof:['#7d8790','#3e4753'],lane:['#e8ecef','#8a929b'],pole:['#6a747c','#3b444c'],glass:['#a9c7d9','#26344a']};
  const materials={},day={},night={};
  for(const [key,[d,n]] of Object.entries(pairs)){day[key]=new THREE.Color(d);night[key]=new THREE.Color(n);materials[key]=new THREE.MeshStandardMaterial({color:d,roughness:.86});}
  // Lit windows glow warm at night; the others stay dark glass.
  const litWindow=new THREE.MeshStandardMaterial({color:'#b5d2e2',roughness:.4,emissive:'#ffcf7a',emissiveIntensity:0});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff2cf',roughness:.5,emissive:'#ffd98c',emissiveIntensity:0});
  const glow=new THREE.MeshBasicMaterial({color:'#ffd58a',transparent:true,opacity:0,depthWrite:false});
  const beacon=new THREE.MeshStandardMaterial({color:'#e65a4f',roughness:.5,emissive:'#ff4a3a',emissiveIntensity:0});
  const bodyKeys=['beige','blue','coral','sage','cream'];
  const glowGeometry=new THREE.CylinderGeometry(1,1,.02,20);
  const towns=[];

  for(const {group} of chunks){
    const town=new THREE.Group();group.add(town);towns.push(town);
    const bodies=Object.fromEntries(bodyKeys.map(key=>[key,[]])),roofs=[],glass=[],lit=[],poles=[],beacons=[],lamps=[],glows=[],dashes=[];
    for(const side of [-1,1])for(let slot=0;slot<3;slot++){
      // The terrain belt is turned 45 degrees, so left-side blocks slide along a line that crosses the camera (distance |19.8 - x|).
      // They therefore start well past x = 38; right-side blocks never come closer than about 32 units, and may stand nearer the lane.
      // Blocks near the lane stay low so passing buildings never wall off the screen; the skyline rises farther out.
      const w=3+random()*2.6,d=3.2+random()*1.3,inner=side>0?13+random()*27:38+random()*12,h=3.5+Math.pow(random(),1.6)*(4.5+(inner-13)*.45);
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
    for(const side of [-1,1]){
      for(const z of [-3.75,3.75]){
        poles.push([side*8.6,1.4,z,.14,3.4,.14]);lamps.push([side*8.3,3.12,z,.6,.16,.3]);glows.push([side*8.3,-.27,z,1.8,1,1.8]);
      }
      for(let i=0;i<3;i++)dashes.push([side*10.4,-.28,-5+i*5,.14,.03,1.6]);
    }
    for(const key of bodyKeys)batch(town,cube,materials[key],bodies[key],false);
    batch(town,cube,materials.roof,roofs,false);batch(town,cube,materials.glass,glass,false);batch(town,cube,litWindow,lit,false);
    batch(town,cube,materials.pole,poles,false);batch(town,cube,beacon,beacons,false);batch(town,cube,lamp,lamps,false);
    batch(town,cube,materials.lane,dashes,false);batch(town,glowGeometry,glow,glows,false);
  }

  // Cars: body, cab and four lights, all instanced.
  const MAX_CARS=12,carColors=['#e07a5f','#3d85c6','#f2c14e','#81b29a','#f4f1de','#b56576'];
  const bodyMesh=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.55}),MAX_CARS);
  const cabMesh=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:'#c9dbe6',roughness:.3}),MAX_CARS);
  const headMaterial=new THREE.MeshStandardMaterial({color:'#fff6d8',roughness:.4,emissive:'#fff0b8',emissiveIntensity:0});
  const tailMaterial=new THREE.MeshStandardMaterial({color:'#d94a4a',roughness:.4,emissive:'#ff3030',emissiveIntensity:.15});
  const headMesh=new THREE.InstancedMesh(cube,headMaterial,MAX_CARS*2),tailMesh=new THREE.InstancedMesh(cube,tailMaterial,MAX_CARS*2);
  const cars=Array.from({length:MAX_CARS},(_,i)=>({side:i%2?1:-1,speed:2.5+random()*3.5,phase:random()*135,lane:(random()-.5)*.8}));
  const carGroup=[bodyMesh,cabMesh,headMesh,tailMesh];
  cars.forEach((car,i)=>bodyMesh.setColorAt(i,new THREE.Color(carColors[i%carColors.length])));
  for(const mesh of carGroup){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.visible=false;scene.add(mesh);}
  const transform=new THREE.Object3D();
  let enabled=false,quality='balanced',activity=1,count=8;
  function setCount(){count=Math.max(2,Math.round((quality==='low'?4:quality==='high'?12:8)*Math.min(1,.4+activity*.6)));for(const mesh of carGroup)mesh.count=mesh===headMesh||mesh===tailMesh?count*2:count;}
  setCount();
  function place(mesh,index,x,y,z,sx,sy,sz){transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(0,0,0);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);}
  function animate(time){
    if(!enabled)return;
    for(let i=0;i<count;i++){
      const car=cars[i],velocity=groundSpeed+car.side*car.speed,forward=velocity>=0?1:-1;
      const z=(((car.phase+time*velocity)%135)+135)%135-75,x=car.side*(10.2+car.lane);
      place(bodyMesh,i,x,.07,z,1,.5,1.9);place(cabMesh,i,x,.45,z-forward*.1,.82,.38,1);
      for(const side of [-1,1]){
        place(headMesh,i*2+(side>0?1:0),x+side*.3,.1,z+forward*.97,.22,.14,.06);
        place(tailMesh,i*2+(side>0?1:0),x+side*.3,.1,z-forward*.97,.22,.14,.06);
      }
    }
    for(const mesh of carGroup)mesh.instanceMatrix.needsUpdate=true;
  }
  function setPalette(active,mix){
    enabled=active;towns.forEach(town=>town.visible=active);for(const mesh of carGroup)mesh.visible=active;
    for(const key of Object.keys(materials))materials[key].color.copy(day[key]).lerp(night[key],mix);
    litWindow.emissiveIntensity=mix*1.7;litWindow.color.set('#b5d2e2').lerp(new THREE.Color('#ffe2a3'),mix);
    lamp.emissiveIntensity=mix*2.4;glow.opacity=mix*.3;beacon.emissiveIntensity=mix*1.6;headMaterial.emissiveIntensity=mix*2.2;tailMaterial.emissiveIntensity=.15+mix*1.2;
  }
  return {setPalette,animate,setQuality(value){quality=value;setCount();},setActivity(value){activity=value;setCount();}};
}
