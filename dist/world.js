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
  const palettes={
    grass:{sky:'#cee5f1',ground:'#8aa968',brick:'#a8bd7c',stud:'#b4c487',hill:'#8ba991',hilltop:'#b3c5a0',path:'#d9cfac',rock:'#aab0a4',tree:'#527f58',trunk:'#c0a070'},
    desert:{sky:'#e8e5d9',ground:'#dbb27c',brick:'#ecc58d',stud:'#efd4a5',hill:'#c49771',hilltop:'#e2bd8c',path:'#e5c694',rock:'#b9a58d',tree:'#88a16d',trunk:'#b9956f'}
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
  const cylinder=new THREE.CylinderGeometry(.15,.15,.12,8,1);
  function box(parent,x,y,z,sx,sy,sz,mat,shadow=true){const obj=new THREE.Mesh(cube,mat);obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.castShadow=shadow;obj.receiveShadow=shadow;parent.add(obj);return obj;}
  function batch(parent,geometry,mat,positions,shadow=false){
    const mesh=new THREE.InstancedMesh(geometry,mat,positions.length);const matrix=new THREE.Matrix4();const dummy=new THREE.Object3D();
    positions.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.scale.set(p[3]??1,p[4]??1,p[5]??1);dummy.rotation.set(0,p[6]??0,0);dummy.updateMatrix();matrix.copy(dummy.matrix);mesh.setMatrixAt(i,matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);return mesh;
  }
  const terrain=new THREE.Group();scene.add(terrain);
  box(terrain,0,-.72,-35,190,.8,215,materials.ground,false).receiveShadow=true;
  const hills=new THREE.Group();terrain.add(hills);
  let seed=87124;
  function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  // Terraced distant hills form a low, airy frame, keeping the portal's center quiet.
  const hillBlocks=[],hillCaps=[];
  for(let i=0;i<55;i++){
    const side=i%2===0?-1:1;const x=side*(15+random()*52);const z=-30-random()*62;const height=2+random()*8;const w=4+random()*7;const d=4+random()*8;
    for(let layer=0;layer<3;layer++){const k=1-layer*.21;hillBlocks.push([x,height*(layer/3)-.3,z,w*k,height/3,d*k]);}
    hillCaps.push([x,height-.1,z,w*.55,.35,d*.55]);
  }
  batch(hills,cube,materials.hill,hillBlocks,true);batch(hills,cube,materials.hilltop,hillCaps,true);
  // Slow independent cloud parallax.
  const cloudGroup=new THREE.Group();scene.add(cloudGroup);
  const cloudBlocks=[];
  for(const [x,y,z,s] of [[-19,13,-24,1.25],[23,15,-42,1.5],[-32,18,-64,1.5],[5,18,-81,1.1],[35,11,-18,.9]]){
    for(let j=0;j<9;j++)cloudBlocks.push([x+(j%3-1)*1.65*s,y+Math.floor(j/3)*.65*s,z+(random()-.5)*1.8,1.9*s,1.1*s,1.7*s]);
  }
  batch(cloudGroup,cube,whiteMat,cloudBlocks,false);
  // A rotated, endless belt: positive local Z is towards the dinosaur's rear (screen lower-right).
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
    const plates=[],studs=[],pebbles=[],sprouts=[];
    for(let j=0;j<90;j++){
      const x=(random()-.5)*115;const z=(random()-.5)*chunkLength;const sy=.16+random()*.22;
      plates.push([x,-.28+sy/2,z,.9+random()*.9,sy,.9+random()*.9]);
      if(j%2===0)pebbles.push([x+.3,.05,z,.35+random()*.5,.22+random()*.4,.35+random()*.5]);
      if(j%3===0)sprouts.push([x-.4,.13,z,.13,.6,.14]);
    }
    for(let j=0;j<170;j++){const x=(random()-.5)*110;const z=(random()-.5)*chunkLength;studs.push([x,-.22,z,.85,1,.85]);}
    batch(group,cube,materials.brick,plates,false);
    lowDetails.push(batch(group,cylinder,materials.stud,studs,false));
    batch(group,cube,materials.rock,pebbles,false);
    const plants=batch(group,cube,materials.tree,sprouts,false);
    const trees=new THREE.Group(),cacti=new THREE.Group();group.add(trees,cacti);
    for(let j=0;j<3;j++){
      const x=(j%2?-1:1)*(13+random()*30);const z=(random()-.5)*chunkLength;
      addTree(trees,x,z,.65+random()*.4);addCactus(cacti,x+.7,z,.65+random()*.5);
    }
    chunks.push({group,trees,cacti,plants});
  }
  // A simple brick-built T-Rex. Model faces local -Z, then turns 45° to the upper-left.
  const dinoAnchor=new THREE.Group();scene.add(dinoAnchor);
  const dino=new THREE.Group();dino.rotation.y=Math.PI/4;dinoAnchor.add(dino);
  const torso=new THREE.Group();dino.add(torso);
  box(torso,0,1.6,.15,.95,1.35,1.17,dark);
  box(torso,0,2.15,-.25,.82,1.15,.77,darkSide);
  box(torso,0,2.92,-.76,1.18,.92,1.38,dark);
  box(torso,0,2.68,-1.43,1.14,.37,.57,dark);
  box(torso,0,2.35,-1.12,.93,.20,1.06,darkSide);
  // Square eyes on both sides so the silhouette remains readable in three-quarter view.
  for(const side of [-1,1]){
    box(torso,side*.597,3.07,-.7,.025,.29,.3,eyeWhite,false);
    box(torso,side*.615,3.08,-.77,.025,.14,.14,eyeBlack,false);
    box(torso,side*.56,2.62,-1.4,.025,.075,.19,eyeBlack,false);
  }
  for(let i=0;i<3;i++)box(torso,0,2.48,-1.37+i*.19,.95,.07,.085,eyeWhite,false);
  const tail=new THREE.Group();tail.position.set(0,1.45,.5);torso.add(tail);
  box(tail,0,.02,.5,.77,.64,1.15,dark);box(tail,0,.20,1.33,.55,.46,.72,darkSide);box(tail,0,.43,1.83,.36,.36,.5,dark);box(tail,0,.65,2.13,.28,.38,.32,dark);
  const arms=[];
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.57,1.93,-.33);torso.add(arm);box(arm,0,-.25,-.1,.23,.55,.28,darkSide);box(arm,0,-.42,-.35,.23,.22,.42,dark);arms.push(arm);}
  const legs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.43,1.05,.25);dino.add(leg);
    box(leg,0,-.25,.05,.44,.7,.55,darkSide);box(leg,0,-.66,-.06,.35,.48,.36,dark);box(leg,0,-.90,-.28,.45,.24,.86,dark);legs.push(leg);
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
  const colorA=new THREE.Color(),colorB=new THREE.Color();
  function updatePalette(){
    for(const [key,mat] of Object.entries(materials)){colorA.set(palettes.grass[key]);colorB.set(palettes.desert[key]);mat.color.copy(colorA).lerp(colorB,mix);}
    colorA.set(palettes.grass.sky);colorB.set(palettes.desert.sky);scene.background.copy(colorA).lerp(colorB,mix);scene.fog.color.copy(scene.background);
    chunks.forEach(({trees,cacti,plants})=>{trees.visible=mix<.55;cacti.visible=mix>=.55;plants.visible=mix<.55;});
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
  return {icons,setPaused,setBiome,setQuality};

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
