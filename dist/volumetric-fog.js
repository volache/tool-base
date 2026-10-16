// Depth-aware volumetric mist. Density is sampled through space, never on a plane.
export function createVolumetricFog(THREE,renderer,camera){
  const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const size=32,data=new Uint8Array(size**3);let seed=49371;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed>>>24;}
  // Smooth scalar noise in a 3D texture keeps each ray-march step inexpensive.
  for(let pass=0;pass<2;pass++){
    const previous=data.slice();
    for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      let sum=0;
      for(const [dx,dy,dz] of [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])sum+=previous[((z+dz+size)%size)*size*size+((y+dy+size)%size)*size+(x+dx+size)%size];
      data[z*size*size+y*size+x]=sum/7;
    }
  }
  const noise=new THREE.Data3DTexture(data,size,size,size);
  noise.format=THREE.RedFormat;noise.type=THREE.UnsignedByteType;noise.minFilter=noise.magFilter=THREE.LinearFilter;
  noise.wrapS=noise.wrapT=noise.wrapR=THREE.RepeatWrapping;noise.unpackAlignment=1;noise.needsUpdate=true;
  const uniforms={base:{value:target.texture},depth:{value:target.depthTexture},cloudNoise:{value:noise},inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},cameraPositionWorld:{value:camera.position},fogEnabled:{value:0},fogPresence:{value:0},front:{value:0},back:{value:0},anchor:{value:new THREE.Vector2()},tint:{value:new THREE.Color()},age:{value:0},seal:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`precision highp sampler3D;
      varying vec2 vUv;uniform sampler2D base,depth;uniform sampler3D cloudNoise;
      uniform mat4 inverseProjection,cameraWorld;uniform vec3 cameraPositionWorld,tint;
      uniform vec2 anchor;uniform float fogEnabled,fogPresence,front,back,age,seal;
      vec3 unproject(vec2 uv,float z){vec4 p=inverseProjection*vec4(uv*2.-1.,z*2.-1.,1.);p/=p.w;return (cameraWorld*p).xyz;}
      float density(vec3 p){
        float axis=dot(p.xz-anchor,vec2(.70710678));
        vec3 drift=vec3(age*.035,0.,age*.018);
        float broad=clamp((texture(cloudNoise,p*.025+drift).r-.5)*3.+.5,0.,1.);
        float detail=clamp((texture(cloudNoise,p*.16+drift).r-.5)*2.6+.5,0.,1.);
        float edge=(broad-.5)*18.;
        float bank=smoothstep(back-12.+edge,back+12.+edge,axis)*(1.-smoothstep(front-12.+edge,front+12.+edge,axis));
        float width=3.5+broad*3.5;
        float height=smoothstep(-1.5,.2,p.y)*exp(-pow(max(p.y,0.)/width,2.));
        float body=smoothstep(.15,.85,broad*.7+detail*.3);
        return bank*height*(.04+body*.8)*(1.+seal*3.5);
      }
      void main(){
        vec3 color=vec3(0.);float alpha=0.;
        if(fogEnabled>.5){
          float sceneDepth=texture2D(depth,vUv).r;
          vec3 end=unproject(vUv,sceneDepth),ray=normalize(end-cameraPositionWorld);
          float limit=min(length(end-cameraPositionWorld),155.);
          // Intersect the soft vertical extent of the mist before marching.
          float a=(-2.-cameraPositionWorld.y)/ray.y,b=(18.-cameraPositionWorld.y)/ray.y;
          float begin=max(0.,min(a,b)),finish=min(limit,max(a,b));
          if(finish>begin){
            float stepLength=(finish-begin)/32.;
            float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
            float transmission=1.;vec3 scattered=vec3(0.);
            for(int i=0;i<32;i++){
              vec3 p=cameraPositionWorld+ray*(begin+(float(i)+jitter)*stepLength);
              float amount=1.-exp(-density(p)*stepLength*.48);
              float light=.7+.3*clamp((texture(cloudNoise,p*.07+vec3(0.,.05,0.)).r-.35)*3.,0.,1.);
              scattered+=transmission*amount*tint*light;transmission*=1.-amount;
              if(transmission<.002)break;
            }
            alpha=1.-transmission;color=scattered/max(alpha,.00001);alpha*=fogPresence;
          }
        }
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`});
  const quadScene=new THREE.Scene(),quadCamera=new THREE.Camera();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  function resize(){const pixelSize=renderer.getDrawingBufferSize(new THREE.Vector2());target.setSize(pixelSize.x,pixelSize.y);}
  function render(scene,state){
    if(!state){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
    uniforms.fogEnabled.value=1;
    uniforms.fogPresence.value=THREE.MathUtils.smoothstep(state.age,0,1.5)*(1-THREE.MathUtils.smoothstep(state.age,4.9,6));
    uniforms.front.value=state.front;uniforms.back.value=state.back;uniforms.anchor.value.copy(state.anchor);uniforms.tint.value.copy(state.tint);uniforms.age.value=state.age;uniforms.seal.value=state.seal;
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    const shadowUpdate=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
    renderer.setRenderTarget(null);renderer.render(scene,camera);renderer.shadowMap.autoUpdate=shadowUpdate;
    const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(quadScene,quadCamera);renderer.autoClear=clear;
  }
  return {resize,render};
}
