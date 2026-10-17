// Batched woodland props ride the same belt as the other environments.
export function createForestWorld(THREE,{scene,chunks,cube,batch,random}){
  const colors={bark:['#8c7354','#7c8078'],leaf:['#497451','#4a6669'],crown:['#719463','#65807a'],fern:['#8aa46b','#6d8077'],litter:['#ba955f','#807a67'],cap:['#bc7964','#987d80']};
  const materials={},day={},night={};
  for(const [key,pair] of Object.entries(colors)){
    day[key]=new THREE.Color(pair[0]);night[key]=new THREE.Color(pair[1]);
    materials[key]=new THREE.MeshStandardMaterial({color:pair[0],roughness:.88});
  }
  const groves=[];
  for(const {group} of chunks){
    const grove=new THREE.Group();group.add(grove);groves.push(grove);
    const bark=[],leaves=[],crowns=[],ferns=[],litter=[],caps=[];
    for(let i=0;i<18;i++){
      const row=Math.floor(i/6),column=Math.floor((i%6)/2);
      const x=(i%2?-1:1)*(11+column*12+(row%2)*2+random()*9),z=-5+row*5+(random()-.5)*4.5,s=.7+random()*.35,h=(2.7+random()*.9)*s;
      bark.push([x,h/2-.3,z,.5*s,h,.55*s],[x+.65*s,h*.65,z,1.55*s,.3*s,.35*s]);
      // Offset crowns give each toy tree a broad, irregular silhouette.
      leaves.push([x,h-.1,z,2.9*s,1.1*s,2.5*s],[x-.75*s,h+.55*s,z+.1,2.35*s,.9*s,2.1*s],[x+1.05*s,h+.3*s,z-.2,1.95*s,.85*s,2*s]);
      crowns.push([x-.25*s,h+1.08*s,z-.15,2.05*s,.65*s,1.8*s],[x+.65*s,h+.85*s,z+.2,1.35*s,.65*s,1.4*s]);
      // A few short studs on top retain the construction-toy character.
      crowns.push([x-.6*s,h+1.45*s,z,.22*s,.12*s,.22*s],[x+.05*s,h+1.45*s,z,.22*s,.12*s,.22*s]);
    }
    for(let i=0;i<22;i++){
      const x=(i%2?-1:1)*(8.5+random()*38),z=(random()-.5)*14;
      const s=.65+random()*.5;
      ferns.push([x,.03,z,1.1*s,.18,.26*s],[x,.1,z,.27*s,.28,.92*s],[x-.28,.02,z+.3,.6*s,.13,.25*s]);
      litter.push([x+.65,-.265,z+.6,.22,.05,.36]);
      if(i%6===0){bark.push([x+.6,.04,z-.3,.14,.65,.14]);caps.push([x+.6,.38,z-.3,.55,.19,.5]);crowns.push([x+.54,.49,z-.34,.09,.03,.09]);}
      if(i%10===0)bark.push([x+1.1,-.02,z+.9,2.15,.52,.6]);
    }
    for(const [mat,positions] of [[materials.bark,bark],[materials.leaf,leaves],[materials.crown,crowns],[materials.fern,ferns],[materials.litter,litter],[materials.cap,caps]])batch(grove,cube,mat,positions,false);
  }
  const leafMaterial=new THREE.MeshStandardMaterial({color:'#c8a96d',roughness:.9,transparent:true,opacity:.7});
  const driftingLeaves=new THREE.InstancedMesh(cube,leafMaterial,28);driftingLeaves.frustumCulled=false;scene.add(driftingLeaves);
  driftingLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const leafSeeds=Array.from({length:28},()=>({x:(random()-.5)*90,z:-55+random()*70,offset:random()*15,speed:.25+random()*.3}));
  const flySeeds=Array.from({length:48},()=>({x:(random()-.5)*85,z:-48+random()*60,y:.5+random()*2.3,phase:random()*6.28}));
  const flyGeometry=new THREE.BufferGeometry();flyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(48*3),3));
  flyGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(flySeeds.map(p=>p.phase),1));
  const uniforms={time:{value:0},strength:{value:0}};
  const flyMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,toneMapped:false,
    vertexShader:`attribute float phase;varying float vGlow;uniform float time;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vGlow=.35+.65*pow(.5+.5*sin(time*1.35+phase),2.);gl_PointSize=clamp(105./-mv.z,3.,9.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vGlow;uniform float strength;void main(){vec2 p=abs(gl_PointCoord-.5);float r=max(p.x,p.y);float glow=1.-smoothstep(.16,.48,r);gl_FragColor=vec4(1.,.88,.42,glow*vGlow*strength*.85);}`});
  const flies=new THREE.Points(flyGeometry,flyMaterial);flies.frustumCulled=false;scene.add(flies);
  const transform=new THREE.Object3D();let enabled=false,quality='balanced',activity=1;
  function setQuality(q){quality=q;driftingLeaves.count=Math.round((q==='low'?10:28)*Math.min(1,activity/1.5));flyGeometry.setDrawRange(0,Math.round((q==='low'?18:48)*Math.min(1,activity/1.5)));}
  const canopyTime={value:0};
  for(const key of ['leaf','crown']){materials[key].onBeforeCompile=shader=>{shader.uniforms.canopyTime=canopyTime;shader.vertexShader='uniform float canopyTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(canopyTime*.55+instanceMatrix[3].x*.5)*.035;');};materials[key].customProgramCacheKey=()=>`forest-canopy-${key}-v1`;}
  function setPalette(active,mix){
    enabled=active;groves.forEach(g=>g.visible=active);driftingLeaves.visible=active;flies.visible=active&&mix>.02;
    for(const key of Object.keys(materials))materials[key].color.copy(day[key]).lerp(night[key],mix);
    uniforms.strength.value=mix;leafMaterial.opacity=.68-mix*.38;
  }
  function animate(time){
    if(!enabled)return;
    canopyTime.value=time*activity;
    for(let i=0;i<driftingLeaves.count;i++){
      const p=leafSeeds[i];transform.position.set(p.x+Math.sin(time*.35+i)*1.1,15-(p.offset+time*p.speed)%15,p.z+Math.sin(time*.2+i)*.8);
      transform.rotation.set(time*.55+i,time*.3+i,Math.sin(time*.6+i)*.8);transform.scale.set(.16,.025,.24);transform.updateMatrix();driftingLeaves.setMatrixAt(i,transform.matrix);
    }
    driftingLeaves.instanceMatrix.needsUpdate=true;
    const positions=flyGeometry.attributes.position;
    for(let i=0;i<flySeeds.length;i++){const p=flySeeds[i];positions.setXYZ(i,p.x+Math.sin(time*.35+p.phase)*.7,p.y+Math.sin(time*.6+p.phase)*.3,p.z+Math.cos(time*.25+p.phase)*.6);}
    positions.needsUpdate=true;uniforms.time.value=time;
  }
  return {setPalette,setQuality,animate,setActivity(value){activity=value;setQuality(quality);}};
}
