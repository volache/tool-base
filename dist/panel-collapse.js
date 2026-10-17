// Adds a "shrink panel" button to a floating panel's header. Collapsed panels keep only their header and the few controls CSS marks as essential,
// so they stop covering the sky while you drag the UFO route or watch the sun and moon preview. The choice is remembered per panel.
const refresh=()=>globalThis.lucide?.createIcons({attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});
const icon=name=>{const node=document.createElement('i');node.dataset.lucide=name;node.setAttribute('aria-hidden','true');return node;};

export function enableCollapse(panel,{key}){
  const head=panel?.querySelector('.settings-head');
  if(!head||head.querySelector('.panel-collapse'))return null;
  const storageKey=`tool-portal-collapsed-${key}`;
  let collapsed=false;
  try{collapsed=localStorage.getItem(storageKey)==='true';}catch{}
  const button=document.createElement('button');
  button.type='button';button.className='panel-collapse';
  function paint(){
    panel.classList.toggle('is-collapsed',collapsed);
    button.setAttribute('aria-expanded',String(!collapsed));
    const label=collapsed?'展開面板':'縮小面板';button.title=label;button.setAttribute('aria-label',label);
    button.replaceChildren(icon(collapsed?'chevrons-down':'chevrons-up'));refresh();
  }
  button.addEventListener('click',()=>{
    collapsed=!collapsed;
    try{localStorage.setItem(storageKey,String(collapsed));}catch{}
    paint();
    const announcer=document.getElementById('announcer');if(announcer)announcer.textContent=collapsed?'面板已縮小':'面板已展開';
  });
  head.insertBefore(button,head.querySelector('.panel-return'));
  paint();
  return {get collapsed(){return collapsed;},toggle:()=>button.click()};
}
