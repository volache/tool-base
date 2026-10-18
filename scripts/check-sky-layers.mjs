// Guards the sky layering: the sun and moon are depth-tested but pushed to the far plane, and clouds sit in a group scaled about the camera.
// Together this makes buildings, trees and clouds hide the sun and moon, and buildings hide the clouds, in every scene.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
const sun=read('sun-world.js'),moon=read('moon-phase.js'),world=read('world.js'),weatherWorld=read('weather-world.js'),city=read('city-world.js');

assert(/ShaderMaterial\(\{transparent:true,depthTest:true,depthWrite:true/.test(sun),'The sun must be depth-tested so scenery can hide it, and write depth so its own bricks sort correctly.');
assert(sun.includes('gl_Position.z=(.99983+dz)*cp.w'),'The sun is pushed to the far plane, keeping only its own small depth differences so its bricks sort correctly.');
assert(moon.includes('gl_Position.z=gl_Position.w*.99999'),'The moon must be pushed to the far plane, behind everything.');
assert(!/moonPhase\.material\.depthTest\s*=\s*false/.test(world),'The moon must never switch depth testing off.');
assert(/PerspectiveCamera\(37,1,\.1,(\d+)\)/.test(world)&&Number(/PerspectiveCamera\(37,1,\.1,(\d+)\)/.exec(world)[1])>=400,'The camera far plane must reach the pushed-back clouds.');
assert(/const SKY_SCALE=(\d+(\.\d+)?)/.test(world)&&Number(/const SKY_SCALE=(\d+(\.\d+)?)/.exec(world)[1])>=2,'Clouds must be scaled about the camera so they lie behind the skyline.');
assert(world.includes('skyClouds.position.copy(camera.position).multiplyScalar(1-SKY_SCALE)'),'The cloud group must be scaled about the camera position.');
assert(/cloudGroup=new THREE\.Group\(\);skyClouds\.add\(cloudGroup\)/.test(world),'Base clouds must live in the sky cloud group.');
assert(world.includes('cloudParent:skyClouds')&&weatherWorld.includes('cloudParent.add(mesh)'),'Weather clouds must live in the sky cloud group too.');
assert(/whiteMat=new THREE\.MeshStandardMaterial\([^)]*fog:false/.test(world),'Clouds are not fogged (they are far behind the fog range).');
// Night clouds are translucent dark clouds that never write depth: otherwise their invisible shapes bite chunks out of the moon.
assert(/whiteMat=new THREE\.MeshStandardMaterial\([^)]*depthWrite:false/.test(world),'Clouds must not write depth, or they would cut holes in the sun and moon.');
assert(world.includes('whiteMat.opacity=1;')&&!world.includes('whiteMat.opacity=1-'),'Clouds are always opaque: translucent clouds show the clouds behind them (a cloud inside a cloud).');
assert(world.includes('cloudGroup.visible=true'),'The base clouds are visible at night too.');
assert(world.includes("whiteMat.color.lerp(tint('#33435f'),.88*nightMix)"),'Night clouds are tinted dark blue.');
assert(world.includes('moon.renderOrder=-2')&&sun.includes('ball.renderOrder=-2'),'The sun and moon are drawn before the clouds, so a cloud in front hides them and the haze spreads over its edge.');
const glow=read('sky-glow.js');
assert(glow.includes('AdditiveBlending')&&glow.includes('depthTest:true')&&glow.includes('mesh.renderOrder=3'),'The glow is additive, hidden by scenery, and drawn after the clouds so it hazes over them.');
assert(sun.includes('createSkyGlow')&&world.includes('createSkyGlow'),'The sun and the moon share the same glow.');
// Both bodies are smooth round balls with the same soft glow; the moon is lit (highlight and rim), the sun makes its own light (no highlight, no dark side)
assert(/SphereGeometry\(1\.22,40,24\)/.test(sun)&&/SphereGeometry\(1\.35,48,32\),moonPhase\.material/.test(world),'Sun and moon are both smooth balls.');
assert(moon.includes('pow(1.-max(n.z,0.),2.2)')&&moon.includes('vec3(-.4,.55,.75)'),'The moon is lit with a highlight and a darker rim.');
assert(!/spec|lit=dot/.test(sun.slice(sun.indexOf('fragmentShader'),sun.indexOf('const group'))),'The sun is self-luminous: no plastic highlight or shaded side.');
assert(sun.includes('NormalBlending')&&!sun.includes('AdditiveBlending')&&sun.includes('rays.renderOrder=3'),'The sun has soft warm rays drawn after the clouds (normal blending keeps them yellow; additive would turn them white over the sky), not hard bars.');
assert(sun.includes('smoothstep(probe.y,.2,.3)'),'The sun fades out near the terrain edge instead of being sliced off.');
assert(!/BoxGeometry/.test(sun),'No hard bar rays.');
assert(world.includes('smoothstep(moonScreen.copy(moonTarget).project(camera).y,.22,.32)'),'The moon fades out near the terrain edge exactly like the sun, instead of being sliced off at full brightness.');
// City roads: the road bands are cleared of scattered ground pieces inside the shared pass that restores matrices after every scene change
assert(/biome==='city'/.test(world)&&world.includes('isRoadBand(original[i*16+12])'),'The city must clear ground pieces from its road bands in the shared restore pass.');
assert(!/maskRoads/.test(city),'No private mask: it would be overwritten by the shared restore pass.');
assert(!/__chunks|__city|debugMask/.test(world+city),'No debug hooks may ship.');
console.log('Sky layers: sun and moon are depth-tested at the far plane, clouds lie behind the skyline, and city roads are cleared.');
