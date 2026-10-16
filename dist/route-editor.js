const key='tool-portal-ufo-routes-v2';
const valid=value=>value&&Array.isArray(value.points)&&value.points.length>=3&&value.points.length<=32&&value.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.5))&&Number.isFinite(value.duration)&&value.duration>=8&&value.duration<=28;
export function initRouteEditor(world,{begin,end}){
  const $=id=>document.getElementById(id),root=$('route-editor'),svg=$('route-overlay'),handles=$('route-handles');
  let saved,config,routes,routeIndex=0,selectedPoint=0,active=false,dragIndex=-1,previous;
  const defaults=()=>['環月','迴旋','寬幅'].map((name,i)=>({name,...world.getUfoRoute(i)}));
  try{
    const data=JSON.parse(localStorage.getItem(key));
    if(data?.routes?.length>=1&&data.routes.length<=12&&data.routes.every(valid))saved=data;
    else{const legacy=JSON.parse(localStorage.getItem('tool-portal-ufo-route-v1'));if(valid(legacy))saved={routes:[{name:'自訂航線',...legacy},...defaults().slice(1)]};}
  }catch{}
  if(saved)world.setUfoRoutes(saved.routes);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const ns='http://www.w3.org/2000/svg';
  function ensureHandles(){
  if(handles.children.length===config.points.length)return;
  handles.replaceChildren();
  for(let i=0;i<config.points.length;i++){
    const group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),label=document.createElementNS(ns,'text');
    group.dataset.index=i;group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`航線控制點 ${i+1}，使用方向鍵移動`);
    circle.setAttribute('r','13');label.setAttribute('text-anchor','middle');label.setAttribute('dy','.35em');label.textContent=i+1;
    group.append(circle,label);handles.append(group);
  }
  }
  function routeTabs(){
    $('route-tabs').replaceChildren(...routes.map((route,index)=>{
      const button=document.createElement('button');button.type='button';button.textContent=route.name||`航線 ${index+1}`;
      button.setAttribute('aria-pressed',String(index===routeIndex));
      button.addEventListener('click',()=>{routeIndex=index;config=routes[index];selectedPoint=0;applyDraft();routeTabs();$('route-tabs').children[index].focus();});return button;
    }));
    $('route-add').disabled=routes.length>=12;$('route-delete').disabled=routes.length<=1;
  }
  function draw(){
    ensureHandles();
    const {width,height}=svg.getBoundingClientRect(),guide=world.getUfoGuide();
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    $('route-path').setAttribute('d',guide.path.map(([x,y],i)=>`${i?'L':'M'}${(x*width).toFixed(2)},${(y*height).toFixed(2)}`).join(' '));
    [...handles.children].forEach((g,i)=>{
      const [x,y]=config.points[i];g.setAttribute('transform',`translate(${(guide.moon[0]+x)*width} ${(guide.moon[1]+y)*height})`);
      g.setAttribute('aria-label',`航線控制點 ${i+1}，使用方向鍵移動`);
      g.classList.toggle('selected',i===selectedPoint);g.setAttribute('aria-pressed',String(i===selectedPoint));
    });
    $('route-name').value=config.name||`航線 ${routeIndex+1}`;
    $('point-status').textContent=`已選航點 ${selectedPoint+1} · 共 ${config.points.length} 點（3–32 點）`;
    $('point-add').disabled=config.points.length>=32;$('point-delete').disabled=config.points.length<=3;
    $('ufo-duration').value=config.duration;$('ufo-duration-label').textContent=`${config.duration} 秒`;
  }
  let pendingFrame=0;
  function applyDraft(){world.setUfoRoute(config);draw();}
  function scheduleDraft(){if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(active)applyDraft();});}
  function open(){
    if(active)return;active=true;previous=begin();routes=copy(saved?.routes??defaults());routeIndex=0;selectedPoint=0;config=routes[0];routeTabs();
    root.hidden=false;document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=true);
    world.previewUfoRoute(true);applyDraft();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('route-replay').disabled=reduced;
    $('route-status').textContent=reduced?'已依系統偏好停止動畫，仍可編輯與匯出航線。':'儲存後依序輪換所有航線，僅套用在此瀏覽器。';$('route-close').focus();
  }
  function close(){
    if(!active)return;active=false;dragIndex=-1;root.hidden=true;
    if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}
    document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=false);
    world.previewUfoRoute(false);world.setUfoRoutes(saved?.routes);end(previous);$('settings-toggle').focus();
  }
  function move(index,x,y){
    const guide=world.getUfoGuide(),{width,height}=svg.getBoundingClientRect();
    const next=[Math.max(.025,Math.min(.975,x))-guide.moon[0],Math.max(.07,Math.min(.85,y))-guide.moon[1]];
    if(config.points.some((p,i)=>i!==index&&Math.hypot((p[0]-next[0])*width,(p[1]-next[1])*height)<6))return;
    config.points[index]=next;scheduleDraft();
  }
  svg.addEventListener('pointerdown',event=>{
    const point=event.target.closest('[data-index]');if(!point)return;
    dragIndex=Number(point.dataset.index);selectedPoint=dragIndex;draw();svg.setPointerCapture(event.pointerId);point.focus();event.preventDefault();
  });
  svg.addEventListener('pointermove',event=>{
    if(dragIndex<0)return;const r=svg.getBoundingClientRect();move(dragIndex,(event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height);
  });
  function release(){dragIndex=-1;}
  svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
  handles.addEventListener('keydown',event=>{
    const index=Number(event.target.dataset.index);if(!Number.isInteger(index))return;
    selectedPoint=index;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deletePoint();return;}
    if(event.key==='Insert'){event.preventDefault();addPoint();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const guide=world.getUfoGuide(),r=svg.getBoundingClientRect(),step=event.shiftKey?12:3;
    const [x,y]=config.points[index];move(index,guide.moon[0]+x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/r.width,guide.moon[1]+y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/r.height);
  });
  handles.addEventListener('focusin',event=>{const index=Number(event.target.closest('[data-index]')?.dataset.index);if(Number.isInteger(index)){selectedPoint=index;draw();}});
  function focusPoint(){handles.children[selectedPoint]?.focus();}
  function addPoint(){
    if(config.points.length>=32)return;
    const a=config.points[selectedPoint],b=config.points[(selectedPoint+1)%config.points.length];
    config.points.splice(selectedPoint+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);selectedPoint++;applyDraft();focusPoint();
  }
  function deletePoint(){
    if(config.points.length<=3)return;
    config.points.splice(selectedPoint,1);selectedPoint=Math.min(selectedPoint,config.points.length-1);applyDraft();focusPoint();
  }
  $('point-add').addEventListener('click',addPoint);$('point-delete').addEventListener('click',deletePoint);
  $('route-name').addEventListener('input',event=>{config.name=event.target.value.slice(0,24);routeTabs();});
  $('route-add').addEventListener('click',()=>{
    if(routes.length>=12)return;
    let number=routes.length+1;while(routes.some(route=>route.name===`航線 ${number}`))number++;
    routes.push({name:`航線 ${number}`,...world.getUfoRoute(routes.length%3)});routeIndex=routes.length-1;config=routes[routeIndex];selectedPoint=0;routeTabs();applyDraft();$('route-name').focus();
  });
  $('route-delete').addEventListener('click',()=>{
    if(routes.length<=1)return;
    routes.splice(routeIndex,1);routeIndex=Math.min(routeIndex,routes.length-1);config=routes[routeIndex];selectedPoint=0;routeTabs();applyDraft();
  });
  $('ufo-duration').addEventListener('input',event=>{config.duration=Number(event.target.value);scheduleDraft();});
  $('route-replay').addEventListener('click',()=>{applyDraft();world.previewUfoRoute(true);});
  $('route-reset').addEventListener('click',()=>{config={name:config.name,...world.getUfoRoute(routeIndex%3)};routes[routeIndex]=config;selectedPoint=0;applyDraft();});
  $('route-save').addEventListener('click',()=>{
    try{const next={routes:copy(routes)};localStorage.setItem(key,JSON.stringify(next));saved=next;$('route-status').textContent=`已儲存 ${routes.length} 條航線。關閉編輯器後依序輪換。`;}
    catch{$('route-status').textContent='瀏覽器無法儲存，請匯出航線以保留調整。';}
  });
  $('route-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({version:2,routes},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='ufo-routes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('route-status').textContent='已匯出全部航線 ufo-routes.json。';
  });
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.key==='Tab'){
      const focusable=[...root.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')],index=focusable.indexOf(document.activeElement);
      if(event.shiftKey&&index<=0){event.preventDefault();focusable.at(-1).focus();}
      else if(!event.shiftKey&&(index===focusable.length-1||index<0)){event.preventDefault();focusable[0].focus();}
    }
  },true);
  window.addEventListener('resize',()=>{if(active){world.setUfoRoute(config);draw();}});
  $('route-close').addEventListener('click',close);$('edit-ufo').disabled=false;$('edit-ufo').addEventListener('click',open);
}
