import * as THREE from './vendor/three.module.min.js';
import {createVolumetricFog} from './volumetric-fog.js';
import {ensureOffscreenEndpoints} from './route-curves.js';
import {defaultUfoRoute} from './ufo-default-route.js';
import {createSnowWorld} from './snow-world.js';

// Everything in this scene is real geometry. No generated image is used as the background.
// Instancing keeps the many brick studs and terrain pieces in a small number of draw calls.
export async function createWorld(container,options={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled=true;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(37,1,.1,190);
  camera.position.set(0,9,28);camera.lookAt(0,5,-12);
  scene.background=new THREE.Color('#d4e8f0');
  scene.fog=new THREE.Fog('#d4e8f0',38,115);
  const volumeFog=createVolumetricFog(THREE,renderer,camera);
  const hemi=new THREE.HemisphereLight('#f2faff','#b5ad8c',2.2);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff5dc',2.8);sun.position.set(-18,34,20);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-28;sun.shadow.camera.far=100;sun.shadow.normalBias=.08;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
  let quality=options.quality||'balanced';
  let paused=!!options.paused;
  let biome=options.biome||'grass';
  let targetBiome=biome;
  let mix=biome==='desert'?1:0;
  let elapsed=0;
  let night=!!options.night;
  let nightMix=night?1:0,themeTransition;
  const palettes={
    grass:{sky:'#cee5f1',ground:'#8aa968',brick:'#a8bd7c',stud:'#b4c487',hill:'#8ba991',hilltop:'#b3c5a0',path:'#d9cfac',rock:'#aab0a4',tree:'#527f58',trunk:'#c0a070',flower:'#f0a071'},
    desert:{sky:'#e8e5d9',ground:'#dbb27c',brick:'#ecc58d',stud:'#efd4a5',hill:'#c49771',hilltop:'#e2bd8c',path:'#e5c694',rock:'#b9a58d',tree:'#88a16d',trunk:'#b9956f',flower:'#d8a26e'},
    coast:{sky:'#bfe0ee',ground:'#e7c98e',brick:'#efdaab',stud:'#f7e5bc',hill:'#b5d8df',hilltop:'#d8edf0',path:'#c99f69',rock:'#9aabb0',tree:'#3e8b73',trunk:'#b98155',flower:'#f4aa75'},
    snow:{sky:'#cbdfea',ground:'#dce9ed',brick:'#edf4f7',stud:'#f5fafb',hill:'#b5cbd7',hilltop:'#e4f0f6',path:'#cbdde5',rock:'#9ab2c1',tree:'#50776f',trunk:'#8c8076',flower:'#dce9ed'}
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
  const whiteMat=new THREE.MeshStandardMaterial({color:'#fff9e8',roughness:.92,transparent:true});
  const waterMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.3,metalness:.08,side:THREE.DoubleSide,vertexColors:true,flatShading:true});
  const foamMat=new THREE.MeshStandardMaterial({color:'#e8fbf6',roughness:.42});
  function createWaterReflection(night){
    const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=256;reflectionCanvas.height=128;
    const reflectionTexture=new THREE.CanvasTexture(reflectionCanvas);reflectionTexture.mapping=THREE.EquirectangularReflectionMapping;reflectionTexture.colorSpace=THREE.SRGBColorSpace;
    const context=reflectionCanvas.getContext('2d'),sky=context.createLinearGradient(0,0,0,128);
    sky.addColorStop(0,night?'#08142b':'#82c6e0');sky.addColorStop(.48,night?'#244366':'#e5f2ed');sky.addColorStop(1,night?'#0c1b2b':'#628a90');
    context.fillStyle=sky;context.fillRect(0,0,256,128);
    const glow=context.createRadialGradient(160,38,1,160,38,night?12:22);
    glow.addColorStop(0,night?'#fff3ce':'#fff9e3');glow.addColorStop(1,'rgba(255,248,220,0)');
    context.fillStyle=glow;context.fillRect(128,6,64,64);reflectionTexture.needsUpdate=true;
    return reflectionTexture;
  }
  const waterReflections=[createWaterReflection(false),createWaterReflection(true)];
  // Prepare both GPU reflection maps during loading, never during a theme click.
  const reflectionGenerator=new THREE.PMREMGenerator(renderer);
  const reflectionTargets=waterReflections.map(texture=>reflectionGenerator.fromEquirectangular(texture));
  reflectionGenerator.dispose();waterReflections.forEach(texture=>texture.dispose());
  waterMat.envMap=reflectionTargets[night?1:0].texture;waterMat.envMapIntensity=.55;
  function updateWaterReflection(){waterMat.envMap=reflectionTargets[night?1:0].texture;}
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
  const moonMaterial=new THREE.MeshBasicMaterial({color:'#fff3ce',fog:false,toneMapped:false,transparent:true});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(1.35,24,16),moonMaterial);moon.position.set(23,18,-48);nightSky.add(moon);
  const starPositions=[];
  for(let i=0;i<85;i++)starPositions.push((random()-.5)*150,12+random()*42,-60-random()*45);
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const starMaterial=new THREE.PointsMaterial({color:'#fff5df',size:.24,sizeAttenuation:true,fog:false,toneMapped:false,transparent:true,depthWrite:false});
  nightSky.add(new THREE.Points(starGeometry,starMaterial));
  const ufo=new THREE.Group();nightSky.add(ufo);ufo.visible=false;
  const saucerMat=new THREE.MeshStandardMaterial({color:'#a7bfcd',metalness:.35,roughness:.32,fog:false});
  const domeMat=new THREE.MeshStandardMaterial({color:'#6dcac7',emissive:'#317a82',emissiveIntensity:.35,roughness:.3,fog:false});
  const saucer=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.2,.22,8),saucerMat);ufo.add(saucer);
  box(ufo,0,.27,0,.8,.42,.7,domeMat,false);box(ufo,0,.51,0,.42,.12,.4,domeMat,false);
  const ufoLights=new THREE.MeshBasicMaterial({color:'#f2df99',fog:false,toneMapped:false});
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;box(ufo,Math.cos(a)*.84,-.12,Math.sin(a)*.84,.16,.1,.16,ufoLights,false);}
  let nextUfoAt=12,ufoFlight,ufoRoute=0;
  let customUfoCurve,ufoDuration=16,routePreview=false,customUfoRoutes=[],ufoRouteConfigs=[],previewUfoConfig;
  const flightPosition=new THREE.Vector3(),flightTangent=new THREE.Vector3();
  function createUfoFlight(){
    const index=ufoRoute++;
    if(customUfoRoutes.length){const route=customUfoRoutes[index%customUfoRoutes.length];customUfoCurve=route.curve;ufoDuration=route.duration;}
    return {start:elapsed,duration:ufoDuration,variant:0,radius:5.5,phase:0,routeIndex:index};
  }
  function sampleUfoFlight(flight,t,target){
    const {variant,radius,phase}=flight,direction=variant===1?-1:1;
    const entry=1-THREE.MathUtils.smootherstep(t,0,.24),exit=THREE.MathUtils.smootherstep(t,.76,1);
    const angle=t*Math.PI*4+phase;
    if(customUfoCurve){
      customUfoCurve.getPointAt(t,target);
      return target;
    }
    // Analytic motion is C2-continuous even at the entry/exit blend boundaries.
    // The orbit keeps moving while the off-screen approach offset eases away.
    target.set(direction*(radius*Math.cos(angle)+70*entry-100*exit),
      (variant===1?1.8*Math.sin(angle*2):2.6*Math.sin(angle))+5*entry+6*exit,
      (variant===2?4:2.5)*Math.sin(angle)-8*exit);
    return target;
  }
  function animateUfo(){
    if(!night||matchMedia('(prefers-reduced-motion: reduce)').matches){ufo.visible=false;return;}
    if(!ufoFlight&&elapsed>=nextUfoAt){ufoFlight=createUfoFlight();ufo.rotation.set(.08,0,0);}
    if(!ufoFlight)return;
    const t=(elapsed-ufoFlight.start)/ufoFlight.duration;
    if(t>=1){ufo.visible=false;ufoFlight=undefined;nextUfoAt=elapsed+(routePreview?1.2:45+random()*45);return;}
    ufo.visible=true;
    sampleUfoFlight(ufoFlight,t,flightPosition);
    sampleUfoFlight(ufoFlight,Math.min(1,t+.0001),flightTangent).sub(flightPosition).normalize();
    ufo.position.copy(moon.position).add(flightPosition);
    // Banking follows the velocity without abrupt orientation changes.
    const bank=THREE.MathUtils.clamp(flightTangent.y*.35,-.28,.28);
    ufo.rotation.z=THREE.MathUtils.damp(ufo.rotation.z,bank,4,Math.min(.05,elapsed-(ufoFlight.last??elapsed)));
    ufo.rotation.x=.08+Math.sin(t*Math.PI*4)*.035;ufoFlight.last=elapsed;
  }
  function getUfoRoute(){
    return structuredClone(defaultUfoRoute);
  }
  function buildUfoCurve(config){
    if(config?.nodes?.length>=3){
      const center=moon.position.clone().project(camera);
      ensureOffscreenEndpoints(config,[(center.x+1)/2,(1-center.y)/2]);
      const convert=([x,y])=>new THREE.Vector3(center.x+x*2,center.y-y*2,center.z).unproject(camera).sub(moon.position);
      const curve=new THREE.CurvePath();
      for(let i=0;i<config.nodes.length-1;i++){
        const a=config.nodes[i],b=config.nodes[i+1];
        const p1=[a.p[0]+a.out[0],a.p[1]+a.out[1]],p2=[b.p[0]+b.in[0],b.p[1]+b.in[1]];
        const segment=new THREE.CubicBezierCurve3(convert(a.p),convert(p1),convert(p2),convert(b.p));
        segment.arcLengthDivisions=100;curve.add(segment);
      }
      curve.arcLengthDivisions=800;curve.updateArcLengths();return curve;
    }
  }
  function setUfoRoute(config){
    ufoRouteConfigs=[];previewUfoConfig=config;customUfoRoutes=[];customUfoCurve=buildUfoCurve(config);ufoDuration=config?.duration??16;
    ufoFlight=undefined;nextUfoAt=elapsed;
    requestTick();
  }
  function setUfoRoutes(routes){
    previewUfoConfig=undefined;ufoRouteConfigs=routes??[];
    customUfoRoutes=ufoRouteConfigs.map(route=>({curve:buildUfoCurve(route),duration:route.duration})).filter(route=>route.curve);
    customUfoCurve=undefined;ufoDuration=16;ufoRoute=0;ufoFlight=undefined;nextUfoAt=elapsed;requestTick();
  }
  function getUfoGuide(){
    const flight={variant:0,radius:5.5,phase:0},center=moon.position.clone().project(camera);
    const path=[];
    for(let i=0;i<=240;i++){
      const p=sampleUfoFlight(flight,i/240,new THREE.Vector3()).add(moon.position).project(camera);
      path.push([(p.x+1)/2,(1-p.y)/2]);
    }
    return {path,moon:[(center.x+1)/2,(1-center.y)/2]};
  }
  function previewUfoRoute(enabled){routePreview=enabled;ufoFlight=undefined;nextUfoAt=elapsed;requestTick();}
  // The shoreline, sloping beach and displaced water share one world-space frame.
  const coastUniforms={coastOrigin:{value:new THREE.Vector2()},coastTangent:{value:new THREE.Vector2(1,0)},coastNormal:{value:new THREE.Vector2(0,1)},coastTime:{value:0},coastEnabled:{value:0},coastNight:{value:0}};
  const coastGLSL=`
    varying vec3 vCoastWorld;
    uniform vec2 coastOrigin,coastTangent,coastNormal;
    uniform float coastTime,coastEnabled,coastNight;
    float shoreCurve(float s){return .38*sin(s*.28)+.12*sin(s*.65+.5);}
    float coastDistance(){
      vec2 p=vCoastWorld.xz-coastOrigin;
      return dot(p,coastNormal)-shoreCurve(dot(p,coastTangent));
    }
    float coastHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float coastNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(coastHash(i),coastHash(i+vec2(1,0)),f.x),mix(coastHash(i+vec2(0,1)),coastHash(i+vec2(1,1)),f.x),f.y);
    }
  `;
  function coastShader(shader){
    Object.assign(shader.uniforms,coastUniforms);
    shader.vertexShader='varying vec3 vCoastWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 shoreWorld=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        shoreWorld=instanceMatrix*shoreWorld;
      #endif
      vCoastWorld=(modelMatrix*shoreWorld).xyz;
    `);
    shader.fragmentShader=coastGLSL+shader.fragmentShader;
  }
  for(const mat of Object.values(materials)){
    if(mat!==materials.ground)continue;
    mat.onBeforeCompile=shader=>{
      coastShader(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif(coastEnabled>.5 && coastDistance()>0.0) discard;');
    };
    mat.customProgramCacheKey=()=> 'world-coast-land-v1';
  }
  waterMat.onBeforeCompile=shader=>{
    coastShader(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float d=coastDistance();
      vec2 p=vCoastWorld.xz;
      float cells=coastHash(floor(p*3.5));
      float depth=-.30-.22*d-vCoastWorld.y;
      float shore=1.0-smoothstep(.03,.25,abs(depth));
      float lace=step(.56,cells);
      vec3 foamColor=mix(vec3(.84,.94,.87),vec3(.36,.51,.58),coastNight);
      diffuseColor.rgb=mix(diffuseColor.rgb,foamColor,shore*lace*.2);
    `);
  };
  waterMat.customProgramCacheKey=()=> 'world-coast-water-v2';
  const sea=new THREE.Group();scene.add(sea);
  const beachMat=new THREE.MeshStandardMaterial({color:'#dbc18e',roughness:.95,vertexColors:true,side:THREE.DoubleSide});
  const shoreGeometry=new THREE.BufferGeometry(),beachGeometry=new THREE.BufferGeometry();
  const water=new THREE.Mesh(shoreGeometry,waterMat);water.receiveShadow=true;sea.add(water);
  const beach=new THREE.Mesh(beachGeometry,beachMat);beach.receiveShadow=true;sea.add(beach);
  const foamBricks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),foamMat,420);foamBricks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);foamBricks.frustumCulled=false;sea.add(foamBricks);
  const foamSamples=[],foamDummy=new THREE.Object3D();
  const waterSamples=[];
  const shoreCurve=s=>.38*Math.sin(s*.28)+.12*Math.sin(s*.65+.5);
  function waveHeight(s,d,t){
    const fade=Math.min(1,Math.max(.2,d*.3));
    return -.72+fade*(.075*Math.sin(d*2.1+s*.24+t*1.5)+.035*Math.sin(s*1.55-d*.8+t*.9)+.025*Math.sin(d*3.7+s*.7-t*1.8));
  }
  function layoutCoast(width,height){
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),.32),ray=new THREE.Raycaster();
    function point(x,y){
      ray.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
      return ray.ray.intersectPlane(plane,new THREE.Vector3());
    }
    const run=Math.min(height*.5,width*.8),a=point(0,height-run),b=point(run,height);
    const tangent=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize();
    const normal=new THREE.Vector2(-tangent.y,tangent.x),corner=point(0,height);
    if(normal.dot(new THREE.Vector2(corner.x-a.x,corner.z-a.z))<0)normal.negate();
    coastUniforms.coastOrigin.value.set(a.x,a.z);
    coastUniforms.coastTangent.value.copy(tangent);coastUniforms.coastNormal.value.copy(normal);
    const length=a.distanceTo(b);
    function grid(geometry,rows,width,startDistance,isWater){
      const positions=[],colors=[],indices=[];if(isWater)waterSamples.length=0;
      const segments=160;
      for(let i=0;i<=segments;i++){
        const s=-25+(length+50)*i/segments;
        for(let j=0;j<=rows;j++){
          const d=startDistance+width*(isWater?(j/rows)**2:j/rows),offset=d+shoreCurve(s);
          const x=a.x+tangent.x*s+normal.x*offset,z=a.z+tangent.y*s+normal.y*offset;
          const y=isWater?waveHeight(s,d,elapsed):-.30-Math.max(0,d)*.22;
          positions.push(x,y,z);
          const color=isWater?new THREE.Color('#67b8b3').lerp(new THREE.Color('#236d87'),Math.min(1,Math.max(0,d)/14)):
            new THREE.Color('#e7c98e').lerp(new THREE.Color('#a98d64'),Math.min(1,Math.max(0,d)/3));
          colors.push(color.r,color.g,color.b);
          if(isWater)waterSamples.push({s,d});
          if(i<segments&&j<rows){
            const n=i*(rows+1)+j;indices.push(n,n+1,n+rows+1,n+1,n+rows+2,n+rows+1);
          }
        }
      }
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    }
    grid(shoreGeometry,56,65,-.5,true);
    grid(beachGeometry,14,7.5,-.5,false);
    foamSamples.length=0;
    for(let i=0;i<420;i++){
      const s=-25+(length+50)*(Math.floor(i/3)/139),row=i%3;
      const seed=Math.sin(i*91.7)*43758.5453,jitter=seed-Math.floor(seed);
      foamSamples.push({s:s+jitter*.26,d:1.35+row*.27+jitter*.16,size:.14+jitter*.16,phase:jitter*6.28});
    }
    animateFoam();
  }
  function animateFoam(){
    const origin=coastUniforms.coastOrigin.value,tangent=coastUniforms.coastTangent.value,normal=coastUniforms.coastNormal.value;
    foamSamples.forEach(({s,d,size,phase},i)=>{
      const drift=.08*Math.sin(elapsed*1.2+phase),cross=d+drift,y=waveHeight(s,cross,elapsed);
      const depth=-.30-.22*cross-y;
      const strength=Math.max(0,1-Math.abs(depth)/.16)*(.65+.35*Math.sin(elapsed*.8+phase));
      const offset=cross+shoreCurve(s);
      foamDummy.position.set(origin.x+tangent.x*s+normal.x*offset,y+.025,origin.y+tangent.y*s+normal.y*offset);
      foamDummy.rotation.y=-Math.atan2(tangent.y,tangent.x);
      foamDummy.scale.set(size*strength,.035*strength,size*.75*strength);
      foamDummy.updateMatrix();foamBricks.setMatrixAt(i,foamDummy.matrix);
    });
    foamBricks.instanceMatrix.needsUpdate=true;
  }
  function animateWater(){
    const positions=shoreGeometry.attributes.position;
    for(let i=0;i<waterSamples.length;i++){
      const {s,d}=waterSamples[i];positions.setY(i,waveHeight(s,d,elapsed));
    }
    positions.needsUpdate=true;shoreGeometry.computeVertexNormals();
    animateFoam();
  }
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
  function addPalm(parent,x,z,size=1){
    const g=new THREE.Group();g.position.set(x,-.3,z);g.scale.setScalar(size);parent.add(g);
    box(g,0,1.25,0,.42,2.6,.42,materials.trunk);
    box(g,.12,2.55,0,.72,.32,2.45,materials.tree);box(g,-.12,2.62,0,2.45,.3,.7,materials.tree);
    box(g,.58,2.48,0,1.5,.22,.52,materials.tree);box(g,-.58,2.48,0,1.5,.22,.52,materials.tree);
    return g;
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
    const trees=new THREE.Group(),cacti=new THREE.Group(),palms=new THREE.Group();group.add(trees,cacti,palms);
    for(let j=0;j<3;j++){
      const x=(j%2?-1:1)*(13+random()*30);const z=(random()-.5)*chunkLength;
      addTree(trees,x,z,.65+random()*.4);addCactus(cacti,x+.7,z,.65+random()*.5);
      addPalm(palms,x,z,.7+random()*.38);
    }
    chunks.push({group,trees,cacti,palms,plants,flowerBed});
  }
  const snowWorld=createSnowWorld(THREE,{scene,belt,chunks,cube,batch,random,trunkMaterial:materials.trunk});
  // Shadow casters must use the same world-space coastline as visible terrain.
  // Otherwise culled shoreline props leave floating silhouettes over the water.
  const coastDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  coastDepth.onBeforeCompile=shader=>{
    coastShader(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif(coastEnabled>.5 && coastDistance()>0.0) discard;');
  };
  scene.traverse(object=>{if(object.isMesh&&object.material===materials.ground)object.customDepthMaterial=coastDepth;});
  // Original 45 degree heading, toward the upper-left of the scene.
  const dinoAnchor=new THREE.Group();scene.add(dinoAnchor);
  const dino=new THREE.Group();dino.rotation.y=Math.PI/4;dinoAnchor.add(dino);
  const torso=new THREE.Group();dino.add(torso);
  const eyes=[];
  box(torso,0,1.6,.15,.95,1.35,1.17,dark);
  box(torso,0,2.15,-.25,.82,1.15,.77,darkSide);
  box(torso,0,2.92,-.76,1.18,.92,1.38,dark);
  box(torso,0,2.68,-1.43,1.14,.37,.57,dark);
  box(torso,0,2.35,-1.12,.93,.20,1.06,darkSide);
  // A front eye pair and contrasting snout make the direction legible from the portal camera.
  for(const side of [-1,1]){
    eyes.push(box(torso,side*.597,3.07,-.7,.025,.29,.3,eyeWhite,false));
    eyes.push(box(torso,side*.615,3.08,-.77,.025,.14,.14,eyeBlack,false));
    box(torso,side*.56,2.62,-1.4,.025,.075,.19,eyeBlack,false);
  }
  for(let i=0;i<3;i++)box(torso,0,2.48,-1.37+i*.19,.95,.07,.085,eyeWhite,false);
  // Small inset panels, nostrils, belly plates and toe claws add construction detail.
  const belly=new THREE.MeshStandardMaterial({color:'#9aab9c',roughness:.46});
  for(const material of [dark,darkSide,eyeWhite,eyeBlack,belly])material.fog=true;
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
  const head=new THREE.Group();head.position.set(0,2.5,-.4);torso.add(head);
  for(const part of [...torso.children])if(part.isMesh&&part.position.y>=2.35&&part.position.z<-.4)head.attach(part);
  const eyeHeights=eyes.map(eye=>eye.scale.y);
  const pointer=new THREE.Vector2(-10000,-10000),headScreen=new THREE.Vector3();
  const gazeDirection=new THREE.Vector3(),gazeRight=new THREE.Vector3(),gazeUp=new THREE.Vector3(),gazeRotation=new THREE.Quaternion();
  let curiosity=0,reactionStarted=-100;
  function headDistance(event){
    headScreen.set(0,.45,-.55);head.localToWorld(headScreen);headScreen.project(camera);
    const rect=container.getBoundingClientRect();
    return Math.hypot(event.clientX-(rect.left+(headScreen.x+1)*rect.width/2),event.clientY-(rect.top+(1-headScreen.y)*rect.height/2));
  }
  window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')pointer.set(event.clientX,event.clientY);});
  window.addEventListener('pointerout',event=>{if(!event.relatedTarget)pointer.set(-10000,-10000);});
  window.addEventListener('pointerdown',event=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||event.target.closest('button,a,input,select,[role="option"]'))return;
    if(headDistance(event)<110&&elapsed-reactionStarted>1)reactionStarted=elapsed;
  });
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
    camera.updateMatrixWorld();
    if(previewUfoConfig)customUfoCurve=buildUfoCurve(previewUfoConfig);
    else if(ufoRouteConfigs.length){
      customUfoRoutes=ufoRouteConfigs.map(route=>({curve:buildUfoCurve(route),duration:route.duration}));
      if(ufoFlight)customUfoCurve=customUfoRoutes[ufoFlight.routeIndex%customUfoRoutes.length].curve;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==='high'?1.8:quality==='low'?1:1.35));
    renderer.setSize(w,h,false);
    volumeFog.resize();
    layoutCoast(w,h);
    const mobile=w<650;
    raycaster.setFromCamera(new THREE.Vector2(mobile?.58:.68,mobile?-.82:-.67),camera);
    raycaster.ray.intersectPlane(groundPlane,anchorPoint);
    dinoAnchor.position.copy(anchorPoint);dinoAnchor.position.y=-.3;
    // Align the reserved local-X lane with the actual responsive dinosaur anchor.
    belt.position.set(anchorPoint.x,0,anchorPoint.z);
    alignCoastMotion();
    layoutCoastProps();
    dinoAnchor.scale.setScalar(Math.min(.95,w/h*.62));
    render();
  }
  function setQuality(q){
    snowWorld.setQuality(q);
    quality=q;renderer.shadowMap.enabled=q!=='low';lowDetails.forEach(m=>m.visible=q!=='low');
    sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);
    if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    renderer.shadowMap.needsUpdate=true;resize();
  }
  function setPaused(p){paused=p;last=performance.now();lastReport=last;frames=0;if(!p)requestTick();else{render();report(true);}}
  // One finite volume moves continuously through the 45-degree running axis.
  const mistUniforms={tint:{value:new THREE.Color()}};
  const groundMist={mistSeal:{value:0},mistFront:{value:-65},mistBack:{value:-185},mistAnchor:{value:new THREE.Vector2()}};
  const mistApproachDuration=.9;
  let sceneTransition,pendingBiome;
  function setBiome(b){
    if(sceneTransition){
      if(sceneTransition.phase==='out'){sceneTransition.to=b;sceneTransition.skyTo.set(night?'#101c35':palettes[b].sky);}
      else pendingBiome=b;
      return;
    }
    if(b===biome)return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){commitBiome(b);render();return;}
    sceneTransition={to:b,phase:'out',time:0,age:0,skyFrom:scene.background.clone(),skyTo:new THREE.Color(night?'#101c35':palettes[b].sky)};
    const mistTint=sceneTransition.skyFrom.clone().lerp(sceneTransition.skyTo,.5);
    mistTint.lerp(new THREE.Color(night?'#71879d':'#f5f8f5'),night?.14:.2);
    // Scattering stays in linear colour space until the final overlay conversion.
    mistUniforms.tint.value.copy(mistTint);
    container.dataset.transition='entering-mist';
    requestTick();
  }
  function commitBiome(b){
    biome=b;targetBiome=b;
    mix=b==='desert'?1:0;
    updatePalette();
    alignCoastMotion();
    layoutCoastProps();
  }
  function setNight(value){
    if(night===value)return;
    night=value;ufo.visible=false;ufoFlight=undefined;nextUfoAt=elapsed+10+random()*8;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){nightMix=night?1:0;themeTransition=undefined;updatePalette();}
    else themeTransition={from:nightMix,to:night?1:0,time:0};
    if(sceneTransition){sceneTransition.skyFrom.copy(scene.background);sceneTransition.skyTo.set(night?'#101c35':palettes[sceneTransition.to].sky);}
    requestTick();render();
  }
  function animateTheme(delta){
    if(!themeTransition)return;
    const transition=themeTransition;transition.time+=delta;
    const p=Math.min(1,transition.time/.75),smooth=p*p*(3-2*p);
    nightMix=THREE.MathUtils.lerp(transition.from,transition.to,smooth);
    updatePalette();if(p===1)themeTransition=undefined;
  }
  function animateSceneTransition(delta){
    if(!sceneTransition)return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishSceneTransition();return;}
    const transition=sceneTransition,incoming=transition.phase==='in',duration=incoming?3:mistApproachDuration;
    transition.time+=delta;
    // Keep the same fog sweep and fade envelope; accelerate only its approach.
    transition.age=Math.min(incoming?6:3,transition.age+delta*(incoming?1:3/mistApproachDuration));
    const p=Math.min(1,transition.time/duration);
    const progress=Math.min(1,transition.age/6),sweep=progress*progress*(3-2*progress);
    const travel=-65+sweep*230;
    groundMist.mistAnchor.value.set(anchorPoint.x,anchorPoint.z);
    groundMist.mistFront.value=travel;
    groundMist.mistBack.value=travel-120;
    groundMist.mistSeal.value=THREE.MathUtils.smoothstep(progress,.32,.46)*(1-THREE.MathUtils.smoothstep(progress,.54,.68));
    scene.background.copy(transition.skyFrom).lerp(transition.skyTo,sweep);scene.fog.color.copy(scene.background);
    if(p<1)return;
    if(!incoming){
      commitBiome(transition.to);
      scene.background.copy(transition.skyFrom).lerp(transition.skyTo,.5);scene.fog.color.copy(scene.background);
      transition.phase='in';transition.time=0;
      container.dataset.transition='leaving-mist';
    }else{
      sceneTransition=undefined;updatePalette();delete container.dataset.transition;
      const next=pendingBiome;pendingBiome=undefined;if(next&&next!==biome)setBiome(next);
    }
  }
  function finishSceneTransition(){
    if(!sceneTransition)return;
    const next=pendingBiome||sceneTransition.to;
    sceneTransition=undefined;pendingBiome=undefined;
    commitBiome(next);scene.fog.near=38;scene.fog.far=115;delete container.dataset.transition;
  }
  function alignCoastMotion(){
    // Keep the established heading and travel direction identical in every biome.
    belt.rotation.y=Math.PI/4;dino.rotation.y=Math.PI/4;
  }
  function layoutCoastProps(){
    if(w<2||h<2)return;
    const origin=coastUniforms.coastOrigin.value,normal=coastUniforms.coastNormal.value;
    const angle=belt.rotation.y,cos=Math.cos(angle),sin=Math.sin(angle);
    // Keep a whole object's complete looping trajectory on dry sand. Do not reveal
    // geometry by clipping fragments as it crosses the shore or the swash zone.
    function safeTrajectory(x,z,radius){
      for(const phase of [-75,60]){
        const px=belt.position.x+x*cos+(z+phase)*sin;
        const pz=belt.position.z-x*sin+(z+phase)*cos;
        const side=(px-origin.x)*normal.x+(pz-origin.y)*normal.y;
        // shoreCurve is bounded by .5; include radius and a dry-sand clearance.
        if(side>-(radius+1.3))return false;
      }
      return true;
    }
    const matrix=new THREE.Matrix4(),hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
    for(const chunk of chunks){
      for(const mesh of chunk.group.children){
        if(!mesh.isInstancedMesh)continue;
        const original=mesh.userData.landMatrices??=mesh.instanceMatrix.array.slice();
        mesh.instanceMatrix.array.set(original);
        if(biome==='coast'){
          mesh.geometry.computeBoundingSphere();
          for(let i=0;i<mesh.count;i++){
            matrix.fromArray(original,i*16);const e=matrix.elements;
            const scale=Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10]));
            if(!safeTrajectory(e[12],e[14],mesh.geometry.boundingSphere.radius*scale))mesh.setMatrixAt(i,hiddenMatrix);
          }
        }
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      }
      for(const palm of chunk.palms.children)palm.visible=biome!=='coast'||safeTrajectory(palm.position.x,palm.position.z,1.9*palm.scale.x);
    }
  }
  const colorA=new THREE.Color(),colorB=new THREE.Color();
  const themeColors=new Map();
  const tint=value=>{if(!themeColors.has(value))themeColors.set(value,new THREE.Color(value));return themeColors.get(value);};
  const blend=(color,day,night)=>color.copy(tint(day)).lerp(tint(night),nightMix);
  function updatePalette(){
    container.dataset.scene=biome;
    updateWaterReflection();
    for(const [key,mat] of Object.entries(materials)){
      if(biome==='coast'||biome==='snow')mat.color.set(palettes[biome][key]);
      else{colorA.set(palettes.grass[key]);colorB.set(palettes.desert[key]);mat.color.copy(colorA).lerp(colorB,mix);}
    }
    if(biome==='coast'||biome==='snow'){scene.background.set(palettes[biome].sky);scene.fog.color.copy(scene.background);}
    else{colorA.set(palettes.grass.sky);colorB.set(palettes.desert.sky);scene.background.copy(colorA).lerp(colorB,mix);scene.fog.color.copy(scene.background);}
    nightSky.visible=nightMix>.001;cloudGroup.visible=nightMix<.999;
    moonMaterial.opacity=starMaterial.opacity=nightMix;whiteMat.opacity=1-nightMix;
    sea.visible=biome==='coast';
    coastUniforms.coastEnabled.value=biome==='coast'?1:0;
    coastUniforms.coastNight.value=nightMix;
    snowWorld.setPalette(biome==='snow',nightMix);snowWorld.animate(elapsed,dino.position.y<.03);
    dustGroup.visible=biome!=='snow';
    scene.background.lerp(tint('#101c35'),nightMix);scene.fog.color.copy(scene.background);
    blend(hemi.color,'#f2faff','#a9c9ff');blend(hemi.groundColor,'#b5ad8c','#384252');hemi.intensity=THREE.MathUtils.lerp(2.2,1.35,nightMix);
    blend(sun.color,'#fff5dc','#adcaff');sun.intensity=THREE.MathUtils.lerp(2.8,1.55,nightMix);renderer.toneMappingExposure=THREE.MathUtils.lerp(1.02,.95,nightMix);
    blend(dark.color,'#535d60','#7d939e');blend(darkSide.color,'#657173','#94a9b1');
    blend(waterMat.color,'#ffffff','#62899c');beachMat.color.set('#ffffff').multiplyScalar(1-.32*nightMix);
    for(const mat of Object.values(materials))mat.color.multiplyScalar(1-.32*nightMix);
    chunks.forEach(({trees,cacti,palms,plants,flowerBed})=>{
      trees.visible=biome==='grass';cacti.visible=biome==='desert';palms.visible=biome==='coast';
      plants.visible=biome==='grass';flowerBed.visible=biome==='grass';
    });
  }
  function animate(delta){
    elapsed+=delta;
    coastUniforms.coastTime.value=elapsed;
    if(biome==='coast')animateWater();
    const speed=2.65;
    for(const {group} of chunks){group.position.z+=delta*speed;if(group.position.z>60)group.position.z-=chunkCount*chunkLength;}
    const phase=elapsed*8.8;
    torso.position.y=Math.abs(Math.sin(phase))*.07;
    torso.rotation.x=Math.sin(phase*2)*.014;
    legs[0].rotation.x=Math.sin(phase)*.67;legs[1].rotation.x=-Math.sin(phase)*.67;
    arms[0].rotation.x=-Math.sin(phase)*.2;arms[1].rotation.x=Math.sin(phase)*.2;
    tail.rotation.y=Math.sin(phase*.5)*.09;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      headScreen.set(0,2.95,-.95);torso.localToWorld(headScreen);headScreen.project(camera);
      const rect=container.getBoundingClientRect(),centerX=rect.left+(headScreen.x+1)*rect.width/2,centerY=rect.top+(1-headScreen.y)*rect.height/2;
      const distance=Math.hypot(pointer.x-centerX,pointer.y-centerY);
      const attention=1-THREE.MathUtils.smoothstep(distance,180,340);
      curiosity=THREE.MathUtils.damp(curiosity,attention,18,delta);
      torso.getWorldQuaternion(gazeRotation);
      gazeDirection.set(0,0,-4).applyQuaternion(gazeRotation);
      gazeRight.setFromMatrixColumn(camera.matrixWorld,0);gazeUp.setFromMatrixColumn(camera.matrixWorld,1);
      gazeDirection.addScaledVector(gazeRight,THREE.MathUtils.clamp(pointer.x-centerX,-220,220)*.026)
        .addScaledVector(gazeUp,THREE.MathUtils.clamp(centerY-pointer.y,-160,160)*.026)
        .applyQuaternion(gazeRotation.invert());
      const yaw=THREE.MathUtils.clamp(Math.atan2(-gazeDirection.x,-gazeDirection.z),-.85,.85)*curiosity;
      const pitch=THREE.MathUtils.clamp(Math.atan2(gazeDirection.y,Math.hypot(gazeDirection.x,gazeDirection.z)),-.4,.4)*curiosity;
      head.rotation.y=THREE.MathUtils.damp(head.rotation.y,yaw,20,delta);
      head.rotation.x=THREE.MathUtils.damp(head.rotation.x,pitch-(sceneTransition?.1:0),20,delta);
      head.rotation.z=0;torso.rotation.z=0;
      tail.rotation.y+=Math.sin(elapsed*11)*curiosity*.2;
      const hop=elapsed-reactionStarted;
      let lift=0,squash=0;
      const preparation=.1,gravity=24,launchSpeed=8.4,flightTime=2*launchSpeed/gravity;
      if(hop>=0&&hop<preparation)squash=Math.sin(hop/preparation*Math.PI)*.12;
      else if(hop>=preparation&&hop<preparation+flightTime){const t=hop-preparation;lift=launchSpeed*t-.5*gravity*t*t;}
      else if(hop>=preparation+flightTime&&hop<preparation+flightTime+.16)squash=Math.sin((hop-preparation-flightTime)/.16*Math.PI)*.12;
      dino.position.y=lift;dino.scale.set(1+squash*.3,1-squash,1+squash*.3);
      contactShadow.material.opacity=1-lift*.32;contactShadow.scale.setScalar(1+lift*.15);
      if(lift>0){
        const tuck=Math.sin(Math.PI*(hop-preparation)/flightTime);
        legs[0].rotation.x=THREE.MathUtils.lerp(legs[0].rotation.x,.55,tuck);
        legs[1].rotation.x=THREE.MathUtils.lerp(legs[1].rotation.x,-.4,tuck);
        arms.forEach(arm=>arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,-.7,tuck));
      }
      const blink=elapsed%5.2,eyeScale=blink<.18?Math.max(.08,Math.abs(blink-.09)/.09):1;
      eyes.forEach((eye,i)=>eye.scale.y=eyeHeights[i]*eyeScale);
    }
    animateUfo();
    snowWorld.animate(elapsed,dino.position.y<.03);
    if(ufo.visible)container.dataset.skyEvent='ufo';else delete container.dataset.skyEvent;
    cloudGroup.position.x=Math.sin(elapsed*.025)*2;
    dust.forEach((p,i)=>{const t=((elapsed*1.3+i/6)%1);p.position.set((i%2-.5)*.75,.08+t*.38,.9+t*2.5);p.scale.setScalar(.08+(1-t)*.14);p.rotation.set(t*2,t*3,t);p.visible=t<.9;});
    if(['grass','desert'].includes(targetBiome)&&['grass','desert'].includes(biome)){
      const target=targetBiome==='desert'?1:0;
      if(Math.abs(mix-target)>.002){mix=THREE.MathUtils.damp(mix,target,2.2,delta);updatePalette();}
    }
  }
  let last=performance.now(),lastReport=last,frames=0,raf=0;
  function render(){volumeFog.render(scene,sceneTransition?{front:groundMist.mistFront.value,back:groundMist.mistBack.value,anchor:groundMist.mistAnchor.value,tint:mistUniforms.tint.value,age:sceneTransition.age,seal:groundMist.mistSeal.value}:null);}
  function report(force=false){const now=performance.now();if(now-lastReport>1200||force){const interval=(now-lastReport)/1000;options.onStats?.({fps:paused?0:Math.round(frames/Math.max(interval,.01)),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,interval});lastReport=now;frames=0;}}
  function tick(now){raf=0;if(document.hidden||(paused&&!sceneTransition&&!themeTransition))return;const delta=Math.min((now-last)/1000,.1);last=now;if(!paused)animate(delta);animateTheme(delta);animateSceneTransition(delta);render();frames++;report();requestTick();}
  function requestTick(){if(!raf&&(!paused||sceneTransition||themeTransition)&&!document.hidden)raf=requestAnimationFrame(tick);}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{last=performance.now();lastReport=last;frames=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{render();requestTick();}});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;document.querySelector('#render-status').textContent='3D 畫面暫時中斷；工具入口仍可使用。';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{last=performance.now();document.querySelector('#render-status').textContent='3D 世界已恢復';render();requestTick();});
  updatePalette();resize();setQuality(quality);
  // Warm the sky programs while loading so first night/day use does not compile on click.
  const skyVisible=nightSky.visible,cloudsVisible=cloudGroup.visible;
  nightSky.visible=cloudGroup.visible=true;
  try{await renderer.compileAsync(scene,camera);}finally{nightSky.visible=skyVisible;cloudGroup.visible=cloudsVisible;}
  last=performance.now();report(true);requestTick();
  return {icons,setPaused,setBiome,setQuality,setNight,getUfoRoute,setUfoRoute,setUfoRoutes,getUfoGuide,previewUfoRoute};

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
