// Full-text search over public, reviewed PageRo guides; no tracking or external API.
export function normalizeQuery(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
}
const aliases={
  '엑셀':['csv','다운로드'], '엑셀파일':['csv'], '고객':['접수','문의'], '신청':['상담','폼','접수'],
  '전화':['연락처'], '휴대폰':['연락처','모바일'], '홈페이지':['랜딩페이지','페이지'],
  '검색':['seo','메타'], '색인':['seo','검색'], '검색엔진':['seo'],
  '출시':['발행'], '게시':['발행'], '업로드':['이미지','미디어'],
  'db':['접수함','폼'], '리드':['문의','접수'], '픽셀':['추적','전환'],
  '방문자':['조회','유입'], '전환율':['전환','통계'],
  '휴대전화':['연락처'], '공유':['공유 이미지','링크'], '수정':['편집','발행'],
  '예약':['방문 예약'], '추적':['광고','전환']
};
const variants=term=>[term,...(aliases[term]||[])].map(normalizeQuery);
function score(doc, groups) {
 const title=normalizeQuery(doc.title),desc=normalizeQuery(doc.description);
 const headings=(doc.headings||[]).map(normalizeQuery),body=normalizeQuery(doc.body||'');
 let points=0,bestText='';
 for(const group of groups){
  let best=0,line='';
  for(const term of group){
   if(title.includes(term) && best<30){best=30;line=doc.title;}
   if(desc.includes(term) && best<16){best=16;line=doc.description;}
   headings.forEach((heading,i)=>{if(heading.includes(term)&&best<20){best=20;line=doc.headings[i];}});
   if(body.includes(term) && best<6){
      best=6;
      const where=body.indexOf(term);
      line=(where>80?'…':'')+(doc.body||'').slice(Math.max(0,where-70),Math.min((doc.body||'').length,where+135))+'…';
   }
  }
  if(!best)return null;
  points+=best;
  if(!bestText||best>=16)bestText=line;
 }
 const complete=groups.map(g=>g[0]).join(' ');
 if(title.includes(complete))points+=12;
 return {...doc,score:points,matchText:bestText||doc.description};
}
export function rankManuals(docs, query, category='전체'){
 const normalized=normalizeQuery(query);
 const tokens=normalized?normalized.split(' ').filter(Boolean).map(variants):[];
 return (Array.isArray(docs)?docs:[])
   .filter(doc=>category==='전체'||doc.category===category)
   .map(doc=>tokens.length?score(doc,tokens):{...doc,score:0,matchText:doc.description})
   .filter(Boolean)
   .sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ko'));
}
