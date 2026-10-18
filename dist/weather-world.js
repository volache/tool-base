// Weather as geometry: rain streaks, snowflakes, extra clouds, lightning bolts and the "look" numbers the world uses to grade
// light, fog and surfaces. All values ease toward the target so changing weather never jumps.
export function createWeatherWorld(THREE,{scene,cube,random,cloudGeometry,cloudMaterial,cloudParent=scene}){
  const MAX_RAIN=420,MAX_SNOW=300,FALL=34;
  const mathUtils=THREE.MathUtils,transform=new THREE.Object3D(),scratch=new THREE.Color();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let quality='balanced',activity=1,elapsed=0,nextStrike=6,strikeAt=-10,night=0;

  const rainMaterial=new THREE.MeshBasicMaterial({color:'#d3ebf7',transparent:true,opacity:.5,depthWrite:false});
  const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,1,.055),rainMaterial,MAX_RAIN);
  const snowMaterial=new THREE.MeshBasicMaterial({color:'#f4fbff',transparent:true,opacity:.8,depthWrite:false});
  const snow=new THREE.InstancedMesh(cube,snowMaterial,MAX_SNOW);
  for(const mesh of [rain,snow]){mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
  const rainSeeds=Array.from({length:MAX_RAIN},()=>({x:(random()-.5)*112,y:random()*FALL,z:-78+random()*100,length:.75+random()*.7,speed:27+random()*10}));
  const snowSeeds=Array.from({length:MAX_SNOW},()=>({x:(random()-.5)*112,y:random()*FALL,z:-78+random()*100,size:.075+random()*.09,speed:1.3+random()*1.1,phase:random()*6.28}));

  // Extra clouds appear one by one as the cover grows, so a cloudy day is visibly busier than a clear one.
  const clouds=[[-58,11,-48,.8],[8,20,-70,1.0],[-14,9,-60,.7],[38,12,-52,.85],[62,18,-82,1.0],[-34,21,-92,.9],[20,8,-44,.65],[-70,15,-76,.95],[48,22,-100,1.05],[-6,16,-88,.8]].map(([x,y,z,scale],index,all)=>{
    const mesh=new THREE.Mesh(cloudGeometry,cloudMaterial);mesh.position.set(x,y,z);mesh.visible=false;cloudParent.add(mesh);
    return {mesh,x,scale,threshold:.12+index/all.length*.62,speed:.12+random()*.18};
  });

  // One jagged bolt built from thin glowing segments (line widths are not drawn by WebGL), redrawn for every strike.
  const SEGMENTS=13,boltMaterial=new THREE.MeshBasicMaterial({color:'#f2f6ff',transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
  const bolt=new THREE.Group();bolt.visible=false;scene.add(bolt);
  const boltParts=Array.from({length:SEGMENTS},()=>{const part=new THREE.Mesh(cube,boltMaterial);part.renderOrder=5;part.frustumCulled=false;bolt.add(part);return part;});
  function strike(){
    let x=(random()-.5)*70,y=32;
    for(const part of boltParts){
      const nx=x+(random()-.5)*6,ny=y-2.3,dx=nx-x,dy=ny-y,length=Math.hypot(dx,dy);
      part.position.set((x+nx)/2,(y+ny)/2,-72);part.rotation.set(0,0,Math.atan2(dx,-dy));part.scale.set(.34,length,.1);
      x=nx;y=ny;
    }
    strikeAt=elapsed;
  }

  const target={cloud:0,rain:0,snow:0,fog:0,thunder:0,wind:0,groundSnow:0,rainbow:0,forceRainbow:false};
  const look={cloud:0,rain:0,snow:0,fog:0,wind:0,overcast:0,gray:0,haze:0,wet:0,snowCover:0,flash:0,rainbow:0};
  let easing=false;
  function setTarget(state){
    target.cloud=state?.cloud??0;target.rain=state?.rain??0;target.snow=state?.snow??0;target.fog=state?.fog??0;
    target.thunder=state?.thunder??0;target.wind=state?.wind??0;target.groundSnow=state?.groundSnow??0;target.rainbow=state?.rainbow??0;target.forceRainbow=!!state?.forceRainbow;
    easing=true;
  }
  // Called every render, also while paused, so the light always catches up with the weather.
  function ease(delta){
    const d=mathUtils.damp,instant=reduced.matches;
    const move=(from,to,rate)=>instant?to:d(from,to,rate,delta);
    look.cloud=move(look.cloud,target.cloud,1.1);look.rain=move(look.rain,target.rain,1.2);look.snow=move(look.snow,target.snow,1.2);
    look.fog=move(look.fog,target.fog,1);look.wind=move(look.wind,target.wind,1.4);look.rainbow=move(look.rainbow,target.rainbow,.5);
    look.wet=move(look.wet,Math.min(1,target.rain*1.2),target.rain>look.wet?.6:.12);
    look.snowCover=move(look.snowCover,Math.min(1,target.groundSnow*1.1),target.groundSnow>look.snowCover?.3:.08);
    look.overcast=Math.max(mathUtils.smoothstep(look.cloud,.3,1),look.rain*.9,look.snow*.8,look.fog*.5);
    look.gray=Math.min(1,Math.max(look.overcast*.75+look.rain*.12+look.snow*.05,look.fog*.9));
    look.haze=Math.min(1,look.fog+.3*look.rain+.22*look.snow);
    easing=['cloud','rain','snow','fog','wind','rainbow'].some(key=>Math.abs(look[key]-target[key])>.002)||Math.abs(look.wet-Math.min(1,target.rain*1.2))>.002||Math.abs(look.snowCover-Math.min(1,target.groundSnow*1.1))>.002;
  }
  // Runs with the animation clock, so everything freezes when the scene is paused.
  function animate(delta,nightMix=0){
    elapsed+=delta;night=nightMix;
    const crowd=mathUtils.clamp(.6+.4*activity,.5,1.2),perQuality=quality==='low'?[80,70]:quality==='high'?[MAX_RAIN,MAX_SNOW]:[260,180];
    const still=reduced.matches;
    rain.count=still?0:Math.min(MAX_RAIN,Math.round(perQuality[0]*look.rain*crowd));rain.visible=rain.count>0;
    snow.count=still?0:Math.min(MAX_SNOW,Math.round(perQuality[1]*look.snow*crowd));snow.visible=snow.count>0;
    const slant=look.wind*.55,sway=look.wind*3.2;
    if(rain.visible){
      rainMaterial.color.set('#d3ebf7').lerp(scratch.set('#8fb3c9'),night);rainMaterial.opacity=.38+.3*look.rain;
      const angle=Math.atan(slant);
      for(let i=0;i<rain.count;i++){
        const p=rainSeeds[i],y=FALL-((p.y+elapsed*p.speed)%FALL);
        transform.position.set(p.x+(FALL-y)*slant,y,p.z);transform.rotation.set(0,0,angle);transform.scale.set(1,p.length,1);transform.updateMatrix();rain.setMatrixAt(i,transform.matrix);
      }
      rain.instanceMatrix.needsUpdate=true;
    }
    if(snow.visible){
      snowMaterial.color.set('#f4fbff').lerp(scratch.set('#a9bfd2'),night);
      for(let i=0;i<snow.count;i++){
        const p=snowSeeds[i];
        transform.position.set(p.x+Math.sin(elapsed*.4+p.phase)*.8+sway*(FALL-((p.y+elapsed*p.speed)%FALL))*.18,FALL-((p.y+elapsed*p.speed)%FALL),p.z);
        transform.rotation.set(elapsed*.2+i,elapsed*.13+i,0);transform.scale.setScalar(p.size);transform.updateMatrix();snow.setMatrixAt(i,transform.matrix);
      }
      snow.instanceMatrix.needsUpdate=true;
    }
    // Extra clouds drift with the wind and grow in as the sky closes.
    for(const cloud of clouds){
      const grow=mathUtils.smoothstep(look.cloud,cloud.threshold,cloud.threshold+.25);
      cloud.mesh.visible=grow>.01;
      if(!cloud.mesh.visible)continue;
      cloud.x+=delta*cloud.speed*(1+look.wind*5);if(cloud.x>78)cloud.x=-78;
      cloud.mesh.position.x=cloud.x;cloud.mesh.scale.setScalar(cloud.scale*(.45+.55*grow));
    }
    // Lightning: at most one strike every 5 seconds, two quick pulses each, and never with reduced motion.
    if(target.thunder>0&&!still){
      nextStrike-=delta;
      if(nextStrike<=0){strike();nextStrike=(5+random()*9)/Math.max(.4,target.thunder);}
    }
    const age=elapsed-strikeAt,pulse=a=>a<0?0:Math.exp(-a*8);
    look.flash=age<0||age>1.2?0:.8*Math.max(pulse(age),.7*pulse(age-.18));
    boltMaterial.opacity=Math.min(1,look.flash/.8);bolt.visible=look.flash>.02;
  }
  return {look,target,setTarget,ease,animate,isEasing:()=>easing,calm(){strikeAt=-10;look.flash=0;boltMaterial.opacity=0;bolt.visible=false;},setQuality(value){quality=value;},setActivity(value){activity=value;}};
}
