import {defaultUfoRoute,dynamicMoonUfoRoute} from './ufo-default-route.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const vector=v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=3);
const valid=r=>r&&typeof r.name==='string'&&r.name.length<=40&&Array.isArray(r.nodes)&&r.nodes.length>=3&&r.nodes.length<=48&&r.nodes.every(n=>vector(n.p)&&vector(n.in)&&vector(n.out))&&Number.isFinite(r.duration)&&r.duration>=8&&r.duration<=28;
export function readRouteFile(data){
  if(!data||![4,5,undefined].includes(data.version)||!Array.isArray(data.routes)||!data.routes.length||data.routes.length>24||!data.routes.every(valid))throw new Error('航線檔格式或航點資料不正確。');
  let routes,dynamicRoutes;
  if(data.version===5){
    if(data.routes.some(r=>!['static','dynamic'].includes(r.mode)))throw new Error('航線缺少靜態或動態模式。');
    routes=data.routes.filter(r=>r.mode==='static');dynamicRoutes=data.routes.filter(r=>r.mode==='dynamic');
    if(!routes.length||!dynamicRoutes.length)throw new Error('檔案必須同時包含靜態及動態航線。');
  }else{routes=data.routes;dynamicRoutes=data.dynamicRoutes??[dynamicMoonUfoRoute];}
  if(routes.length>12||!Array.isArray(dynamicRoutes)||!dynamicRoutes.length||dynamicRoutes.length>12||!dynamicRoutes.every(valid))throw new Error('每個模式須包含 1–12 條有效航線。');
  const clean=r=>{const {mode,...route}=r;return clone(route);};
  return {routes:routes.map(clean),dynamicRoutes:dynamicRoutes.map(clean)};
}
export function exportRouteFile({routes,dynamicRoutes}){
  return {version:5,routes:[...routes.map(r=>({...clone(r),mode:'static'})),...dynamicRoutes.map(r=>({...clone(r),mode:'dynamic'}))]};
}
export function defaultRouteSet(){return {routes:[clone(defaultUfoRoute)],dynamicRoutes:[clone(dynamicMoonUfoRoute)]};}
