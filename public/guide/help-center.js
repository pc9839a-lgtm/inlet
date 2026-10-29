import { rankManuals, normalizeQuery } from './search-core.mjs';
(() => {
  const search=document.getElementById('manual-search');
  const results=document.getElementById('manual-results');
  const list=document.getElementById('manual-result-list');
  const count=document.getElementById('search-count');
  const empty=document.getElementById('manual-empty');
  const buttons=[...document.querySelectorAll('[data-guide-filter]')];
  const sections=[...document.querySelectorAll('main > .section')];
  const groups=[...document.querySelectorAll('[data-guide-group]')];
  if(!search||!results||!list||!count||!empty)return;
  let category='전체';
  let docs=[...document.querySelectorAll('[data-guide-doc]')].map(element=>({
    path:element.getAttribute('href')||'',
    title:element.querySelector('strong')?.textContent||'',
    description:element.querySelector('p')?.textContent||'',
    category:element.closest('[data-guide-group]')?.dataset.guideGroup||'전체',
    headings:[],body:element.textContent||''
  }));
  const qs=new URLSearchParams(location.search);
  const allowed=['전체','시작하기','페이지 편집','신청·예약','접수·운영','설정·진단'];
  if(allowed.includes(qs.get('topic')))category=qs.get('topic');
  search.value=(qs.get('q')||'').slice(0,120);
  document.documentElement.classList.add('help-center-js');
  const make=(tag,cl,text)=>{
    const element=document.createElement(tag);
    if(cl)element.className=cl;
    if(text!==undefined)element.textContent=text;
    return element;
  };
  function render(){
    const query=normalizeQuery(search.value).slice(0,120);
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.guideFilter===category));
    if(query){
      sections.forEach(section=>{section.hidden=true;});
      results.hidden=false;
      list.replaceChildren();
      const found=rankManuals(docs,query,category);
      for(const doc of found){
        const link=make('a','manual-result-item');link.href=doc.path;
        link.append(make('span','result-category',doc.category),make('strong','',doc.title),make('p','',doc.matchText||doc.description));
        list.append(link);
      }
      empty.hidden=found.length>0;
      count.textContent='검색 결과 '+found.length+'개';
    } else {
      results.hidden=true;empty.hidden=true;list.replaceChildren();
      for(const section of sections)section.hidden=false;
      for(const group of groups)group.hidden=category!=='전체'&&group.dataset.guideGroup!==category;
      if(category!=='전체'){
        for(const section of sections)if(!section.hasAttribute('data-guide-group'))section.hidden=true;
      }
      const found=rankManuals(docs,'',category).length;
      count.textContent=category==='전체'?'전체 '+docs.length+'개 설명서':category+' · '+found+'개 설명서';
    }
  }
  search.addEventListener('input',render);
  buttons.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.guideFilter;render();}));
  search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';render();search.blur();}});
  document.addEventListener('keydown',e=>{
    if(e.key!=='/'||e.ctrlKey||e.altKey||e.metaKey)return;
    const target=e.target;
    if(target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable))return;
    e.preventDefault();search.focus();
  });
  render();
  fetch('/guide/search-index.json',{credentials:'same-origin'})
    .then(response=>{if(!response.ok)throw new Error('Index unavailable');return response.json();})
    .then(data=>{
      if(!Array.isArray(data.documents)||data.documents.length!==15)throw new Error('Incomplete index');
      docs=data.documents;render();
    })
    .catch(()=>render()); // Fallback remains usable: headings and summaries of all 15 chapter cards.
})();
