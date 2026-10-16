const key='tool-portal-ufo-route-v1';
const valid=value=>value&&Array.isArray(value.points)&&value.points.length===8&&value.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.5))&&Number.isFinite(value.duration)&&value.duration>=8&&value.duration<=28;
export function initRouteEditor(world,{begin,end}){
  const $=id=>document.getElementById(id),root=$('route-editor'),svg=$('route-overlay'),handles=$('route-handles');
  let saved,config,active=false,dragIndex=-1,previous;
  try{const data=JSON.parse(localStorage.getItem(key));if(valid(data))saved=data;}catch{}
  if(saved)world.setUfoRoute(saved);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const ns='http://www.w3.org/2000/svg';
  for(let i=0;i<8;i++){
    const group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),label=document.createElementNS(ns,'text');
    group.dataset.index=i;group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`航線控制點 ${i+1}，使用方向鍵移動`);
    circle.setAttribute('r','13');label.setAttribute('text-anchor','middle');label.setAttribute('dy','.35em');label.textContent=i+1;
    group.append(circle,label);handles.append(group);
  }
  function draw(){
    const {width,height}=svg.getBoundingClientRect(),guide=world.getUfoGuide();
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    $('route-path').setAttribute('d',guide.path.map(([x,y],i)=>`${i?'L':'M'}${(x*width).toFixed(2)},${(y*height).toFixed(2)}`).join(' '));
    [...handles.children].forEach((g,i)=>{
      const [x,y]=config.points[i];g.setAttribute('transform',`translate(${(guide.moon[0]+x)*width} ${(guide.moon[1]+y)*height})`);
      g.setAttribute('aria-label',`航線控制點 ${i+1}，使用方向鍵移動`);
    });
    $('ufo-duration').value=config.duration;$('ufo-duration-label').textContent=`${config.duration} 秒`;
  }
  let pendingFrame=0;
  function applyDraft(){world.setUfoRoute(config);draw();}
  function scheduleDraft(){if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(active)applyDraft();});}
  function open(){
    if(active)return;active=true;previous=begin();config=copy(saved??world.getUfoRoute());
    root.hidden=false;document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=true);
    world.previewUfoRoute(true);applyDraft();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('route-replay').disabled=reduced;
    $('route-status').textContent=reduced?'已依系統偏好停止動畫，仍可編輯與匯出航線。':'儲存僅套用在此瀏覽器。匯出後可將檔案提供給設計者定版。';$('route-close').focus();
  }
  function close(){
    if(!active)return;active=false;dragIndex=-1;root.hidden=true;
    if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}
    document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=false);
    world.previewUfoRoute(false);world.setUfoRoute(saved);end(previous);$('settings-toggle').focus();
  }
  function move(index,x,y){
    const guide=world.getUfoGuide(),{width,height}=svg.getBoundingClientRect();
    const next=[Math.max(.025,Math.min(.975,x))-guide.moon[0],Math.max(.07,Math.min(.85,y))-guide.moon[1]];
    if(config.points.some((p,i)=>i!==index&&Math.hypot((p[0]-next[0])*width,(p[1]-next[1])*height)<22))return;
    config.points[index]=next;scheduleDraft();
  }
  svg.addEventListener('pointerdown',event=>{
    const point=event.target.closest('[data-index]');if(!point)return;
    dragIndex=Number(point.dataset.index);svg.setPointerCapture(event.pointerId);point.focus();event.preventDefault();
  });
  svg.addEventListener('pointermove',event=>{
    if(dragIndex<0)return;const r=svg.getBoundingClientRect();move(dragIndex,(event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height);
  });
  function release(){dragIndex=-1;}
  svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
  handles.addEventListener('keydown',event=>{
    const index=Number(event.target.dataset.index);if(!Number.isInteger(index)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const guide=world.getUfoGuide(),r=svg.getBoundingClientRect(),step=event.shiftKey?12:3;
    const [x,y]=config.points[index];move(index,guide.moon[0]+x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/r.width,guide.moon[1]+y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/r.height);
  });
  $('ufo-duration').addEventListener('input',event=>{config.duration=Number(event.target.value);scheduleDraft();});
  $('route-replay').addEventListener('click',()=>{applyDraft();world.previewUfoRoute(true);});
  $('route-reset').addEventListener('click',()=>{config=world.getUfoRoute();applyDraft();});
  $('route-save').addEventListener('click',()=>{
    try{localStorage.setItem(key,JSON.stringify(config));saved=copy(config);$('route-status').textContent='已儲存。關閉編輯器後，此瀏覽器會使用這條航線。';}
    catch{$('route-status').textContent='瀏覽器無法儲存，請匯出航線以保留調整。';}
  });
  $('route-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({version:1,...config},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='ufo-route.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('route-status').textContent='已匯出 ufo-route.json，可將檔案提供給設計者定版。';
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key==='Tab'){
      const focusable=[...root.querySelectorAll('button,input,[tabindex="0"]')],index=focusable.indexOf(document.activeElement);
      if(event.shiftKey&&index<=0){event.preventDefault();focusable.at(-1).focus();}
      else if(!event.shiftKey&&(index===focusable.length-1||index<0)){event.preventDefault();focusable[0].focus();}
    }
  },true);
  window.addEventListener('resize',()=>{if(active){world.setUfoRoute(config);draw();}});
  $('route-close').addEventListener('click',close);$('edit-ufo').disabled=false;$('edit-ufo').addEventListener('click',open);
}
