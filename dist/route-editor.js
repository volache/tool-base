import {splitSegment,cubicPoint,ensureOffscreenEndpoints} from './route-curves.js';
import {dynamicMoonUfoRoute} from './ufo-default-route.js';
import {readRouteFile,exportRouteFile,defaultRouteSet} from './route-data.js';
// A new default revision applies the owner's approved route once, while preserving subsequent edits.
const key='tool-portal-ufo-routes-v5-approved-20261017-final';
export function initRouteEditor(world,{begin,end}){
  const $=id=>document.getElementById(id),root=$('route-editor'),svg=$('route-overlay'),handles=$('route-handles');
  let saved,config,routes,staticRoutes,dynamicRoutes,routeIndex=0,selectedPoint=0,active=false,dragIndex=-1,dragKind='anchor',dragOffset=[0,0],previous,viewingDynamic=false;
  try{
    const data=JSON.parse(localStorage.getItem(key));
    if(data)saved=readRouteFile(data);
  }catch{}
  const initial=saved??defaultRouteSet();world.setUfoRoutes(initial.routes,initial.dynamicRoutes);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const ns='http://www.w3.org/2000/svg';
  function ensureHandles(){
  if(handles.children.length===config.nodes.length)return;
  handles.replaceChildren();
  for(let i=0;i<config.nodes.length;i++){
    const group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),label=document.createElementNS(ns,'text');
    group.dataset.index=i;group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`航線控制點 ${i+1}，使用方向鍵移動`);
    circle.setAttribute('r','13');label.setAttribute('text-anchor','middle');label.setAttribute('dy','.35em');label.textContent=i+1;
    group.append(circle,label);handles.append(group);
  }
  }
  const controls=$('route-control-handles'),controlLine=$('route-control-lines');
  for(const kind of ['in','out']){
    const circle=document.createElementNS(ns,'circle');circle.dataset.handle=kind;circle.setAttribute('r','7');circle.setAttribute('tabindex','0');circle.setAttribute('role','button');controls.append(circle);
  }
  let routeHighlight=0;
  function highlightRoute(index){
    routeHighlight=(index+routes.length)%routes.length;
    [...$('route-tabs').children].forEach((button,i)=>button.classList.toggle('highlighted',i===routeHighlight));
    $('route-choice').setAttribute('aria-activedescendant',`route-option-${routeHighlight}`);
  }
  function closeRoutePicker(focus=false){$('route-tabs').hidden=true;$('route-choice').setAttribute('aria-expanded','false');$('route-choice').removeAttribute('aria-activedescendant');if(focus)$('route-choice').focus();}
  function openRoutePicker(){routeTabs();$('route-tabs').hidden=false;$('route-choice').setAttribute('aria-expanded','true');highlightRoute(routeIndex);}
  function updateRouteMode(){document.querySelectorAll('[data-route-mode]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.routeMode==='dynamic')===viewingDynamic)));$('route-moon-note').textContent=world.getUfoGuide().moonNote;}
  function chooseRoute(index){routeIndex=index;config=routes[index];selectedPoint=0;applyDraft();routeTabs();closeRoutePicker(true);}
  function routeTabs(){
    $('route-choice-name').textContent=routes[routeIndex].name||`航線 ${routeIndex+1}`;
    $('route-choice-meta').textContent=`${routes[routeIndex].nodes.length} 個航點 · ${routes[routeIndex].duration} 秒`;
    $('route-tabs').replaceChildren(...routes.map((route,index)=>{
      const button=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('small'),text=document.createElement('span'),check=document.createElement('i');
      button.type='button';button.id=`route-option-${index}`;button.tabIndex=-1;button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===routeIndex));
      title.textContent=route.name||`航線 ${index+1}`;meta.textContent=`${route.nodes.length} 個航點 · ${route.duration} 秒`;text.append(title,meta);check.dataset.lucide='check';check.setAttribute('aria-hidden','true');button.append(text,check);
      button.addEventListener('pointerenter',()=>highlightRoute(index));button.addEventListener('click',()=>chooseRoute(index));return button;
    }));
    $('route-add').disabled=routes.length>=12;$('route-delete').disabled=routes.length<=1;
    globalThis.lucide.createIcons({attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});
  }
  $('route-choice').addEventListener('click',()=>{$('route-tabs').hidden?openRoutePicker():closeRoutePicker();});
  $('route-choice').addEventListener('keydown',event=>{
    const key=event.key;
    if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(key)){
      event.preventDefault();const wasClosed=$('route-tabs').hidden;
      if(wasClosed)openRoutePicker();
      if(key==='Home')highlightRoute(0);else if(key==='End')highlightRoute(routes.length-1);
      else if((key==='ArrowDown'||key==='ArrowUp')&&!wasClosed)highlightRoute(routeHighlight+(key==='ArrowDown'?1:-1));
      else if((key==='Enter'||key===' ')&&!wasClosed)chooseRoute(routeHighlight);
      $('route-tabs').children[routeHighlight]?.scrollIntoView({block:'nearest'});
    }else if(key==='Tab')closeRoutePicker();
  });
  document.addEventListener('pointerdown',event=>{if(!$('route-picker').contains(event.target))closeRoutePicker();});
  function draw(){
    ensureHandles();
    const {width,height}=svg.getBoundingClientRect(),guide=world.getUfoGuide();
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const point=([x,y])=>`${((guide.moon[0]+x)*width).toFixed(2)},${((guide.moon[1]+y)*height).toFixed(2)}`;
    let path=`M${point(config.nodes[0].p)}`;
    for(let i=1;i<config.nodes.length;i++){const a=config.nodes[i-1],b=config.nodes[i];path+=` C${point([a.p[0]+a.out[0],a.p[1]+a.out[1]])} ${point([b.p[0]+b.in[0],b.p[1]+b.in[1]])} ${point(b.p)}`;}
    $('route-path').setAttribute('d',path);$('route-hit').setAttribute('d',path);
    [...handles.children].forEach((g,i)=>{
      const [x,y]=config.nodes[i].p,sx=guide.moon[0]+x,sy=guide.moon[1]+y,outside=sx<0||sx>1||sy<0||sy>1;
      g.setAttribute('transform',`translate(${Math.max(18,Math.min(width-18,sx*width))} ${Math.max(18,Math.min(height-18,sy*height))})`);
      g.classList.toggle('offscreen',outside);
      g.setAttribute('aria-label',`${i===0?'進場':i===config.nodes.length-1?'離場':'航線'}控制點 ${i+1}${outside?'（畫面外，邊緣選取標記）':''}，使用方向鍵移動`);
      g.classList.toggle('selected',i===selectedPoint);g.setAttribute('aria-pressed',String(i===selectedPoint));
    });
    $('route-name').value=config.name||`航線 ${routeIndex+1}`;
    $('point-status').textContent=`已選 ${selectedPoint+1}${selectedPoint===0?'（進場）':selectedPoint===config.nodes.length-1?'（離場）':''} · 共 ${config.nodes.length} 點（3–48 點）`;
    $('point-add').disabled=config.nodes.length>=48;$('point-delete').disabled=config.nodes.length<=3;
    const node=config.nodes[selectedPoint],lines=[];
    $('point-x').value=Math.round((guide.moon[0]+node.p[0])*1000)/10;$('point-y').value=Math.round((guide.moon[1]+node.p[1])*1000)/10;
    [...controls.children].forEach(circle=>{
      const kind=circle.dataset.handle,hidden=kind==='in'?selectedPoint===0:selectedPoint===config.nodes.length-1;
      circle.style.display=hidden?'none':'';if(hidden)return;
      const cx=(guide.moon[0]+node.p[0])*width,cy=(guide.moon[1]+node.p[1])*height;
      const x=cx+node[kind][0]*width,y=cy+node[kind][1]*height;
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('aria-label',`航點 ${selectedPoint+1} ${kind==='in'?'入彎':'出彎'}把手`);
      lines.push(`M${cx},${cy} L${x},${y}`);
    });
    controlLine.setAttribute('d',lines.join(' '));$('point-mode').textContent=node.smooth===false?'轉角航點':'平滑航點';$('point-mode').setAttribute('aria-pressed',String(node.smooth!==false));
    $('ufo-duration').value=config.duration;$('ufo-duration-label').textContent=`${config.duration} 秒`;
    $('ufo-duration').style.setProperty('--flight-progress',`${(config.duration-8)/20*100}%`);
    $('route-choice-meta').textContent=`${config.nodes.length} 個航點 · ${config.duration} 秒`;
  }
  let pendingFrame=0;
  function applyDraft(){
    const {moon}=world.getUfoGuide();
    ensureOffscreenEndpoints(config,moon);
    world.setUfoRoute(config);draw();
  }
  function scheduleDraft(){if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(active)applyDraft();});}
  function open(){
    if(active)return;active=true;viewingDynamic=false;previous=begin();const all=copy(saved??defaultRouteSet());staticRoutes=all.routes;dynamicRoutes=all.dynamicRoutes;routes=staticRoutes;routeIndex=0;selectedPoint=0;config=routes[0];routeTabs();document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=true);
    const reveal=()=>{if(!active)return;updateRouteMode();root.hidden=false;root.classList.remove('is-closing');root.classList.add('is-opening');{const panel=root.querySelector('.route-panel'),done=event=>{if(event&&event.target!==panel)return;root.classList.remove('is-opening');panel.removeEventListener('animationend',done);};panel.addEventListener('animationend',done);setTimeout(done,320);}world.previewUfoRoute(true);applyDraft();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('route-replay').disabled=reduced;$('route-status').textContent=reduced?'已依系統偏好停止動畫，仍可編輯與匯出航線。':'儲存後依序輪換所有航線，僅套用在此瀏覽器。';$('route-close').focus();};
    setTimeout(reveal,previous.panelDelay??0);
  }
  function close(){
    if(!active)return;active=false;dragIndex=-1;closeRoutePicker();root.classList.add('is-closing');
    if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}
    document.querySelectorAll('header,main,footer,#settings').forEach(el=>el.inert=false);
    world.previewUfoRoute(false);const all=saved??defaultRouteSet();world.setUfoRoutes(all.routes,all.dynamicRoutes);
    setTimeout(()=>{root.hidden=true;root.classList.remove('is-closing');end(previous);$('settings-close')?.focus();},190);
  }
  function move(index,x,y){
    const guide=world.getUfoGuide(),{width,height}=svg.getBoundingClientRect();
    const next=[Math.max(-.5,Math.min(1.5,x))-guide.moon[0],Math.max(-.5,Math.min(1.5,y))-guide.moon[1]];
    if(config.nodes.some((node,i)=>i!==index&&Math.hypot((node.p[0]-next[0])*width,(node.p[1]-next[1])*height)<4))return;
    config.nodes[index].p=next;scheduleDraft();
  }
  function moveHandle(kind,x,y,independent=false){
    const guide=world.getUfoGuide(),node=config.nodes[selectedPoint];
    const value=[x-guide.moon[0]-node.p[0],y-guide.moon[1]-node.p[1]];
    node[kind]=value;
    if(independent)node.smooth=false;
    if(node.smooth!==false){
      const other=kind==='in'?'out':'in',length=Math.hypot(...node[other]),current=Math.hypot(...value);
      if(current>1e-6)node[other]=value.map(n=>-n/current*length);
    }
    scheduleDraft();
  }
  svg.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-handle]');
    if(handle){dragKind=handle.dataset.handle;dragIndex=selectedPoint;svg.setPointerCapture(event.pointerId);handle.focus();event.preventDefault();return;}
    const point=event.target.closest('[data-index]');if(!point)return;
    dragKind='anchor';dragIndex=Number(point.dataset.index);selectedPoint=dragIndex;
    const guide=world.getUfoGuide(),r=svg.getBoundingClientRect(),p=config.nodes[dragIndex].p;
    dragOffset=[guide.moon[0]+p[0]-(event.clientX-r.left)/r.width,guide.moon[1]+p[1]-(event.clientY-r.top)/r.height];
    draw();svg.setPointerCapture(event.pointerId);point.focus();event.preventDefault();
  });
  svg.addEventListener('pointermove',event=>{
    if(dragIndex<0)return;const r=svg.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
    if(dragKind==='anchor')move(dragIndex,x+dragOffset[0],y+dragOffset[1]);else moveHandle(dragKind,x,y,event.altKey);
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
    const [x,y]=config.nodes[index].p;move(index,guide.moon[0]+x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/r.width,guide.moon[1]+y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/r.height);
  });
  handles.addEventListener('focusin',event=>{const index=Number(event.target.closest('[data-index]')?.dataset.index);if(Number.isInteger(index)){selectedPoint=index;draw();}});
  controls.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const kind=event.target.dataset.handle,node=config.nodes[selectedPoint],guide=world.getUfoGuide(),r=svg.getBoundingClientRect(),step=event.shiftKey?12:3;
    moveHandle(kind,guide.moon[0]+node.p[0]+node[kind][0]+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/r.width,guide.moon[1]+node.p[1]+node[kind][1]+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/r.height,event.altKey);
  });
  svg.addEventListener('dblclick',event=>{
    if(!['route-hit','route-path'].includes(event.target.id)||config.nodes.length>=48)return;
    const r=svg.getBoundingClientRect(),guide=world.getUfoGuide(),x=(event.clientX-r.left)/r.width-guide.moon[0],y=(event.clientY-r.top)/r.height-guide.moon[1];
    let best={distance:Infinity,index:0,t:.5};
    for(let index=0;index<config.nodes.length-1;index++)for(let sample=1;sample<40;sample++){
      const t=sample/40,p=cubicPoint(config.nodes[index],config.nodes[index+1],t),distance=Math.hypot((p[0]-x)*r.width,(p[1]-y)*r.height);
      if(distance<best.distance)best={distance,index,t};
    }
    splitSegment(config.nodes,best.index,best.t);selectedPoint=best.index+1;applyDraft();focusPoint();
  });
  $('point-mode').addEventListener('click',()=>{
    const node=config.nodes[selectedPoint];node.smooth=node.smooth===false;
    if(node.smooth){const length=Math.hypot(...node.in)||Math.hypot(...node.out),otherLength=Math.hypot(...node.out);if(otherLength>1e-6)node.in=node.out.map(v=>-v/otherLength*length);}
    applyDraft();
  });
  function focusPoint(){handles.children[selectedPoint]?.focus();}
  function addPoint(){
    if(config.nodes.length>=48)return;
    const index=Math.min(selectedPoint,config.nodes.length-2);
    splitSegment(config.nodes,index);selectedPoint=index+1;applyDraft();focusPoint();
  }
  function deletePoint(){
    if(config.nodes.length<=3)return;
    config.nodes.splice(selectedPoint,1);selectedPoint=Math.min(selectedPoint,config.nodes.length-1);applyDraft();focusPoint();
  }
  $('point-add').addEventListener('click',addPoint);$('point-delete').addEventListener('click',deletePoint);
  $('point-entry').addEventListener('click',()=>{selectedPoint=0;draw();});
  $('point-exit').addEventListener('click',()=>{selectedPoint=config.nodes.length-1;draw();});
  for(const id of ['point-x','point-y'])$(id).addEventListener('change',()=>{
    const x=Number($('point-x').value),y=Number($('point-y').value);
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    move(selectedPoint,x/100,y/100);
  });
  $('route-name').addEventListener('input',event=>{config.name=event.target.value.slice(0,24);routeTabs();});
  $('route-add').addEventListener('click',()=>{
    if(routes.length>=12)return;
    let number=routes.length+1;while(routes.some(route=>route.name===`航線 ${number}`))number++;
    routes.push({...copy(viewingDynamic?dynamicMoonUfoRoute:world.getUfoRoute()),name:`航線 ${number}`});routeIndex=routes.length-1;config=routes[routeIndex];selectedPoint=0;routeTabs();applyDraft();$('route-name').focus();
  });
  $('route-delete').addEventListener('click',()=>{
    if(routes.length<=1)return;
    routes.splice(routeIndex,1);routeIndex=Math.min(routeIndex,routes.length-1);config=routes[routeIndex];selectedPoint=0;routeTabs();applyDraft();
  });
  $('ufo-duration').addEventListener('input',event=>{config.duration=Number(event.target.value);scheduleDraft();});
  $('route-replay').addEventListener('click',()=>{world.previewUfoRoute(true,{dynamic:viewingDynamic});applyDraft();updateRouteMode();});
  document.querySelectorAll('[data-route-mode]').forEach(button=>button.addEventListener('click',()=>{viewingDynamic=button.dataset.routeMode==='dynamic';routes=viewingDynamic?dynamicRoutes:staticRoutes;routeIndex=0;config=routes[0];selectedPoint=0;world.previewUfoRoute(true,{dynamic:viewingDynamic});applyDraft();routeTabs();updateRouteMode();$('route-status').textContent=`正在編輯${viewingDynamic?'動態':'靜態'}月亮航線。`;}));
  $('route-reset').addEventListener('click',()=>{config={...copy(viewingDynamic?dynamicMoonUfoRoute:world.getUfoRoute()),name:config.name};routes[routeIndex]=config;selectedPoint=0;applyDraft();});
  $('route-save').addEventListener('click',()=>{
    try{const next=copy({routes:staticRoutes,dynamicRoutes});localStorage.setItem(key,JSON.stringify(exportRouteFile(next)));saved=next;$('route-status').textContent=`已儲存靜態 ${staticRoutes.length} 條、動態 ${dynamicRoutes.length} 條航線。`;}
    catch{$('route-status').textContent='瀏覽器無法儲存，請匯出航線以保留調整。';}
  });
  $('route-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(exportRouteFile({routes:staticRoutes,dynamicRoutes}),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='ufo-routes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('route-status').textContent=`已匯出靜態 ${staticRoutes.length} 條、動態 ${dynamicRoutes.length} 條航線。`;
  });
  $('route-import').addEventListener('click',()=>$('route-import-file').click());
  $('route-import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>262144)throw new Error('航線檔不可超過 256 KB。');const all=readRouteFile(JSON.parse(await file.text()));staticRoutes=all.routes;dynamicRoutes=all.dynamicRoutes;routes=viewingDynamic?dynamicRoutes:staticRoutes;routeIndex=0;selectedPoint=0;config=routes[0];applyDraft();routeTabs();$('route-status').textContent=`已載入靜態 ${staticRoutes.length} 條、動態 ${dynamicRoutes.length} 條；按「儲存全部航線」套用。${all.routes.length&&file.name?'':''}`;}catch(error){$('route-status').textContent=`匯入失敗：${error.message} 原有航線已保留。`;}finally{event.target.value='';}});
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!$('route-tabs').hidden)closeRoutePicker(true);else close();return;}
    if(event.key==='Tab'){
      const focusable=[...root.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')].filter(el=>el.getBoundingClientRect().width>0),index=focusable.indexOf(document.activeElement);
      if(event.shiftKey&&index<=0){event.preventDefault();focusable.at(-1).focus();}
      else if(!event.shiftKey&&(index===focusable.length-1||index<0)){event.preventDefault();focusable[0].focus();}
    }
  },true);
  window.addEventListener('resize',()=>{if(active)applyDraft();});
  $('route-close').addEventListener('click',close);$('edit-ufo').disabled=false;$('edit-ufo').addEventListener('click',open);
}
