import {createTumbleweeds} from './tumbleweed.js';
// Small construction-toy silhouettes; each species is one or two instanced draws.
export function createDayLife(THREE,{scene,belt,cube,random,groundSpeed}){
  const dummy=new THREE.Object3D(),white=new THREE.MeshStandardMaterial({color:'#fff5df',roughness:.8});
  const wings=new THREE.InstancedMesh(cube,white,16),birds=new THREE.InstancedMesh(cube,white,12),tumbleweeds=createTumbleweeds(THREE,{belt,cube,groundSpeed}),tumble=tumbleweeds.mesh;
  scene.add(wings,birds);
  const lightMaterial=new THREE.MeshBasicMaterial({color:'#fff0ab',transparent:true,opacity:.17,depthWrite:false});
  const patches=new THREE.InstancedMesh(cube,lightMaterial,22);belt.add(patches);
  const seeds=Array.from({length:22},(_,i)=>({x:(i%2?-1:1)*(12+random()*29),z:-60+random()*90,phase:random()*6.28}));
  for(let i=0;i<16;i++)wings.setColorAt(i,new THREE.Color(['#edb762','#d58777','#7baec0','#efe2a4'][Math.floor(i/2)%4]));
  for(const mesh of [wings,birds,tumble,patches]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.visible=false;}
  let biome='grass',night=0,activity=1,quality='balanced';
  function count(base){return Math.max(1,Math.min(base,Math.round(base*Math.min(1,activity/1.5)*(quality==='low'?.5:1))));}
  function configure(){wings.visible=biome==='grass'&&night<.8;birds.visible=biome==='coast'&&night<.8;tumble.visible=biome==='desert';patches.visible=biome==='forest'&&night<.8;wings.count=count(8)*2;birds.count=count(6)*2;tumbleweeds.setCount(count(3));patches.count=count(22);lightMaterial.opacity=.17*(1-night);}
  function write(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  function animate(time){
    if(wings.visible)for(let i=0;i<wings.count/2;i++){const p=seeds[i],x=p.x+Math.sin(time*.45+p.phase)*2,z=p.z+Math.cos(time*.31+p.phase)*1.8,y=1.4+Math.sin(time*.8+p.phase)*.6;for(let side=0;side<2;side++){const s=side?1:-1;write(wings,i*2+side,x+s*.14,y,z,.27,.045,.28,0,time*.25,s*Math.sin(time*10+p.phase)*.95);}}
    if(birds.visible)for(let i=0;i<birds.count/2;i++){const p=seeds[i],x=((time*(.6+i*.05)+i*11)%100)-50,y=13+Math.sin(time*.3+i)*.6+i*.3,z=-55+i*3;for(let side=0;side<2;side++){const s=side?1:-1;write(birds,i*2+side,x+s*.32,y,z,.7,.08,.2,0,0,s*(.3+Math.sin(time*3+i)*.3));}}
    if(tumble.visible)tumbleweeds.animate(time);
    if(patches.visible)for(let i=0;i<patches.count;i++){const p=seeds[i],s=.8+Math.sin(time*.32+p.phase)*.2;write(patches,i,p.x+Math.sin(time*.17+p.phase)*.6,-.278,p.z,1.8*s,.008,.8*s,0,p.phase+Math.sin(time*.2)*.15,0);}
    for(const mesh of [wings,birds,tumble,patches])if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;
  }
  return {animate,setWind(value){tumbleweeds.setWind(value);},setPalette(b,mix){biome=b;night=mix;configure();},setActivity(value){activity=value;configure();},setQuality(value){quality=value;configure();}};
}
