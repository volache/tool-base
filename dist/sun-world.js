import {getSunSkyState,getSunPanoramaHeight,getSunPanoramaX} from './sun-sky.js';
export function createSunWorld(THREE,{scene,camera}){
  const uniforms={opacity:{value:1},warmth:{value:0},horizon:{value:0}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:'varying vec4 vClip;void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;vClip=gl_Position;}',
    fragmentShader:'varying vec4 vClip;uniform float opacity,warmth,horizon;void main(){if(horizon>.5&&vClip.y/vClip.w<.02)discard;vec3 c=mix(vec3(1.,.67,.12),vec3(1.,.34,.08),warmth);gl_FragColor=vec4(c,opacity);#include <colorspace_fragment>}'.replace('#include','\n#include')});
  const group=new THREE.Group();scene.add(group);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.22,16,10),material));
  const rays=new THREE.InstancedMesh(new THREE.BoxGeometry(.23,.65,.18),material,8),dummy=new THREE.Object3D();group.add(rays);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;dummy.position.set(Math.sin(a)*1.78,Math.cos(a)*1.78,0);dummy.rotation.z=-a;dummy.updateMatrix();rays.setMatrixAt(i,dummy.matrix);}
  const fixed=new THREE.Vector3(-23,19,-52),target=new THREE.Vector3(),screen=new THREE.Vector3();
  group.position.copy(fixed);let config={},transition,second=-1,opacity=1;
  function setTracking(next){
    if(config.enabled!==next.enabled||config.location!==next.location||(config.previewTime==null)!==(next.previewTime==null))transition={start:performance.now(),position:group.position.clone(),opacity};
    config=next;second=-1;
  }
  function update(daylight){
    const tracked=config.enabled&&config.location,time=config.previewTime??Date.now();let state;
    if(tracked){state=getSunSkyState(time,config.location);const depth=screen.copy(fixed).project(camera).z;target.set(getSunPanoramaX(state,time,config.location),getSunPanoramaHeight(state,time,config.location),depth).unproject(camera);}
    else target.copy(fixed);
    const desired=daylight*(state?THREE.MathUtils.smoothstep(state.altitude,-.075,.025):1);
    if(transition){const p=THREE.MathUtils.smootherstep(Math.min(1,(performance.now()-transition.start)/420),0,1);group.position.lerpVectors(transition.position,target,p);opacity=THREE.MathUtils.lerp(transition.opacity,desired,p);if(p>=1)transition=undefined;}
    else{group.position.copy(target);opacity=desired;}
    uniforms.opacity.value=opacity;uniforms.horizon.value=tracked?1:0;uniforms.warmth.value=state?1-THREE.MathUtils.smoothstep(state.altitude,0,.35):0;
    group.visible=opacity>.001;group.lookAt(camera.position);
    if(state&&!transition&&second!==Math.floor(time/1000)){
      second=Math.floor(time/1000);screen.copy(target).project(camera);
      config.onStatus?.({...state,inView:group.visible&&Math.abs(screen.x)<1.04&&Math.abs(screen.y)<1.04,screen:{x:screen.x,y:screen.y}});
    }
  }
  return {setTracking,update,isTransitioning:()=>!!transition};
}
