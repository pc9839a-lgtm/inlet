/* Additional publisher guidance only. Original C63 layout, life and calltag bridges are unchanged. */
(() => {
  const CARDS = [
    ['01','신청 항목 정하기','상담·예약·이벤트별로 꼭 필요한 연락처·방문 일정·참가 정보를 고릅니다.','/tools/form-planner/','신청폼 설계 도구'],
    ['02','폼과 완료 화면 만들기','질문 유형, 필수 입력, 선택지, 개인정보 동의와 신청 완료 문구를 설정합니다.','/guide/contact-form/','상담 폼 설명서'],
    ['03','공개 페이지에서 검증하기','모바일에서 제출한 내용이 접수함에 실제 저장되는지 확인합니다.','/guide/troubleshooting/','발행·접수 오류 해결'],
    ['04','광고비와 접수 비교하기','페이지 조회, 전환 이벤트, 실제 접수의 차이를 구분하고 가정값으로 비용을 계산합니다.','/tools/lead-calculator/','광고 손익 계산기'],
  ];
  function appendText(parent,tag,cls,text) {
    const element=document.createElement(tag);
    if(cls)element.className=cls;
    element.textContent=text;
    parent.appendChild(element);
    return element;
  }
  function createGuideSection(){
    const section=document.createElement('section');
    section.className='c63-guide-bridge';
    section.setAttribute('aria-labelledby','c63-guide-title');
    const inner=document.createElement('div');inner.className='c63-life-inner';
    const head=document.createElement('div');head.className='c63-life-head';
    const copy=document.createElement('div');
    appendText(copy,'span','c63-life-eyebrow','PAGERO GUIDE');
    const title=appendText(copy,'h2','','페이지를 만든 다음, 접수까지 확인하세요');
    title.id='c63-guide-title';
    appendText(copy,'p','','상담·방문 예약·이벤트 신청 화면을 만들고 실제 접수를 확인하는 순서를 정리했습니다. 가입 없이 볼 수 있는 설명서와 무료 도구입니다.');
    head.appendChild(copy);
    const link=document.createElement('a');link.href='/guide/';link.className='c63-life-more';link.textContent='공식 설명서 전체 보기';
    head.appendChild(link);
    const grid=document.createElement('div');grid.className='c63-guide-grid';
    for(const [number,name,detail,url,linkLabel] of CARDS){
      const item=document.createElement('article');item.className='c63-guide-card';
      appendText(item,'span','c63-guide-number',number);
      appendText(item,'h3','',name);
      appendText(item,'p','',detail);
      const action=document.createElement('a');action.href=url;action.textContent=linkLabel;
      item.appendChild(action);grid.appendChild(item);
    }
    const info=document.createElement('p');info.className='c63-guide-note';
    info.append('실제 데이터를 보내기 전 ',Object.assign(document.createElement('a'),{href:'/guide/landing-page-prelaunch/',textContent:'발행 전 점검표'}),'를 확인하세요. 신청폼 구성안은 예시이며 실제 수집 목적과 운영 조건에 맞게 검토해야 합니다.');
    inner.append(head,grid,info);section.appendChild(inner);return section;
  }
  const install=()=>{
    const home=document.querySelector('#root .pagero-exact-home');
    if(!home)return;
    const footer=home.querySelector('footer');
    if(!home.querySelector('.c63-guide-bridge')){
      home.insertBefore(createGuideSection(),home.querySelector('.c63-life-bridge') || footer || null);
    }
    const footerLinks=home.querySelector('.footer-links');
    if(footerLinks&&!footerLinks.querySelector('a[href="/guide/"]')){
      const a=document.createElement('a');a.href='/guide/';a.textContent='공식 사용 가이드';footerLinks.appendChild(a);
    }
    if(footerLinks&&!footerLinks.querySelector('a[href="/tools/form-planner/"]')){
      const a=document.createElement('a');a.href='/tools/form-planner/';a.textContent='신청폼 설계 도구';footerLinks.appendChild(a);
    }
  };
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;install();});};
  const init=()=>{
    const root=document.getElementById('root');
    if(!root)return;
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
    schedule();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
