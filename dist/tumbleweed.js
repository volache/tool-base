// Forked dry stems, rather than closed rings or a radial cage.
export function createTumbleweeds(THREE,{belt,cube,groundSpeed=2.65}){
  let seed=19027;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const randomDirection=()=>{const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);};
  const twigs=[];
  function grow(start,direction,length,depth){
    const end=start.clone().addScaledVector(direction,length),width=.022+depth*.008;
    twigs.push({center:start.clone().add(end).multiplyScalar(.5),direction:direction.clone(),length:length+.012,width});
    if(!depth)return;
    for(let fork=0;fork<2;fork++){
      const next=direction.clone().multiplyScalar(.7).addScaledVector(randomDirection(),.85).normalize();
      grow(end,next,length*(.75+random()*.16),depth-1);
    }
  }
  for(let i=0;i<15;i++)grow(randomDirection().multiplyScalar(random()*.07),randomDirection(),.16+random()*.055,3);
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1});
  const mesh=new THREE.InstancedMesh(cube,material,twigs.length*3);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;belt.add(mesh);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette=['#a58049','#be9a5e','#d6b67d','#c8a267','#dfc38b'];
  for(let i=0;i<mesh.instanceMatrix.count;i++)mesh.setColorAt(i,new THREE.Color(palette[Math.floor(random()*palette.length)]));
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(),roll=new THREE.Quaternion();
  for(const twig of twigs)twig.orientation=new THREE.Quaternion().setFromUnitVectors(up,twig.direction);
  const centers=twigs.map(()=>new THREE.Vector3()),directions=twigs.map(()=>new THREE.Vector3());
  let count=2;mesh.count=count*twigs.length;
  // Wind pushes the weeds forward: the extra travel is integrated so a gust never makes them jump.
  let wind=0,windTime=0,lastTime=0;
  function animate(time){
    windTime+=Math.max(0,time-lastTime)*wind*1.6;lastTime=time;const shifted=time+windTime;
    for(let i=0;i<count;i++){
      const scale=[1,.82,.92][i],radius=.5*scale,speed=1.05+i*.17,travel=shifted*speed+i*45+60,z=travel%135-75;
      const x=(i%2?-1:1)*(15+i*8);
      // The terrain belt moves too: rolling is relative to that ground, not the camera.
      axis.set(1,0,0);roll.setFromAxisAngle(axis,(shifted*speed-time*groundSpeed)/radius+i*1.7);
      let bottom=Infinity;
      for(let j=0;j<twigs.length;j++){
        const twig=twigs[j],c=centers[j].copy(twig.center).applyQuaternion(roll).multiplyScalar(scale),d=directions[j].copy(twig.direction).applyQuaternion(roll);
        bottom=Math.min(bottom,c.y-Math.abs(d.y)*twig.length*scale*.5-twig.width*scale*.72);
      }
      for(let j=0;j<twigs.length;j++){
        const twig=twigs[j],c=centers[j];dummy.position.set(x+c.x,-.3-bottom+c.y,z+c.z);dummy.quaternion.copy(roll).multiply(twig.orientation);dummy.scale.set(twig.width*scale,twig.length*scale,twig.width*scale);dummy.updateMatrix();mesh.setMatrixAt(i*twigs.length+j,dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,animate,setWind(value){wind=value;},setCount(value){count=Math.min(3,Math.max(1,value));mesh.count=count*twigs.length;}};
}
