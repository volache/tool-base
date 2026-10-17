// The snow shares the terrain belt: props and tracks keep the original running axis.
export function createSnowWorld(THREE,{scene,belt,chunks,cube,batch,random,trunkMaterial}){
  const snowMaterial=new THREE.MeshStandardMaterial({color:'#f0f7fa',roughness:.94});
  const pineMaterial=new THREE.MeshStandardMaterial({color:'#50776f',roughness:.88});
  const trackMaterial=new THREE.MeshBasicMaterial({color:'#a1bbcb',transparent:true,opacity:.58,depthWrite:false});
  const trees=[];
  for(const {group} of chunks){
    const grove=new THREE.Group();group.add(grove);trees.push(grove);
    const trunks=[],branches=[],caps=[];
    for(let i=0;i<4;i++){
      const x=(i%2?-1:1)*(12+random()*34),z=(random()-.5)*13,size=.7+random()*.48;
      trunks.push([x,.3,z,.34*size,1.35*size,.34*size]);
      for(let tier=0;tier<4;tier++){
        const width=(2.7-tier*.59)*size,y=-.3+(1.05+tier*.65)*size;
        branches.push([x,y,z,width,.67*size,width*.88]);
        caps.push([x-.07*size,y+.37*size,z,width*1.03,.16*size,width*.91]);
      }
      caps.push([x+1.4*size,-.16,z+.8,1.7*size,.3*size,1.1*size]);
    }
    batch(grove,cube,trunkMaterial,trunks,false);
    batch(grove,cube,pineMaterial,branches,false);
    batch(grove,cube,snowMaterial,caps,false);
  }
  const flakesMaterial=new THREE.MeshBasicMaterial({color:'#f0fbff',transparent:true,opacity:.72,depthWrite:false});
  const flakes=new THREE.InstancedMesh(cube,flakesMaterial,260);flakes.frustumCulled=false;scene.add(flakes);
  flakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const seeds=Array.from({length:260},()=>({x:(random()-.5)*108,y:random()*32,z:-75+random()*97,size:.025+random()*.035,speed:.7+random()*.65}));
  const tracks=new THREE.InstancedMesh(cube,trackMaterial,54);tracks.frustumCulled=false;belt.add(tracks);
  tracks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const prints=Array.from({length:18},()=>({born:-100,side:1}));
  const transform=new THREE.Object3D();let lastPrint=-100,nextPrint=0,enabled=false;
  // A quiet ribbon over the distant horizon gives the snowy night its own identity.
  const auroraUniforms={time:{value:0},strength:{value:0}};
  const auroraMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:auroraUniforms,
    vertexShader:`varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.06+time*.08)*2.8+sin(p.x*.13-time*.04)*.8;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float strength;uniform float time;void main(){float edge=sin(vUv.x*3.14159);float curtain=pow(sin(vUv.y*3.14159),2.);float streak=.6+.4*sin(vUv.x*90.+time*.12);vec3 c=mix(vec3(.22,.7,.55),vec3(.34,.48,.85),vUv.y);gl_FragColor=vec4(c,edge*curtain*streak*strength*.16);}`});
  const aurora=new THREE.Mesh(new THREE.PlaneGeometry(115,11,90,8),auroraMaterial);aurora.position.set(9,23,-88);aurora.frustumCulled=false;scene.add(aurora);
  const daySnow=new THREE.Color('#f0f7fa'),nightSnow=new THREE.Color('#9cb6cb'),dayPine=new THREE.Color('#50776f'),nightPine=new THREE.Color('#324f62');
  function setQuality(quality){flakes.count=quality==='low'?90:quality==='high'?260:180;}
  function setPalette(active,night){
    if(active&&!enabled){prints.forEach(p=>p.born=-100);lastPrint=-100;}
    enabled=active;trees.forEach(g=>g.visible=active);flakes.visible=tracks.visible=active;aurora.visible=active&&night>.01;
    snowMaterial.color.copy(daySnow).lerp(nightSnow,night);pineMaterial.color.copy(dayPine).lerp(nightPine,night);
    auroraUniforms.strength.value=night;flakesMaterial.opacity=.6+night*.18;
  }
  function animate(time,grounded=true){
    if(!enabled)return;
    for(let i=0;i<flakes.count;i++){
      const p=seeds[i];transform.position.set(p.x+Math.sin(time*.13+i)*.7+Math.sin(time*.04)*1.5,32-((p.y+time*p.speed)%32),p.z);
      transform.rotation.set(time*.2+i,time*.13+i,0);transform.scale.setScalar(p.size);transform.updateMatrix();flakes.setMatrixAt(i,transform.matrix);
    }
    flakes.instanceMatrix.needsUpdate=true;
    if(time-lastPrint>.36){if(grounded){prints[nextPrint]={born:time,side:nextPrint%2?1:-1};nextPrint=(nextPrint+1)%prints.length;}lastPrint=time;}
    transform.rotation.set(0,0,0);
    for(let i=0;i<prints.length;i++){
      const age=time-prints[i].born,visible=age>=0&&age<6;
      for(let toe=0;toe<3;toe++){
        transform.position.set(prints[i].side*.36+(toe-1)*.13,-.285,1.05+age*2.65-(toe===1?.1:0));
        const fade=visible?Math.min(1,(6-age)*1.7):0;transform.scale.set(.105*fade,.008,.29*fade);transform.updateMatrix();tracks.setMatrixAt(i*3+toe,transform.matrix);
      }
    }
    tracks.instanceMatrix.needsUpdate=true;auroraUniforms.time.value=time;
  }
  return {setPalette,setQuality,animate};
}
