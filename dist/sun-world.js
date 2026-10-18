import {getSunSkyState,getSunPanoramaHeight,getSunPanoramaX} from './sun-sky.js';
import {createSkyGlow} from './sky-glow.js';
export function createSunWorld(THREE,{scene,camera}){
  const uniforms={opacity:{value:1},warmth:{value:0},horizon:{value:0}};
  // The sun makes its own light, so it is not shaded like a plastic ball: pale at the centre, warmer toward the edge, with no highlight or dark side.
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:true,toneMapped:false,uniforms,
    vertexShader:'varying vec4 vClip;varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);vec4 cp=projectionMatrix*modelViewMatrix*vec4(position,1.);vec4 cc=projectionMatrix*modelViewMatrix*vec4(0.,0.,0.,1.);float dz=cp.z/cp.w-cc.z/cc.w;vClip=cp;gl_Position=cp;gl_Position.z=(.99983+dz)*cp.w;}',
    fragmentShader:'varying vec4 vClip;varying vec3 vN;uniform float opacity,warmth,horizon;void main(){if(horizon>.5&&vClip.y/vClip.w<.02)discard;vec3 n=normalize(vN);float edge=pow(1.-max(n.z,0.),1.7);vec3 core=mix(vec3(1.,.93,.58),vec3(1.,.76,.42),warmth);vec3 rim=mix(vec3(1.,.72,.2),vec3(1.,.38,.08),warmth);vec3 c=mix(core,rim,edge);gl_FragColor=vec4(c,opacity);#include <colorspace_fragment>}'.replace('#include','\n#include')});
  const group=new THREE.Group();scene.add(group);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(1.22,40,24),material);group.add(ball);
  const glow=createSkyGlow(THREE,{color:'#ffbd4a',size:5.6,bodyRadius:1.22,blending:THREE.NormalBlending});group.add(glow.mesh);
  // Soft rays of light instead of hard bars: a billboard with blurred, slowly turning beams that fade with distance from the sun.
  const rayUniforms={time:{value:0},strength:{value:0},warmth:{value:0},horizon:{value:0},scale:{value:6.5}};
  const rayMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,toneMapped:false,blending:THREE.NormalBlending,uniforms:rayUniforms,
    vertexShader:'varying vec2 vUv;varying vec4 vClip;uniform float scale;void main(){vUv=position.xy;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*scale;vec4 cp=projectionMatrix*mv;vClip=cp;gl_Position=cp;gl_Position.z=.99984*cp.w;}',
    fragmentShader:'varying vec2 vUv;varying vec4 vClip;uniform float time,strength,warmth,horizon;void main(){float d=length(vUv)*2.;if(d>1.)discard;if(horizon>.5&&vClip.y/vClip.w<.02)discard;float a=atan(vUv.y,vUv.x);float beams=pow(.5+.5*cos(a*9.+time*.08),7.)*.8+pow(.5+.5*cos(a*5.-time*.05+1.7),9.)*.5;float radial=smoothstep(.2,.3,d)*pow(1.-smoothstep(.3,1.,d),1.6);float pulse=.9+.1*sin(time*.9);vec3 c=mix(vec3(1.,.78,.3),vec3(1.,.48,.14),warmth);float fade=horizon>.5?smoothstep(.02,.2,vClip.y/vClip.w):1.;gl_FragColor=vec4(c,beams*radial*strength*pulse*.4*fade);#include <colorspace_fragment>}'.replace('#include','\n#include')});
  const rays=new THREE.Mesh(new THREE.PlaneGeometry(1,1),rayMaterial);rays.frustumCulled=false;group.add(rays);
  // The sun is drawn before the clouds, so a cloud in front of it hides it, and the rays and glow spread over the cloud edges.
  ball.renderOrder=-2;rays.renderOrder=3;
  const fixed=new THREE.Vector3(-23,19,-52),target=new THREE.Vector3(),screen=new THREE.Vector3(),probe=new THREE.Vector3();
  group.position.copy(fixed);let config={},transition,second=-1,opacity=1;
  function setTracking(next){
    if(config.enabled!==next.enabled||config.location!==next.location||(config.previewTime==null)!==(next.previewTime==null))transition={start:performance.now(),position:group.position.clone(),opacity,warmth:uniforms.warmth.value,horizon:uniforms.horizon.value};
    config=next;second=-1;
  }
  function update(daylight,elapsed=0){
    rayUniforms.time.value=elapsed;
    const tracked=config.enabled&&config.location,time=config.previewTime??Date.now();let state;
    if(tracked){state=getSunSkyState(time,config.location);const depth=screen.copy(fixed).project(camera).z;target.set(getSunPanoramaX(state,time,config.location),getSunPanoramaHeight(state,time,config.location),depth).unproject(camera);}
    else target.copy(fixed);
    const desired=daylight*(state?THREE.MathUtils.smoothstep(state.altitude,-.075,.025):1);
    let warmth=state?1-THREE.MathUtils.smoothstep(state.altitude,0,.35):0,horizon=tracked?1:0;
    if(transition){
      const p=Math.min(1,(performance.now()-transition.start)/420);
      if(p<.5){group.position.copy(transition.position);opacity=transition.opacity*(1-THREE.MathUtils.smootherstep(p*2,0,1));warmth=transition.warmth;horizon=transition.horizon;}
      else{group.position.copy(target);opacity=desired*THREE.MathUtils.smootherstep((p-.5)*2,0,1);}
      if(p>=1)transition=undefined;
    }else{group.position.copy(target);opacity=desired;}
    uniforms.opacity.value=opacity;uniforms.horizon.value=horizon;uniforms.warmth.value=warmth;
    // Sinking into the haze: the sun dims and is gone completely before its lower edge reaches the terrain's far edge (0.134), so it is never sliced off.
    if(tracked){probe.copy(group.position).project(camera);opacity*=THREE.MathUtils.smoothstep(probe.y,.2,.3);uniforms.opacity.value=opacity;}
    // The corona breathes: it swells and shrinks a few percent, slowly, together with its brightness.
    const breathe=1+.05*Math.sin(elapsed*.9)+.02*Math.sin(elapsed*.37+1.3);
    glow.set(opacity*(.55+.25*warmth),(5.6+warmth*1.4)*breathe,horizon>.5?2:0);
    rayUniforms.strength.value=opacity;rayUniforms.warmth.value=warmth;rayUniforms.horizon.value=horizon;rayUniforms.scale.value=(6.5+warmth*1.6)*breathe;rays.visible=opacity>.004;
    group.visible=opacity>.001;group.lookAt(camera.position);
    if(state&&!transition&&second!==Math.floor(time/1000)){
      second=Math.floor(time/1000);screen.copy(target).project(camera);
      config.onStatus?.({...state,inView:group.visible&&Math.abs(screen.x)<1.04&&Math.abs(screen.y)<1.04,screen:{x:screen.x,y:screen.y}});
    }
  }
  const ndc=new THREE.Vector3();
  return {setTracking,update,isTransitioning:()=>!!transition,getScreenPosition(out){ndc.copy(group.position).project(camera);return out.set(ndc.x,ndc.y);}};
}
