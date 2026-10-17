// A small accessible select-only combobox (ARIA 1.2 pattern) that matches the quality picker: mouse, touch and full keyboard support.
const refresh=()=>globalThis.lucide?.createIcons({attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});
const icon=name=>{const node=document.createElement('i');node.dataset.lucide=name;node.setAttribute('aria-hidden','true');return node;};

export function createCombobox({button,list,items,value='',onChange}){
  let current=items.findIndex(item=>item.value===value),active=Math.max(0,current);
  if(current<0)current=0;
  const rows=items.map((item,index)=>{
    const row=document.createElement('li');
    row.id=`${list.id}-${index}`;row.setAttribute('role','option');row.dataset.value=item.value;
    const label=document.createElement('span');label.textContent=item.label;
    row.append(icon(item.icon),label,icon('check'));
    row.addEventListener('click',()=>select(index));
    row.addEventListener('pointermove',()=>highlight(index));
    list.append(row);return row;
  });
  const text=button.querySelector('.combo-label');
  function paint(){
    rows.forEach((row,i)=>row.setAttribute('aria-selected',String(i===current)));
    text.textContent=items[current].label;
    button.querySelector('.combo-icon')?.remove();
    const mark=icon(items[current].icon);mark.classList.add('combo-icon');button.prepend(mark);refresh();
  }
  function highlight(index){
    active=(index+rows.length)%rows.length;
    rows.forEach((row,i)=>row.classList.toggle('highlighted',i===active));
    button.setAttribute('aria-activedescendant',rows[active].id);
    rows[active].scrollIntoView({block:'nearest'});
  }
  function open(){if(button.disabled)return;list.hidden=false;button.setAttribute('aria-expanded','true');highlight(current);list.scrollIntoView({block:'nearest',behavior:'smooth'});}
  function close(){list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');}
  function select(index,focus=true){
    const changed=index!==current;current=index;paint();close();
    if(focus)button.focus({preventScroll:true});
    if(changed)onChange?.(items[current].value,items[current]);
  }
  button.addEventListener('click',()=>{list.hidden?open():close();});
  button.addEventListener('keydown',event=>{
    const isOpen=!list.hidden;
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();if(!isOpen)open();
      if(event.key==='Home')highlight(0);else if(event.key==='End')highlight(rows.length-1);
      else if(isOpen)highlight(active+(event.key==='ArrowDown'?1:-1));
    }else if(event.key==='Enter'||event.key===' '){event.preventDefault();isOpen?select(active):open();}
    else if(event.key==='Escape'&&isOpen){event.preventDefault();event.stopPropagation();close();}
    else if(event.key==='Tab'&&isOpen){select(active,false);}
  });
  // Close on outside press, and whenever the surrounding panel closes.
  document.addEventListener('pointerdown',event=>{if(!button.parentElement.contains(event.target))close();});
  document.addEventListener('close-popups',close);
  paint();
  return {close,setValue(next){const index=items.findIndex(item=>item.value===next);if(index>=0){current=index;paint();}},get value(){return items[current].value;}};
}
