// A soft, billboarded glow shared by the sun and the moon so both bodies are lit and haloed the same way.
// It is additive, depth-tested against the scenery (buildings and hills hide it) but never against clouds, so the light shines through them.
export function createSkyGlow(THREE,{color,size,bodyRadius,blending=THREE.AdditiveBlending}){
  const uniforms={tint:{value:new THREE.Color(color)},strength:{value:0},scale:{value:size},horizonMode:{value:0},horizonY:{value:.02},inner:{value:bodyRadius/(size*.5)}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,toneMapped:false,blending,uniforms,
    vertexShader:'varying vec2 vUv;varying vec4 vClip;uniform float scale;void main(){vUv=position.xy;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*scale;vec4 cp=projectionMatrix*mv;vClip=cp;gl_Position=cp;gl_Position.z=.99985*cp.w;}',
    fragmentShader:'varying vec2 vUv;varying vec4 vClip;uniform vec3 tint;uniform float strength,horizonMode,horizonY,inner;void main(){float d=length(vUv)*2.;if(d>1.)discard;if(horizonMode>1.5&&vClip.y/vClip.w<horizonY)discard;float fade=horizonMode>1.5?smoothstep(horizonY,horizonY+.18,vClip.y/vClip.w):1.;float a=strength*fade*pow(1.-d,2.4)*(.45+.55*smoothstep(inner*.85,inner*1.3,d));gl_FragColor=vec4(tint,a);#include <colorspace_fragment>}'.replace('#include','\n#include')});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  mesh.frustumCulled=false;mesh.renderOrder=3;mesh.visible=false;
  return {mesh,uniforms,set(strength,scale,horizonMode=0){uniforms.strength.value=strength;if(scale!==undefined){uniforms.scale.value=scale;uniforms.inner.value=bodyRadius/(scale*.5);}uniforms.horizonMode.value=horizonMode;mesh.visible=strength>.004;}};
}
