// Small construction-toy silhouettes; each species is one or two instanced draws.
export function createDayLife(THREE,{scene,belt,cube,random}){
  const dummy=new THREE.Object3D(),white=new THREE.MeshStandardMaterial({color:'#fff5df',roughness:.8}),gold=new THREE.MeshStandardMaterial({color:'#c8a364',roughness:.9});
  // Interwoven, irregular polygon loops form a closed twig ball.
  const twigs=[],up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(1,0,0),roll=new THREE.Quaternion(),center=new THREE.Vector3(),direction=new THREE.Vector3();
  for(let ring=0;ring<4;ring++){
    const tilt=new THREE.Euler(ring*.91,ring*.63,ring*.47),points=[];
    for(let j=0;j<11;j++){const a=j/11*Math.PI*2,r=.49+.055*Math.sin(j*4.7+ring*2.3);points.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0).applyEuler(tilt));}
    for(let j=0;j<11;j++){const a=points[j],b=points[(j+1)%11];twigs.push({center:a.clone().add(b).multiplyScalar(.5),direction:b.clone().sub(a).normalize(),length:a.distanceTo(b)+.035});}
  }
  // Short forks break up the outline so the ball does not read as a wire cage.
  for(let i=0;i<12;i++){
    const branch=twigs[i*3],a=branch.center.clone(),b=a.clone().multiplyScalar(1.24).add(new THREE.Vector3(Math.sin(i*2.4)*.1,Math.cos(i*1.7)*.08,Math.sin(i*.9)*.1));
    twigs.push({center:a.clone().add(b).multiplyScalar(.5),direction:b.clone().sub(a).normalize(),length:a.distanceTo(b)+.02});
  }
  const twigCount=twigs.length;
  const wings=new THREE.InstancedMesh(cube,white,16),birds=new THREE.InstancedMesh(cube,white,12),tumble=new THREE.InstancedMesh(cube,gold,3*twigCount);
  tumble.castShadow=true;
  for(let i=0;i<3*twigCount;i++)tumble.setColorAt(i,new THREE.Color(['#d1b27c','#b89558','#e1c48d'][i%3]));
  scene.add(wings,birds);belt.add(tumble);
  const lightMaterial=new THREE.MeshBasicMaterial({color:'#fff0ab',transparent:true,opacity:.17,depthWrite:false});
  const patches=new THREE.InstancedMesh(cube,lightMaterial,22);belt.add(patches);
  const seeds=Array.from({length:22},(_,i)=>({x:(i%2?-1:1)*(12+random()*29),z:-60+random()*90,phase:random()*6.28}));
  for(let i=0;i<16;i++)wings.setColorAt(i,new THREE.Color(['#edb762','#d58777','#7baec0','#efe2a4'][Math.floor(i/2)%4]));
  for(const mesh of [wings,birds,tumble,patches]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.visible=false;}
  let biome='grass',night=0,activity=1,quality='balanced';
  function count(base){return Math.max(1,Math.min(base,Math.round(base*Math.min(1,activity/1.5)*(quality==='low'?.5:1))));}
  function configure(){wings.visible=biome==='grass'&&night<.8;birds.visible=biome==='coast'&&night<.8;tumble.visible=biome==='desert';patches.visible=biome==='forest'&&night<.8;wings.count=count(8)*2;birds.count=count(6)*2;tumble.count=count(3)*twigCount;patches.count=count(22);lightMaterial.opacity=.17*(1-night);}
  function write(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  function animate(time){
    if(wings.visible)for(let i=0;i<wings.count/2;i++){const p=seeds[i],x=p.x+Math.sin(time*.45+p.phase)*2,z=p.z+Math.cos(time*.31+p.phase)*1.8,y=1.4+Math.sin(time*.8+p.phase)*.6;for(let side=0;side<2;side++){const s=side?1:-1;write(wings,i*2+side,x+s*.14,y,z,.27,.045,.28,0,time*.25,s*Math.sin(time*10+p.phase)*.95);}}
    if(birds.visible)for(let i=0;i<birds.count/2;i++){const p=seeds[i],x=((time*(.6+i*.05)+i*11)%100)-50,y=13+Math.sin(time*.3+i)*.6+i*.3,z=-55+i*3;for(let side=0;side<2;side++){const s=side?1:-1;write(birds,i*2+side,x+s*.32,y,z,.7,.08,.2,0,0,s*(.3+Math.sin(time*3+i)*.3));}}
    if(tumble.visible)for(let i=0;i<tumble.count/twigCount;i++){
      const speed=1.4+i*.22,travel=time*speed+i*35,z=travel%135-75,x=(i%2?-1:1)*(15+i*8);
      roll.setFromAxisAngle(axis,travel/.54);
      for(let j=0;j<twigCount;j++){
        const twig=twigs[j];center.copy(twig.center).applyQuaternion(roll);direction.copy(twig.direction).applyQuaternion(roll);
        dummy.position.set(x+center.x,.29+center.y+Math.abs(Math.sin(travel*1.9))*.035,z+center.z);
        dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(.065,twig.length,.065);dummy.updateMatrix();tumble.setMatrixAt(i*twigCount+j,dummy.matrix);
      }
    }
    if(patches.visible)for(let i=0;i<patches.count;i++){const p=seeds[i],s=.8+Math.sin(time*.32+p.phase)*.2;write(patches,i,p.x+Math.sin(time*.17+p.phase)*.6,-.278,p.z,1.8*s,.008,.8*s,0,p.phase+Math.sin(time*.2)*.15,0);}
    for(const mesh of [wings,birds,tumble,patches])if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;
  }
  return {animate,setPalette(b,mix){biome=b;night=mix;configure();},setActivity(value){activity=value;configure();},setQuality(value){quality=value;configure();}};
}
