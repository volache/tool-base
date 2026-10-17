const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function splitSegment(nodes,index,t=.5){
  const a=nodes[index],b=nodes[index+1];if(!a||!b)return;
  const p0=a.p,p1=add(a.p,a.out),p2=add(b.p,b.in),p3=b.p;
  const q0=mix(p0,p1,t),q1=mix(p1,p2,t),q2=mix(p2,p3,t),r0=mix(q0,q1,t),r1=mix(q1,q2,t),point=mix(r0,r1,t);
  a.out=sub(q0,p0);b.in=sub(q2,p3);
  nodes.splice(index+1,0,{p:point,in:sub(r0,point),out:sub(r1,point),smooth:true});
}
export function cubicPoint(a,b,t){
  const u=1-t,p1=add(a.p,a.out),p2=add(b.p,b.in);
  return [0,1].map(i=>u*u*u*a.p[i]+3*u*u*t*p1[i]+3*u*t*t*p2[i]+t*t*t*b.p[i]);
}
export function ensureOffscreenEndpoints(route,moon,margin=.1){
  if(!route?.nodes?.length)return route;
  for(const node of [route.nodes[0],route.nodes.at(-1)]){
    const x=moon[0]+node.p[0],y=moon[1]+node.p[1];
    if(x<=-margin||x>=1+margin||y<=-margin||y>=1+margin)continue;
    const distances=[x,1-x,y,1-y],edge=distances.indexOf(Math.min(...distances));
    if(edge<2)node.p[0]=(edge===0?-margin:1+margin)-moon[0];
    else node.p[1]=(edge===2?-margin:1+margin)-moon[1];
  }
  return route;
}
