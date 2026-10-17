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
  const localLight=new THREE.Vector3(),towardViewer=new THREE.Vector3(),screenRight=new THREE.Vector3();
  const uniforms={lightDirection:{value:new THREE.Vector3()},opacity:{value:1},litColor:{value:new THREE.Color('#fff3ce')},darkColor:{value:new THREE.Color('#1b2941')}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:`varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vNormal;uniform vec3 lightDirection;uniform vec3 litColor;uniform vec3 darkColor;uniform float opacity;void main(){float sunlight=dot(normalize(vNormal),lightDirection);float terminator=smoothstep(-.018,.018,sunlight);vec3 color=mix(darkColor,litColor*(.88+.12*max(sunlight,0.)),terminator);gl_FragColor=vec4(color,opacity);
    #include <colorspace_fragment>
    }`});
  let lastMinute=-1;
  function update(){
    const now=Date.now(),minute=Math.floor(now/60000);if(minute===lastMinute)return;lastMinute=minute;
    const data=getMoonPhase(new Date(now));localLight.fromArray(data.light);
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
    uniforms.lightDirection.value.copy(towardViewer).multiplyScalar(localLight.z).addScaledVector(screenRight,localLight.x);
  }
  return {material,update,updateView,setOpacity:value=>uniforms.opacity.value=value};
}
