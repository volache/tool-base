import './vendor/suncalc.js';

export function getMoonPhase(date=new Date()){
  const {fraction,phase}=globalThis.SunCalc.getMoonIllumination(date);
  const waxing=phase<.5;
  const name=fraction<.01?'新月':fraction>.99?'滿月':Math.abs(fraction-.5)<.025?(waxing?'上弦月':'下弦月'):fraction<.5?(waxing?'眉月':'殘月'):(waxing?'盈凸月':'虧凸月');
  const z=2*fraction-1;
  // Conventional north-up presentation: waxing lights the right, waning the left.
  return {fraction,phase,name,light:[(waxing?1:-1)*Math.sqrt(Math.max(0,1-z*z)),0,z]};
}

export function createMoonPhase(THREE){
  const localLight=new THREE.Vector3(),baseLight=new THREE.Vector3(),towardViewer=new THREE.Vector3(),screenRight=new THREE.Vector3(),screenUp=new THREE.Vector3();
  const dayLit=new THREE.Color('#edf6fa'),nightLit=new THREE.Color('#fff3ce');
  const uniforms={lightDirection:{value:new THREE.Vector3()},opacity:{value:1},daylight:{value:0},litColor:{value:nightLit.clone()},darkColor:{value:new THREE.Color('#1b2941')},horizonMode:{value:0},horizonY:{value:0}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:`varying vec3 vNormal;varying vec3 vObj;varying vec3 vView;varying float vHeight;varying vec4 vClip;void main(){vNormal=normalize(normalMatrix*normal);vObj=normalize(position);vView=(modelViewMatrix*vec4(position,1.)).xyz;vHeight=(modelMatrix*vec4(position,1.)).y-cameraPosition.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);vClip=gl_Position;gl_Position.z=gl_Position.w*.99999;}`,
    fragmentShader:`varying vec3 vNormal;varying vec3 vObj;varying vec3 vView;varying float vHeight;varying vec4 vClip;uniform float horizonMode;uniform float horizonY;uniform vec3 lightDirection;uniform vec3 litColor;uniform vec3 darkColor;uniform float opacity;uniform float daylight;void main(){if(horizonMode>.5&&horizonMode<1.5&&vHeight<0.)discard;if(horizonMode>1.5&&vClip.y/vClip.w<horizonY)discard;float sunlight=dot(normalize(vNormal),lightDirection);float terminator=smoothstep(-.018,.018,sunlight);vec3 nightColor=mix(darkColor,litColor*(.88+.12*max(sunlight,0.)),terminator);vec3 color=mix(nightColor,litColor,daylight);
    // The same soft look as the sun: a round ball with a gentle highlight and a darker rim, plus a few fixed craters (the moon always shows one face).
    vec3 n=normalize(vNormal);
    float lit=dot(n,normalize(vec3(-.4,.55,.75)));
    float spec=pow(max(dot(n,normalize(vec3(-.3,.45,.84))),0.),18.);
    float rim=pow(1.-max(n.z,0.),2.2);
    float crater=0.;
    vec3 c0=normalize(vec3(-.35,.3,.89)),c1=normalize(vec3(.4,.35,.85)),c2=normalize(vec3(-.1,-.4,.91)),c3=normalize(vec3(.55,-.25,.79)),c4=normalize(vec3(-.6,-.2,.77)),c5=normalize(vec3(.05,.7,.71));
    crater+=smoothstep(.2,.13,distance(vObj,c0))*.5+smoothstep(.14,.09,distance(vObj,c1))*.45+smoothstep(.17,.1,distance(vObj,c2))*.5+smoothstep(.12,.07,distance(vObj,c3))*.4+smoothstep(.15,.09,distance(vObj,c4))*.45+smoothstep(.1,.06,distance(vObj,c5))*.4;
    color*=(.8+.26*max(lit,0.)-.2*rim)*(1.-.16*crater);color+=vec3(.1,.09,.07)*spec*terminator;float alpha=opacity*mix(1.,terminator,daylight);gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
    }`});
  let lastMinute=-1,lastFraction=.5;
  function update(now=Date.now()){
    const minute=Math.floor(now/60000);if(minute===lastMinute)return;lastMinute=minute;
    const data=getMoonPhase(new Date(now));lastFraction=data.fraction;baseLight.fromArray(data.light);localLight.copy(baseLight);
    const name=document.getElementById('moon-phase-name'),fraction=document.getElementById('moon-phase-fraction');
    if(name)name.textContent=data.name;
    if(fraction)fraction.textContent=`亮面 ${Math.round(data.fraction*100)}%`;
    const status=document.getElementById('moon-phase-status');
    if(status){status.title=`${new Date(now).toLocaleDateString('zh-TW')} · ${data.name} · 依目前日期計算`;status.dataset.phase=String(data.phase);status.dataset.illumination=String(data.fraction);}
    return true;
  }
  function updateView(moon,camera){
    moon.getWorldPosition(towardViewer).applyMatrix4(camera.matrixWorldInverse).negate().normalize();
    screenRight.set(1,0,0).addScaledVector(towardViewer,-towardViewer.x).normalize();
    screenUp.crossVectors(towardViewer,screenRight).normalize();
    uniforms.lightDirection.value.copy(towardViewer).multiplyScalar(localLight.z).addScaledVector(screenRight,localLight.x).addScaledVector(screenUp,localLight.y);
  }
  function setOrientation(angle){localLight.copy(baseLight);if(angle==null)return;const magnitude=Math.sqrt(Math.max(0,1-localLight.z**2));localLight.x=-Math.sin(angle)*magnitude;localLight.y=Math.cos(angle)*magnitude;}
  return {fraction:()=>lastFraction,material,update,updateView,setOrientation,setDaylight:value=>{uniforms.daylight.value=THREE.MathUtils.clamp(value,0,1);uniforms.litColor.value.copy(nightLit).lerp(dayLit,uniforms.daylight.value);},setOpacity:value=>uniforms.opacity.value=value,setHorizon:(mode,y=0)=>{uniforms.horizonMode.value=mode;uniforms.horizonY.value=y;}};
}
