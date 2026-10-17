export function initSkySettings(initial='sun'){
  const tabs=[...document.querySelectorAll('.sky-tabs [role="tab"]')];
  function select(tab,focus=false){
    for(const item of tabs){const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!active;}
    if(focus)tab.focus();
  }
  for(const tab of tabs){
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      select(tabs[index],true);
    });
  }
  select(document.getElementById(`sky-tab-${initial}`));
}
