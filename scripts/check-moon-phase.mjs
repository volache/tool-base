import assert from 'node:assert/strict';
// Supply the browser global used by the unmodified, vendored SunCalc build.
globalThis.window=globalThis;
const {getMoonPhase,createMoonPhase}=await import('../dist/moon-phase.js');
for(let day=1;day<=29;day+=4){
  const result=getMoonPhase(new Date(Date.UTC(2026,9,day,12)));
  assert(result.fraction>=0&&result.fraction<=1);
  assert(Math.abs(Math.hypot(...result.light)-1)<1e-10);
  assert(result.phase<.5?result.light[0]>=0:result.light[0]<=0);
  let lit=0,total=0;
  for(let ix=0;ix<240;ix++)for(let iy=0;iy<240;iy++){
    const x=(ix+.5)/120-1,y=(iy+.5)/120-1,r2=x*x+y*y;if(r2>1)continue;
    total++;if(x*result.light[0]+Math.sqrt(1-r2)*result.light[2]>0)lit++;
  }
  assert(Math.abs(lit/total-result.fraction)<.004,`Projected moon area does not match illumination on October ${day}`);
}
const THREE=await import('../dist/vendor/three.module.min.js');
globalThis.document={getElementById:()=>null};
const testTime=Date.UTC(2026,9,17,12),display=createMoonPhase(THREE);display.update(testTime);
const camera=new THREE.PerspectiveCamera(37,2,.1,190);camera.position.set(0,9,28);camera.lookAt(0,5,-12);camera.updateMatrixWorld();
const moon=new THREE.Object3D(),viewer=new THREE.Vector3(),right=new THREE.Vector3();
for(const x of [-45,0,45]){
  moon.position.set(x,18,-48);moon.updateMatrixWorld();display.updateView(moon,camera);
  viewer.copy(moon.position).applyMatrix4(camera.matrixWorldInverse).negate().normalize();
  right.set(1,0,0).addScaledVector(viewer,-viewer.x).normalize();
  const expected=getMoonPhase(new Date(testTime)),light=display.material.uniforms.lightDirection.value;
  assert(Math.abs(light.dot(viewer)-expected.light[2])<1e-10,'Off-axis moon changed its illuminated fraction');
  assert(Math.abs(light.dot(right)-expected.light[0])<1e-10,'Off-axis moon changed waxing/waning direction');
}
console.log('Moon phase: eight dates match projected bright area within 0.4%; three off-axis positions preserve phase.');
