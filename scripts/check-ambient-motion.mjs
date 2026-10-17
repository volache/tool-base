import assert from 'node:assert/strict';
globalThis.window=globalThis;
const THREE=await import('../dist/vendor/three.module.min.js');
const {createTumbleweeds}=await import('../dist/tumbleweed.js');
const {createSunWorld}=await import('../dist/sun-world.js');
const belt=new THREE.Group(),cube=new THREE.BoxGeometry(1,1,1),weeds=createTumbleweeds(THREE,{belt,cube});
weeds.setCount(3);const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),stems=weeds.mesh.count/3;
for(const time of [0,.2,1,3.5,8,27]){
  weeds.animate(time);
  for(let ball=0;ball<3;ball++){
    let bottom=Infinity;
    for(let j=0;j<stems;j++){
      weeds.mesh.getMatrixAt(ball*stems+j,matrix);assert(matrix.elements.every(Number.isFinite));
      for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){point.set(x,y,z).applyMatrix4(matrix);bottom=Math.min(bottom,point.y);}
    }
    assert(bottom>=-.301&&bottom<-.27,`Grass ball floats or penetrates ground at ${time}: ${bottom}`);
  }
}
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,2,.1,190);camera.position.set(0,9,28);camera.lookAt(0,5,-12);camera.updateMatrixWorld();
// A point at ground contact must cancel the grass ball's motion relative to the moving belt.
const q0=new THREE.Quaternion(),q1=new THREE.Quaternion();
weeds.animate(1);weeds.mesh.getMatrixAt(0,matrix);matrix.decompose(new THREE.Vector3(),q0,new THREE.Vector3());
weeds.animate(1.001);weeds.mesh.getMatrixAt(0,matrix);matrix.decompose(new THREE.Vector3(),q1,new THREE.Vector3());
const rotation=q1.multiply(q0.invert()),angularX=2*Math.atan2(rotation.x,rotation.w)/.001;
assert(angularX<0,'Slower-than-ground grass ball must roll backwards relative to camera travel');
assert(Math.abs((1.05-2.65)-angularX*.5)<.002,'Grass ball contact must cancel ground-relative travel');
const sun=createSunWorld(THREE,{scene,camera}),rays=scene.children[0].children[1];
sun.update(1,0);const first=Array.from(rays.instanceMatrix.array);
sun.update(1,4);const second=Array.from(rays.instanceMatrix.array);assert(first.some((v,i)=>Math.abs(v-second[i])>.001),'Rays must breathe');
sun.update(1,4);assert.deepEqual(Array.from(rays.instanceMatrix.array),second,'Paused elapsed time must freeze rays');
for(let i=0;i<8;i++){rays.getMatrixAt(i,matrix);const scale=new THREE.Vector3();matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);assert(scale.y>=.73&&scale.y<=1.27);}
const originalPerformance=globalThis.performance;let clock=100;globalThis.performance={now:()=>clock};
try{
  const source=scene.children[0].position.clone(),body=scene.children[0].children[0];
  sun.setTracking({enabled:true,location:{lat:23.987,lng:121.601,timeZone:'Asia/Taipei'},previewTime:Date.UTC(2026,9,17,16)});
  clock=200;sun.update(1,4);
  assert(scene.children[0].position.distanceTo(source)<1e-10,'Mode switch must fade out at the old position');
  assert.equal(body.material.uniforms.warmth.value,0,'Departing fixed sun must not turn orange');
  clock=600;sun.update(1,4);assert.equal(body.material.uniforms.opacity.value,0,'Nighttime sun must remain below horizon after switching');
}finally{globalThis.performance=originalPerformance;}
console.log('Ambient motion: grass balls maintain contact and roll relative to the moving ground; stronger sun rays freeze when paused; mode exit preserves position and color.');
