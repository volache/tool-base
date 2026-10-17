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
const sun=createSunWorld(THREE,{scene,camera}),rays=scene.children[0].children[1];
sun.update(1,0);const first=Array.from(rays.instanceMatrix.array);
sun.update(1,4);const second=Array.from(rays.instanceMatrix.array);assert(first.some((v,i)=>Math.abs(v-second[i])>.001),'Rays must breathe');
sun.update(1,4);assert.deepEqual(Array.from(rays.instanceMatrix.array),second,'Paused elapsed time must freeze rays');
for(let i=0;i<8;i++){rays.getMatrixAt(i,matrix);const scale=new THREE.Vector3();matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);assert(scale.y>=.90&&scale.y<=1.10);}
console.log('Ambient motion: three branching grass balls maintain ground contact; sun rays breathe gently and freeze when paused.');
