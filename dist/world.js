import * as THREE from './vendor/three.module.min.js';

// Everything in this scene is real geometry. No generated image is used as the background.
// Instancing keeps the many brick studs and terrain pieces in a small number of draw calls.
export async function createWorld(container,options={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(37,1,.1,190);
  camera.position.set(0,9,28);camera.lookAt(0,5,-12);
  scene.background=new THREE.Color('#d4e8f0');
  scene.fog=new THREE.Fog('#d4e8f0',38,115);
  const hemi=new THREE.HemisphereLight('#f2faff','#b5ad8c',2.2);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff5dc',2.8);sun.position.set(-18,34,20);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-28;sun.shadow.camera.far=100;sun.shadow.normalBias=.08;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
  let quality=options.quality||'balanced';
  let paused=!!options.paused;
  let biome=options.biome||'grass';
  let targetBiome=biome==='desert'?1:0;
  let mix=targetBiome;
  let elapsed=0;
  let night=!!options.night;
  const palettes={
    grass:{sky:'#cee5f1',ground:'#8aa968',brick:'#a8bd7c',stud:'#b4c487',hill:'#8ba991',hilltop:'#b3c5a0',path:'#d9cfac',rock:'#aab0a4',tree:'#527f58',trunk:'#c0a070',flower:'#f0a071'},
    desert:{sky:'#e8e5d9',ground:'#dbb27c',brick:'#ecc58d',stud:'#efd4a5',hill:'#c49771',hilltop:'#e2bd8c',path:'#e5c694',rock:'#b9a58d',tree:'#88a16d',trunk:'#b9956f',flower:'#d8a26e'}
  };
  const materials={};
  for(const key of Object.keys(palettes.grass)){
    if(key==='sky')continue;
    materials[key]=new THREE.MeshStandardMaterial({color:palettes[biome][key],roughness:.83,metalness:0});
  }
  const dark=new THREE.MeshStandardMaterial({color:'#535d60',roughness:.65});
  const darkSide=new THREE.MeshStandardMaterial({color:'#657173',roughness:.7});
  const eyeWhite=new THREE.MeshStandardMaterial({color:'#faf6df',roughness:.7});
  const eyeBlack=new THREE.MeshStandardMaterial({color:'#26343b',roughness:.7});
  const whiteMat=new THREE.MeshStandardMaterial({color:'#fff9e8',roughness:.92});
  const cube=new THREE.BoxGeometry(1,1,1);
  const brickProfile=new THREE.Shape();
  brickProfile.moveTo(-.47,-.47);brickProfile.lineTo(.47,-.47);brickProfile.lineTo(.47,.47);brickProfile.lineTo(-.47,.47);brickProfile.closePath();
  const bevelBrick=new THREE.ExtrudeGeometry(brickProfile,{depth:.94,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:2,steps:1});
  bevelBrick.translate(0,0,-.47);
  const cylinder=new THREE.CylinderGeometry(.15,.15,.12,8,1);
  function box(parent,x,y,z,sx,sy,sz,mat,shadow=true){const obj=new THREE.Mesh(mat===dark||mat===darkSide?bevelBrick:cube,mat);obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.castShadow=shadow;obj.receiveShadow=shadow;parent.add(obj);return obj;}
  function batch(parent,geometry,mat,positions,shadow=false){
    const mesh=new THREE.InstancedMesh(geometry,mat,positions.length);const matrix=new THREE.Matrix4();const dummy=new THREE.Object3D();
    positions.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.scale.set(p[3]??1,p[4]??1,p[5]??1);dummy.rotation.set(0,p[6]??0,0);dummy.updateMatrix();matrix.copy(dummy.matrix);mesh.setMatrixAt(i,matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);return mesh;
  }
  const terrain=new THREE.Group();scene.add(terrain);
  box(terrain,0,-.72,-35,190,.8,215,materials.ground,false).receiveShadow=true;
  let seed=87124;
  function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  // Open horizon: no stacked mountain boxes behind the launcher.
  // One continuous, bevelled silhouette per cloud gives it a soft toy-like outline.
  const cloudGroup=new THREE.Group();scene.add(cloudGroup);
  const cloudShape=new THREE.Shape();
  cloudShape.moveTo(-3,0);cloudShape.bezierCurveTo(-4.3,0,-4.4,1.8,-2.9,2);
  cloudShape.bezierCurveTo(-2.7,3.6,-.6,3.8,0,2.6);cloudShape.bezierCurveTo(1.2,3.2,2.5,2.5,2.4,1.7);
  cloudShape.bezierCurveTo(4.2,1.8,4.3,0,2.7,0);cloudShape.closePath();
  const cloudGeometry=new THREE.ExtrudeGeometry(cloudShape,{depth:.65,bevelEnabled:true,bevelThickness:.22,bevelSize:.22,bevelSegments:3,curveSegments:12});
  for(const [x,y,z,s] of [[-24,14,-38,.72],[26,17,-54,.9],[-40,18,-85,.65],[46,15,-74,.72]]){
    const cloud=new THREE.Mesh(cloudGeometry,whiteMat);cloud.position.set(x,y,z);cloud.scale.setScalar(s);cloudGroup.add(cloud);
  }
  const nightSky=new THREE.Group();scene.add(nightSky);
  const moonMaterial=new THREE.MeshBasicMaterial({color:'#fff3ce',fog:false,toneMapped:false});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(1.35,24,16),moonMaterial);moon.position.set(23,18,-48);nightSky.add(moon);
  const starPositions=[];
  for(let i=0;i<85;i++)starPositions.push((random()-.5)*150,12+random()*42,-60-random()*45);
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  nightSky.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#fff5df',size:.24,sizeAttenuation:true,fog:false,toneMapped:false})));
  // A rotated, endless belt. A reserved central lane keeps scenery from intersecting the dinosaur.
  const belt=new THREE.Group();belt.rotation.y=Math.PI/4;scene.add(belt);
  const chunks=[];const chunkLength=15;const chunkCount=9;
  const lowDetails=[];
  function addTree(parent,x,z,size=1){
    const g=new THREE.Group();g.position.set(x,-.3,z);g.scale.setScalar(size);parent.add(g);
    box(g,0,.7,0,.48,1.5,.48,materials.trunk);
    box(g,0,1.8,0,2.05,.8,1.8,materials.tree);
    box(g,-.15,2.4,0,1.55,.55,1.35,materials.tree);
    box(g,.15,2.82,.1,.88,.35,.8,materials.tree);return g;
  }
  function addCactus(parent,x,z,size=1){
    const g=new THREE.Group();g.position.set(x,-.3,z);g.scale.setScalar(size);parent.add(g);
    box(g,0,1.1,0,.48,2.25,.5,materials.tree);box(g,-.57,1.0,0,.72,.4,.4,materials.tree);box(g,-.74,1.42,0,.38,1.15,.4,materials.tree);box(g,.52,1.5,0,.65,.4,.42,materials.tree);box(g,.7,1.9,0,.35,1,.4,materials.tree);return g;
  }
  for(let c=0;c<chunkCount;c++){
    const group=new THREE.Group();group.position.z=(c-5)*chunkLength;belt.add(group);
    const plates=[],pathPlates=[],studs=[],pebbles=[],sprouts=[],flowers=[];
    for(let j=0;j<90;j++){
      const x=(random()-.5)*115;const z=(random()-.5)*chunkLength;const sy=.16+random()*.22;
      const target=Math.abs(x)<7.2?pathPlates:plates;
      const inLane=Math.abs(x)<7.2;
      target.push([x,inLane?-.37:-.28+sy/2,z,.9+random()*.9,inLane?.14:sy,inLane?1.45:1.05+random()*.75]);
      if(Math.abs(x)>7.2&&j%2===0)pebbles.push([x+.3,.05,z,.35+random()*.5,.22+random()*.4,.35+random()*.5]);
      if(Math.abs(x)>7.2&&j%3===0)sprouts.push([x-.4,.13,z,.13,.6,.14]);
      if(Math.abs(x)>7.2&&j%5===0)flowers.push([x+.18,.25,z-.12,.18,.25,.18]);
    }
    for(let j=0;j<170;j++){const x=(random()-.5)*110;const z=(random()-.5)*chunkLength;if(Math.abs(x)>7.2)studs.push([x,-.22,z,.85,1,.85]);}
    batch(group,cube,materials.brick,plates,false);
    batch(group,cube,materials.path,pathPlates,false);
    lowDetails.push(batch(group,cylinder,materials.stud,studs,false));
    batch(group,cube,materials.rock,pebbles,false);
    const plants=batch(group,cube,materials.tree,sprouts,false);
    const flowerBed=batch(group,cube,materials.flower,flowers,false);
    const trees=new THREE.Group(),cacti=new THREE.Group();group.add(trees,cacti);
    for(let j=0;j<3;j++){
      const x=(j%2?-1:1)*(13+random()*30);const z=(random()-.5)*chunkLength;
      addTree(trees,x,z,.65+random()*.4);addCactus(cacti,x+.7,z,.65+random()*.5);
    }
    chunks.push({group,trees,cacti,plants,flowerBed});
  }
  // Original 45 degree heading, toward the upper-left of the scene.
  const dinoAnchor=new THREE.Group();scene.add(dinoAnchor);
  const dino=new THREE.Group();dino.rotation.y=Math.PI/4;dinoAnchor.add(dino);
  const torso=new THREE.Group();dino.add(torso);
  box(torso,0,1.6,.15,.95,1.35,1.17,dark);
  box(torso,0,2.15,-.25,.82,1.15,.77,darkSide);
  box(torso,0,2.92,-.76,1.18,.92,1.38,dark);
  box(torso,0,2.68,-1.43,1.14,.37,.57,dark);
  box(torso,0,2.35,-1.12,.93,.20,1.06,darkSide);
  // A front eye pair and contrasting snout make the direction legible from the portal camera.
  for(const side of [-1,1]){
    box(torso,side*.597,3.07,-.7,.025,.29,.3,eyeWhite,false);
    box(torso,side*.615,3.08,-.77,.025,.14,.14,eyeBlack,false);
    box(torso,side*.56,2.62,-1.4,.025,.075,.19,eyeBlack,false);
  }
  for(let i=0;i<3;i++)box(torso,0,2.48,-1.37+i*.19,.95,.07,.085,eyeWhite,false);
  // Small inset panels, nostrils, belly plates and toe claws add construction detail.
  const belly=new THREE.MeshStandardMaterial({color:'#9aab9c',roughness:.46});
  for(let i=0;i<4;i++)box(torso,0,1.3+i*.22,-.453,.58,.18,.035,belly);
  for(const side of [-1,1]){
    box(torso,side*.584,2.83,-1.3,.018,.08,.11,eyeBlack,false);
    for(let i=0;i<3;i++)box(torso,side*.482,1.25+i*.28,.22,.022,.018,.65,darkSide,false);
  }
  dark.roughness=.38;darkSide.roughness=.43;
  const tail=new THREE.Group();tail.position.set(0,1.45,.5);torso.add(tail);
  box(tail,0,.02,.5,.77,.64,1.15,dark);box(tail,0,.20,1.33,.55,.46,.72,darkSide);box(tail,0,.43,1.83,.36,.36,.5,dark);box(tail,0,.65,2.13,.28,.38,.32,dark);
  const arms=[];
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.57,1.93,-.33);torso.add(arm);box(arm,0,-.25,-.1,.23,.55,.28,darkSide);box(arm,0,-.42,-.35,.23,.22,.42,dark);arms.push(arm);}
  const legs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.43,1.05,.25);dino.add(leg);
    box(leg,0,-.25,.05,.44,.7,.55,darkSide);box(leg,0,-.66,-.06,.35,.48,.36,dark);box(leg,0,-.90,-.28,.45,.24,.86,dark);legs.push(leg);
    for(const toe of [-.13,0,.13])box(leg,toe,-.86,-.72,.085,.1,.17,eyeWhite,false);
  }
  const backStuds=[];
  for(let i=0;i<4;i++)backStuds.push([0,2.37,.05+i*.24,.75,1,.75]);
  batch(torso,cylinder,darkSide,backStuds,true);
  for(const x of [-.32,.32]){const stud=new THREE.Mesh(cylinder,darkSide);stud.position.set(x,3.43,-.75);torso.add(stud);}
  // Subtle grounding shadow also survives the lightweight, shadow-map-free mode.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64;
  const ctx=shadowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,3,32,32,30);gradient.addColorStop(0,'rgba(50,55,43,.3)');gradient.addColorStop(1,'rgba(50,55,43,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(4.2,4.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=-.28;dinoAnchor.add(contactShadow);
  const dustGroup=new THREE.Group();dino.add(dustGroup);const dust=[];
  for(let i=0;i<6;i++)dust.push(box(dustGroup,0,0,0,.15,.15,.15,materials.path,false));

  // Render small 3D tool icons once, then reuse them as ordinary accessible images.
  const icons=makeIcons(renderer);
  let w=1,h=1;
  const raycaster=new THREE.Raycaster();const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),.3);const anchorPoint=new THREE.Vector3();
  function resize(){
    w=container.clientWidth;h=container.clientHeight;
    camera.aspect=w/h;camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==='high'?1.8:quality==='low'?1:1.35));
    renderer.setSize(w,h,false);
    const mobile=w<650;
    raycaster.setFromCamera(new THREE.Vector2(mobile?.58:.68,mobile?-.82:-.67),camera);
    raycaster.ray.intersectPlane(groundPlane,anchorPoint);
    dinoAnchor.position.copy(anchorPoint);dinoAnchor.position.y=-.3;
    // Align the reserved local-X lane with the actual responsive dinosaur anchor.
    belt.position.set(anchorPoint.x,0,anchorPoint.z);
    dinoAnchor.scale.setScalar(Math.min(.95,w/h*.62));
    render();
  }
  function setQuality(q){
    quality=q;renderer.shadowMap.enabled=q!=='low';lowDetails.forEach(m=>m.visible=q!=='low');
    sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);
    if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    renderer.shadowMap.needsUpdate=true;resize();
  }
  function setPaused(p){paused=p;last=performance.now();lastReport=last;frames=0;if(!p)requestTick();else{render();report(true);}}
  function setBiome(b){biome=b;targetBiome=b==='desert'?1:0;if(paused){mix=targetBiome;updatePalette();render();}else requestTick();}
  function setNight(value){night=value;updatePalette();render();}
  const colorA=new THREE.Color(),colorB=new THREE.Color();
  function updatePalette(){
    for(const [key,mat] of Object.entries(materials)){colorA.set(palettes.grass[key]);colorB.set(palettes.desert[key]);mat.color.copy(colorA).lerp(colorB,mix);}
    colorA.set(palettes.grass.sky);colorB.set(palettes.desert.sky);scene.background.copy(colorA).lerp(colorB,mix);scene.fog.color.copy(scene.background);
    nightSky.visible=night;cloudGroup.visible=!night;
    if(night){
      scene.background.set('#101c35');scene.fog.color.set('#101c35');
      hemi.color.set('#a9c9ff');hemi.groundColor.set('#384252');hemi.intensity=1.35;
      sun.color.set('#adcaff');sun.intensity=1.55;renderer.toneMappingExposure=.95;
      dark.color.set('#7d939e');darkSide.color.set('#94a9b1');
      for(const mat of Object.values(materials))mat.color.multiplyScalar(.68);
    }else{
      hemi.color.set('#f2faff');hemi.groundColor.set('#b5ad8c');hemi.intensity=2.2;
      sun.color.set('#fff5dc');sun.intensity=2.8;renderer.toneMappingExposure=1.02;
      dark.color.set('#535d60');darkSide.color.set('#657173');
    }
    chunks.forEach(({trees,cacti,plants,flowerBed})=>{trees.visible=mix<.55;cacti.visible=mix>=.55;plants.visible=mix<.55;flowerBed.visible=mix<.55;});
  }
  function animate(delta){
    elapsed+=delta;
    const speed=2.65;
    for(const {group} of chunks){group.position.z+=delta*speed;if(group.position.z>60)group.position.z-=chunkCount*chunkLength;}
    const phase=elapsed*8.8;
    torso.position.y=Math.abs(Math.sin(phase))*.07;
    torso.rotation.x=Math.sin(phase*2)*.014;
    legs[0].rotation.x=Math.sin(phase)*.67;legs[1].rotation.x=-Math.sin(phase)*.67;
    arms[0].rotation.x=-Math.sin(phase)*.2;arms[1].rotation.x=Math.sin(phase)*.2;
    tail.rotation.y=Math.sin(phase*.5)*.09;
    cloudGroup.position.x=Math.sin(elapsed*.025)*2;
    dust.forEach((p,i)=>{const t=((elapsed*1.3+i/6)%1);p.position.set((i%2-.5)*.75,.08+t*.38,.9+t*2.5);p.scale.setScalar(.08+(1-t)*.14);p.rotation.set(t*2,t*3,t);p.visible=t<.9;});
    if(Math.abs(mix-targetBiome)>.002){mix=THREE.MathUtils.damp(mix,targetBiome,2.2,delta);updatePalette();}
  }
  let last=performance.now(),lastReport=last,frames=0,raf=0;
  function render(){renderer.render(scene,camera);}
  function report(force=false){const now=performance.now();if(now-lastReport>1200||force){const interval=(now-lastReport)/1000;options.onStats?.({fps:paused?0:Math.round(frames/Math.max(interval,.01)),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,interval});lastReport=now;frames=0;}}
  function tick(now){raf=0;if(document.hidden||paused)return;const delta=Math.min((now-last)/1000,.05);last=now;animate(delta);render();frames++;report();requestTick();}
  function requestTick(){if(!raf&&!paused&&!document.hidden)raf=requestAnimationFrame(tick);}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{last=performance.now();lastReport=last;frames=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{render();requestTick();}});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;document.querySelector('#render-status').textContent='3D 畫面暫時中斷；工具入口仍可使用。';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{last=performance.now();document.querySelector('#render-status').textContent='3D 世界已恢復';render();requestTick();});
  updatePalette();resize();setQuality(quality);report(true);requestTick();
  return {icons,setPaused,setBiome,setQuality,setNight};

  function makeIcons(sharedRenderer){
    const result={};const iconScene=new THREE.Scene();
    iconScene.add(new THREE.HemisphereLight('#ffffff','#9a9a9a',3));
    const key=new THREE.DirectionalLight('#fff8ee',4.2);key.position.set(-4,7,8);iconScene.add(key);
    const cam=new THREE.OrthographicCamera(-2,2,2,-2,.1,50);cam.position.set(4.3,3.4,6);cam.lookAt(0,0,0);
    const target=new THREE.WebGLRenderTarget(240,240,{format:THREE.RGBAFormat});target.texture.colorSpace=THREE.SRGBColorSpace;
    const colors={chart:'#368dda',document:'#a48acb',board:'#69b39b',calendar:'#f0a15c',search:'#4ca9b8',form:'#d8887d'};
    const pixelBuffer=new Uint8Array(240*240*4);
    for(const [kind,color] of Object.entries(colors)){
      const g=new THREE.Group();iconScene.add(g);const mat=new THREE.MeshStandardMaterial({color,roughness:.5});
      const face=new THREE.MeshStandardMaterial({color:'#f7f1df',roughness:.8});
      const darker=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.65),roughness:.6});
      const add=(x,y,z,sx,sy,sz,m=mat)=>box(g,x,y,z,sx,sy,sz,m,false);
      const stud=(x,y,z,s=1)=>{const m=new THREE.Mesh(cylinder,mat);m.position.set(x,y,z);m.scale.setScalar(s);g.add(m);};
      if(kind==='chart'){
        for(let i=0;i<3;i++){const hh=.8+i*.65;add((i-1)*.76,hh/2-.9,0,.6,hh,.73);stud((i-1)*.76,hh-.84,0,1.15);}
      }else if(kind==='document'){
        add(-.43,.2,-.12,1.42,2.25,.38);add(.58,-.32,.27,1.1,1.7,.4);
        for(let i=0;i<3;i++)add(-.44,.8-i*.42,.09,.87,.12,.07,darker);
        for(let i=0;i<2;i++)add(.6,-.12-i*.4,.5,.65,.12,.07,face);
        stud(-.7,1.38,-.12,.75);stud(-.12,1.38,-.12,.75);
      }else if(kind==='board'){
        add(0,0,0,2.6,2.25,.4);
        for(let x=0;x<2;x++)for(let y=0;y<2;y++)add(-.58+x*1.15,.52-y*.95,.29,.87,.71,.18,(x+y)%2===0?face:darker);
        stud(-.72,1.18,0,1);stud(.72,1.18,0,1);
      }else if(kind==='calendar'){
        add(0,-.1,0,2.2,2.1,.45,face);add(0,.8,.06,2.2,.48,.57);
        for(let i=0;i<2;i++){add(-.55+i*1.1,1.16,0,.16,.45,.2,darker);}
        for(let x=0;x<3;x++)for(let y=0;y<2;y++)add(-.65+x*.65,.24-y*.55,.26,.3,.3,.06);
      }else if(kind==='search'){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.23,4,16),mat);ring.position.set(-.25,.25,0);g.add(ring);
        const handle=add(.75,-.85,0,.44,1.1,.43,darker);handle.rotation.z=.65;
      }else{
        add(0,0,0,1.95,2.4,.45);for(let i=0;i<3;i++)add(0,.7-i*.55,.27,1.15,.14,.09,face);
        add(.75,-.75,.42,.74,.67,.55,darker);stud(-.45,1.28,0,.8);stud(.45,1.28,0,.8);
      }
      sharedRenderer.setRenderTarget(target);sharedRenderer.setClearColor(0x000000,0);sharedRenderer.render(iconScene,cam);sharedRenderer.readRenderTargetPixels(target,0,0,240,240,pixelBuffer);
      const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;const context=canvas.getContext('2d');const data=context.createImageData(240,240);
      for(let y=0;y<240;y++)data.data.set(pixelBuffer.subarray((239-y)*240*4,(240-y)*240*4),y*240*4);
      context.putImageData(data,0,0);result[kind]=canvas.toDataURL('image/png');
      iconScene.remove(g);g.traverse(obj=>{if(obj.isMesh&&obj.geometry!==cube&&obj.geometry!==cylinder)obj.geometry.dispose();});mat.dispose();face.dispose();darker.dispose();
    }
    sharedRenderer.setRenderTarget(null);target.dispose();return result;
  }
}
