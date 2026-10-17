// A rainbow is a screen-space arc centred on the point opposite the sun. It is drawn at the far depth, so the ground, trees and
// clouds in front of it hide the parts they should, and it fades out toward the horizon like real light in haze.
export function createRainbow(THREE,{scene}){
  const uniforms={center:{value:new THREE.Vector2()},aspect:{value:1.6},radius:{value:.9},strength:{value:0},horizon:{value:.03},second:{value:.35}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:'varying vec2 vNdc;void main(){vNdc=position.xy;gl_Position=vec4(position.xy,.9999,1.);}',
    fragmentShader:`varying vec2 vNdc;uniform vec2 center;uniform float aspect,radius,strength,horizon,second;
      vec3 spectrum(float u){
        vec3 c0=vec3(1.,.24,.2),c1=vec3(1.,.58,.2),c2=vec3(1.,.9,.34),c3=vec3(.4,.84,.46),c4=vec3(.34,.6,1.),c5=vec3(.62,.42,.92);
        float s=clamp(u,0.,1.)*5.;
        if(s<1.)return mix(c0,c1,s);if(s<2.)return mix(c1,c2,s-1.);if(s<3.)return mix(c2,c3,s-2.);if(s<4.)return mix(c3,c4,s-3.);return mix(c4,c5,s-4.);
      }
      float band(float d,float inner,float outer){return smoothstep(inner,inner+(outer-inner)*.22,d)*(1.-smoothstep(outer-(outer-inner)*.22,outer,d));}
      void main(){
        float d=length(vec2((vNdc.x-center.x)*aspect,vNdc.y-center.y));
        float width=radius*.085;
        float u=1.-(d-radius)/width;                       // red outside, violet inside
        float primary=band(d,radius,radius+width);
        float u2=(d-radius*1.27)/(width*1.1);               // faint second bow, colours reversed
        float secondary=band(d,radius*1.27,radius*1.27+width*1.1)*second;
        float glow=exp(-pow((d-radius-width*.5)/(width*3.2),2.))*.08;
        float haze=smoothstep(horizon-.02,horizon+.16,vNdc.y);
        vec3 color=primary>0.001?spectrum(u):(secondary>0.001?spectrum(u2):vec3(1.,.96,.9));
        float alpha=(primary*.62+secondary*.62+glow)*haze*strength;
        if(alpha<.003)discard;
        gl_FragColor=vec4(color,alpha);
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  mesh.frustumCulled=false;mesh.renderOrder=-1;mesh.visible=false;scene.add(mesh);
  // sun: the displayed sun in normalised device coordinates; strength: 0..1 after all weather and daylight gating.
  function update({sun,aspect,strength,horizon=.03,rich=false}){
    const visible=strength>.01;mesh.visible=visible;
    if(!visible)return;
    // Opposite the sun about the horizon: a low sun puts the arc's centre just below the horizon, a high sun pushes it far down.
    const cy=2*horizon-sun.y,cx=-sun.x;
    uniforms.center.value.set(THREE.MathUtils.clamp(cx,-1.7,1.7),cy);
    uniforms.aspect.value=aspect;uniforms.radius.value=.78;uniforms.strength.value=strength;uniforms.horizon.value=horizon;uniforms.second.value=rich?.45:.3;
    material.needsUpdate=false;
  }
  return {update,mesh};
}

// How visible a rainbow should be for a given sun altitude (radians): the sun must be low, but above the horizon.
export function rainbowSunFactor(altitude){
  const step=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  return step(altitude,.02,.12)*(1-step(altitude,.55,.78));
}
