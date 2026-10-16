const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function fromLoop(points,entry,exit){
  const nodes=points.map((p,i)=>{
    const previous=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    const tangent=[(next[0]-previous[0])/6,(next[1]-previous[1])/6];
    return {p:[...p],in:tangent.map(n=>-n),out:tangent,smooth:true};
  });
  nodes.push(JSON.parse(JSON.stringify(nodes[0])));
  nodes.unshift({p:entry,in:[0,0],out:sub(mix(entry,points[0],.45),entry),smooth:true});
  nodes.push({p:exit,in:sub(mix(exit,points[0],.35),exit),out:[0,0],smooth:true});return nodes;
}
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
export function migrateRoute(route,moon){
  if(route.nodes)return route;
  return {name:route.name,duration:route.duration,nodes:fromLoop(route.points,[.98-moon[0],.1-moon[1]],[.025-moon[0],.25-moon[1]])};
}
