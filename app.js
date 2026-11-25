// S: [num, ar, en, meaning, place(majority), ayat, juz, words, letters, makkiCount, nonMakkiCount]
// V: [surah, ayah, juz, diacritics, clean, english, x, y, z, placeCode]
const PLACES=['مكية','مدنية','نزلت بين مكة والمدينة','نزلت بالجحفة'];
const PCOL=()=>[css('--mk'),css('--md'),'#7b5cc4','#d2453a'];
const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const toAr=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SP={};S.forEach(s=>SP[s[0]]=s);

// ---------- Arabic normalisation with index map ----------
const DIAC=/[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
function normChar(c,full){
  if(full){
    if('أإآٱ'.includes(c))return 'ا';
    if(c==='ى')return 'ي';
    if(c==='ة')return 'ه';
    if(c==='ؤ')return 'و';
    if(c==='ئ')return 'ي';
  }else if(c==='ٱ')return 'ا';
  return c.toLowerCase();
}
function normalize(str,full){
  let out='',map=[];
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(DIAC.test(c))continue;
    out+=normChar(c,full);map.push(i);
  }
  return {s:out,map};
}
function normQ(q,full){return normalize(q.trim().replace(/\s+/g,' '),full).s}
const NC={0:null,1:null};
function normAll(full){
  const k=full?1:0;
  if(!NC[k])NC[k]=V.map(v=>normalize(v[3],full));
  return NC[k];
}
const isAr=s=>/[؀-ۿ]/.test(s);
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const B='(?:^|(?<=[\\s]))', E='(?=$|[\\s])';

function search(q,mode,full){
  const ar=isAr(q);
  const nq=ar?normQ(q,full):q.trim().toLowerCase();
  if(!nq)return null;
  let res;
  const terms=nq.split(' ').filter(Boolean);
  let rx;
  if(mode==='word')rx=new RegExp(B+reEsc(nq)+E,ar?'g':'gi');
  else if(mode==='start')rx=new RegExp(B+reEsc(nq),ar?'g':'gi');
  else if(mode==='all')rx=new RegExp(terms.map(reEsc).join('|'),ar?'g':'gi');
  else rx=new RegExp(reEsc(nq),ar?'g':'gi');
  if(!ar&&(mode==='word'))rx=new RegExp('\\b'+reEsc(nq)+'\\b','gi');
  if(!ar&&(mode==='start'))rx=new RegExp('\\b'+reEsc(nq),'gi');
  const fs=+$('fs').value,fj=+$('fj').value,fp=$('fp').value;
  const N=ar?normAll(full):null;
  res=[];let occ=0;
  for(let i=0;i<V.length;i++){
    const v=V[i];
    if(fs&&v[0]!==fs)continue;
    if(fj&&v[2]!==fj)continue;
    if(fp!==''&&v[9]!==+fp)continue;
    const hay=ar?N[i].s:v[5];
    if(mode==='all'){
      const low=ar?hay:hay.toLowerCase();
      if(!terms.every(t=>low.includes(t)))continue;
    }
    rx.lastIndex=0;const spans=[];let m;
    while((m=rx.exec(hay))){if(!m[0].length){rx.lastIndex++;continue}spans.push([m.index,m.index+m[0].length])}
    if(!spans.length)continue;
    occ+=spans.length;res.push({i,spans,ar});
  }
  return {res,occ,ar};
}
function highlight(v,r){
  if(r.toks)return {ar:tokHL(r.i,r.toks),en:esc(v[5])};
  if(!r.ar)return {ar:esc(v[3]),en:hlSpans(v[5],r.spans)};
  const map=normAll($('norm').checked)[r.i].map,txt=v[3];
  const os=r.spans.map(([a,b])=>{
    let s=map[a],e=map[b-1]+1;
    while(e<txt.length&&DIAC.test(txt[e]))e++;
    return [s,e]});
  return {ar:hlSpans(txt,os),en:esc(v[5])};
}
function hlSpans(t,sp){
  let o='',p=0;sp.slice().sort((a,b)=>a[0]-b[0]).forEach(([a,b])=>{if(a<p)return;o+=esc(t.slice(p,a))+'<mark>'+esc(t.slice(a,b))+'</mark>';p=b});
  return o+esc(t.slice(p));
}


// ---------- morphology (Quranic Arabic Corpus, improved edition) ----------
// R roots, L lemmas, LB labels, VW per verse: [[tokenIdx, tokenSpan, rootId, lemmaId, labelId], ...], RM root maps
const RSTAT=R.map(()=>({occ:0,vs:new Set(),lem:new Map()}));
const LSTAT=L.map(()=>({occ:0,root:-1,lab:new Map()}));
VW.forEach((ws,vi)=>ws.forEach(w=>{
  if(w[2]>=0){const r=RSTAT[w[2]];r.occ++;r.vs.add(vi);if(w[3]>=0)r.lem.set(w[3],(r.lem.get(w[3])||0)+1)}
  if(w[3]>=0){const l=LSTAT[w[3]];l.occ++;if(w[2]>=0)l.root=w[2];l.lab.set(w[4],(l.lab.get(w[4])||0)+1)}
}));
const topLab=l=>{let b=-1,n=-1;LSTAT[l].lab.forEach((c,k)=>{if(c>n){n=c;b=k}});return (LB[b]||'').replace(/ (ماض|مضارع|أمر)(?= |$)/,'').replace(' مبني للمجهول','')};
const spaced=r=>[...r].join(' ');
const RN=R.map(r=>normalize(r,true).s), LN=L.map(l=>normalize(l,true).s);
const EMPTY=new Set(RM.empty);
let LEMF=null;
function findIds(q,kind){
  if(kind==='lemma'){const ex=[];const t=q.trim();L.forEach((x,i)=>{if(x===t)ex.push(i)});if(ex.length)return ex}
  const nq=normalize(q.replace(/\s+/g,''),true).s;if(!nq)return [];
  const arr=kind==='root'?RN:LN,out=[];arr.forEach((x,i)=>{if(x===nq)out.push(i)});return out;
}
function suggest(q,kind){
  const nq=normalize(q.replace(/\s+/g,''),true).s,arr=kind==='root'?RN:LN,raw=kind==='root'?R:L;
  const c=[];arr.forEach((x,i)=>{if(nq&&(x.startsWith(nq)||nq.startsWith(x)&&x.length>=2))c.push(i)});
  const st=kind==='root'?RSTAT:LSTAT;
  return c.sort((a,b)=>st[b].occ-st[a].occ).slice(0,10).map(i=>`<span class="chip" data-go${kind==='root'?'root':'lem'}="${i}">${kind==='root'?spaced(raw[i]):raw[i]}</span>`).join('');
}
function morphSearch(q,kind){
  const ids=new Set(findIds(q,kind));
  if(!ids.size)return {res:[],occ:0,ids:[],kind,byLem:new Map()};
  const fs=+$('fs').value,fj=+$('fj').value,fp=$('fp').value;
  const res=[],byLem=new Map();let occ=0;
  for(let i=0;i<V.length;i++){
    const v=V[i];
    if(fs&&v[0]!==fs)continue;if(fj&&v[2]!==fj)continue;if(fp!==''&&v[9]!==+fp)continue;
    const toks=new Set();let n=0;
    for(const w of VW[i]){
      if(!ids.has(kind==='root'?w[2]:w[3]))continue;
      byLem.set(w[3],(byLem.get(w[3])||0)+1);
      if(LEMF!==null&&w[3]!==LEMF)continue;
      n++;if(w[0]>=0)for(let t=0;t<w[1];t++)toks.add(w[0]+t);
    }
    if(!n)continue;occ+=n;res.push({i,toks,n,ar:true});
  }
  return {res,occ,ids:[...ids],kind,byLem,ar:true};
}
function tokHL(vi,set){
  return V[vi][3].trim().split(/\s+/).map((t,ti)=>{const h=`<span class="w" data-vi="${vi}" data-ti="${ti}">${esc(t)}</span>`;return set&&set.has(ti)?`<mark>${h}</mark>`:h}).join(' ');
}
function renderBreakdown(r){
  const b=$('breakdown');
  if(!r||!r.kind){b.style.display='none';return}
  b.style.display='block';
  if(!r.ids.length){
    b.innerHTML=`<div>لم يُعثر على ${r.kind==='root'?'جذر':'مدخل معجمي'} «${esc($('q').value)}». ${r.kind==='root'?'اكتب حروف الجذر الأصلية، مثل: قطع، رحم، سمو، قول.':'اكتب الكلمة بصيغتها المعجمية، مثل: قَطَّعَ، رَحْمَة، كِتاب. أسهل طريقة: ابحث بالجذر ثم اضغط على الصيغة.'}</div><div class="chips">${suggest($('q').value,r.kind)}</div>`;return}
  let head;
  if(r.kind==='root')head=r.ids.map(id=>`<span class="rootl">${spaced(R[id])}</span> <span class="muted">في القرآن كله: ${toAr(RSTAT[id].occ)} موضعاً في ${toAr(RSTAT[id].vs.size)} آية · عدد الصيغ: ${toAr(RSTAT[id].lem.size)}</span>`).join('<br>');
  else head=r.ids.map(id=>`<b style="font-size:20px">${L[id]}</b> <span class="muted">${topLab(id)} · الجذر ${LSTAT[id].root>=0?`<span class="chip" data-goroot="${LSTAT[id].root}">${spaced(R[LSTAT[id].root])}</span>`:'—'} · ${toAr(LSTAT[id].occ)} موضعاً</span>`).join('<br>');
  const chips=[...r.byLem.entries()].sort((a,b)=>b[1]-a[1]).map(([l,n])=>`<span class="chip ${LEMF===l?'on':''}" data-lem="${l}">${l>=0?L[l]:'—'} <small>${l>=0?topLab(l):''} · ${toAr(n)}</small></span>`).join('');
  b.innerHTML=head+(r.byLem.size>1?`<div class="muted" style="margin-top:6px">الصيغ${LEMF!==null?' (مُصفّاة — اضغط الصيغة مرة أخرى لإلغاء التصفية)':' — اضغط على صيغة لعرض مواضعها وحدها'}:</div><div class="chips">${chips}</div>`:'');
}
function goRoot(id){$('mode').value='root';modeUI();$('q').value=R[id];LEMF=null;closePop();location.hash='search';show('search');runSearch();window.scrollTo(0,0)}
function goLem(id){$('mode').value='lemma';modeUI();$('q').value=L[id];LEMF=findIds(L[id],'lemma').length>1?id:null;closePop();location.hash='search';show('search');runSearch();window.scrollTo(0,0)}
function modeUI(){
  const m=$('mode').value;
  if(m==='root'){$('q').setAttribute('list','rootsList');$('q').placeholder='اكتب الجذر: قطع، رحم، صبر، ق ط ع…'}
  else{$('q').removeAttribute('list');$('q').placeholder=m==='lemma'?'اكتب الكلمة بصيغتها المعجمية: قَطَعَ، رَحْمَة…':'اكتب كلمة أو عبارة… مثل: الصبر، يا أيها الذين آمنوا، mercy'}
}
// word analysis popup
function closePop(){$('wpop').style.display='none'}
function showWord(vi,ti){
  const ws=VW[vi].filter(w=>w[0]>=0&&ti>=w[0]&&ti<w[0]+w[1]),v=V[vi],p=$('wpop');
  const tok=v[3].trim().split(/\s+/)[ti]||'';
  p.innerHTML=`<div class="row" style="justify-content:space-between"><span class="ar" style="font-size:26px">${esc(tok)}</span><button class="ghost" id="wclose">إغلاق</button></div>
  <div class="muted">${SP[v[0]][1]} ${toAr(v[0])}:${toAr(v[1])}</div>`+
  (ws.length?ws.map(w=>`<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px">
   <div>النوع: <b>${LB[w[4]]}</b></div>
   ${w[2]>=0?`<div>الجذر: <span class="rootl" style="font-size:18px">${spaced(R[w[2]])}</span> <span class="muted">(${toAr(RSTAT[w[2]].occ)} موضعاً)</span><br><button class="ghost" data-goroot="${w[2]}">كل مواضع الجذر</button></div>`:'<div class="muted">لا جذر مسجّل لهذه الكلمة (حرف أو ضمير أو اسم علم).</div>'}
   ${w[3]>=0?`<div style="margin-top:4px">المدخل المعجمي: <b>${L[w[3]]}</b> <span class="muted">(${toAr(LSTAT[w[3]].occ)} موضعاً)</span> <button class="ghost" data-golem="${w[3]}">مواضعه</button></div>`:''}
  </div>`).join(''):'<div class="muted">لا يوجد تحليل صرفي لهذه الكلمة (علامة وقف).</div>');
  p.style.display='block';
}
// roots tab
let RLIM=240;
function drawRoots(){
  const q=normalize($('rq').value.replace(/\s+/g,''),true).s,so=$('rsort').value;
  let ids=R.map((_,i)=>i).filter(i=>!q||RN[i].includes(q));
  if(so==='occ')ids.sort((a,b)=>RSTAT[b].occ-RSTAT[a].occ);
  if(so==='verses')ids.sort((a,b)=>RSTAT[b].vs.size-RSTAT[a].vs.size);
  if(so==='lem')ids.sort((a,b)=>RSTAT[b].lem.size-RSTAT[a].lem.size);
  if(so==='alpha')ids.sort((a,b)=>R[a].localeCompare(R[b],'ar'));
  $('rgrid').innerHTML=ids.slice(0,RLIM).map(i=>`<div class="sc" data-goroot="${i}"><div class="rootl">${spaced(R[i])}</div><div class="muted">${toAr(RSTAT[i].occ)} موضعاً · ${toAr(RSTAT[i].vs.size)} آية · صيغ: ${toAr(RSTAT[i].lem.size)}</div></div>`).join('')
   +(ids.length>RLIM?`<button class="ghost more" id="rmore" style="grid-column:1/-1">عرض المزيد (${toAr(ids.length-RLIM)})</button>`:'')
   +(!ids.length?'<div class="muted">لا يوجد جذر بهذه الحروف.</div>':'');
}

// ---------- search UI ----------
let LAST=null,SHOWN=0;
function fillSelects(){
  S.forEach(s=>{for(const id of['fs','ms']){const o=document.createElement('option');o.value=s[0];o.textContent=toAr(s[0])+' — '+s[1];$(id).appendChild(o)}});
  for(let j=1;j<=30;j++){const o=document.createElement('option');o.value=j;o.textContent='الجزء '+toAr(j);$('fj').appendChild(o)}
}
function runSearch(){
  const q=$('q').value,mode=$('mode').value,morph=mode==='root'||mode==='lemma';
  const r=morph?(q.trim()?morphSearch(q,mode):null):search(q,mode,$('norm').checked);
  renderBreakdown(morph?r:null);
  LAST=r;SHOWN=0;
  if(!r){$('stats').innerHTML='';$('results').style.display='none';$('barwrap').style.display='none';return}
  const su=new Set(r.res.map(x=>V[x.i][0]));
  $('stats').innerHTML=`<div class="stat"><b>${toAr(r.res.length)}</b><span>آية</span></div><div class="stat"><b>${toAr(r.occ)}</b><span>مرة وردت المطابقة</span></div><div class="stat"><b>${toAr(su.size)}</b><span>سورة</span></div>`;
  $('results').style.display='block';$('results').innerHTML='';
  if(!r.res.length){$('results').innerHTML=morph?'<div class="muted">لا توجد نتائج بهذه التصفية.</div>':'<div class="muted">لا توجد نتائج. جرّب «جزء من كلمة» أو البحث بالجذر، أو فعّل توحيد الهمزات.</div>';$('barwrap').style.display='none';return}
  more();drawBar(r);
}
function more(){
  const box=$('results');const old=box.querySelector('.more');if(old)old.remove();
  const en=$('showEn').checked;
  const part=LAST.res.slice(SHOWN,SHOWN+150);
  box.insertAdjacentHTML('beforeend',part.map(r=>{const v=V[r.i],h=highlight(v,r);
    return `<div class="res"><span class="ref" data-s="${v[0]}" data-a="${v[1]}">${SP[v[0]][1]} ${toAr(v[0])}:${toAr(v[1])}</span> <span class="muted">· الجزء ${toAr(v[2])} · ${PLACES[v[9]]}</span><div class="ar">${h.ar}</div>${(en||!r.ar)?`<div class="en">${h.en}</div>`:''}</div>`}).join(''));
  SHOWN+=part.length;
  if(SHOWN<LAST.res.length){const b=document.createElement('button');b.className='ghost more';b.textContent=`عرض المزيد (${toAr(LAST.res.length-SHOWN)} متبقية)`;b.onclick=more;box.appendChild(b)}
}
function drawBar(r){
  $('barwrap').style.display='block';
  const cnt={};r.res.forEach(x=>{const s=V[x.i][0];cnt[s]=(cnt[s]||0)+(x.spans?x.spans.length:x.n)});
  const ks=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  if(!window.Plotly)return;
  Plotly.react('bar',[{type:'bar',x:ks.map(k=>k),y:ks.map(k=>cnt[k]),text:ks.map(k=>SP[k][1]),
    hovertemplate:'%{text} (%{x})<br>%{y} مرة<extra></extra>',marker:{color:ks.map(k=>SP[k][4]==='مكية'?css('--mk'):css('--md'))}}],
    baseLayout({title:{text:'التوزيع على السور',font:{size:14}},xaxis:{title:'رقم السورة',range:[0,115]},yaxis:{title:'عدد المرات'},margin:{t:40,l:50,r:20,b:40}}),{displaylogo:false,responsive:true});
  $('bar').on('plotly_click',e=>{const s=e.points[0].x;$('fs').value=s;runSearch()});
}
function baseLayout(o){return Object.assign({paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:'Noto Naskh Arabic, Tahoma',color:css('--ink')}},o)}

// ---------- surahs ----------
const excN=s=>s[4]==='مكية'?s[10]:s[9];
function excTxt(n){
  const g={};V.forEach(v=>{if(v[0]===n&&PLACES[v[9]]!==SP[n][4])(g[v[9]]=g[v[9]]||[]).push(toAr(v[1]))});
  const k=Object.keys(g);return k.length?'مستثناة: '+k.map(c=>PLACES[c]+' ('+g[c].join('، ')+')').join(' · ')+' · ':'';
}
const pst=v=>PLACES[v[9]]!==SP[v[0]][4]?`style="color:${PCOL()[v[9]]};font-weight:700" title="${PLACES[v[9]]}"`:'';
function drawGrid(){
  const q=$('sq').value.trim(),p=$('sp').value,so=$('sort').value;
  const nq=normQ(q,true);
  let L=S.filter(s=>(!p||s[4]===p)&&(!q||normalize(s[1],true).s.includes(nq)||s[2].toLowerCase().includes(q.toLowerCase())||String(s[0])===q));
  if(so==='ayat')L.sort((a,b)=>b[5]-a[5]);if(so==='words')L.sort((a,b)=>b[7]-a[7]);
  $('sgrid').innerHTML=L.map(s=>`<div class="sc" data-s="${s[0]}"><span class="n">${toAr(s[0])}</span><div class="t">${s[1]}</div><div class="muted">${s[2]} · ${esc(s[3])}</div><span class="tag ${s[4]==='مكية'?'mk':'md'}">${s[4]}</span>${excN(s)?` <span class="muted" title="آيات تصنيفها مختلف عن تصنيف السورة">+${toAr(excN(s))} مستثناة</span>`:''} <span class="muted">${toAr(s[5])} آية · ${toAr(s[7])} كلمة</span></div>`).join('');
}
function openSurah(n,ayah){
  location.hash='surahs';show('surahs');
  const s=SP[n];const vis=[];V.forEach((v,i)=>{if(v[0]===n)vis.push(i)});
  const r=$('reader');r.style.display='block';
  r.innerHTML=`<div class="row" style="justify-content:space-between"><h2 style="margin:0">سورة ${s[1]} <span class="muted">(${toAr(n)}) · ${s[2]} · ${esc(s[3])}</span></h2>
  <div class="row"><label><input type="checkbox" id="rEn"> الترجمة</label><button class="ghost" id="rMap">على الخريطة</button><button class="ghost" id="rS">بحث داخل السورة</button></div></div>
  <div class="muted">${s[4]} (حسب أغلب آياتها) · ${excTxt(n)}${toAr(s[5])} آية · الجزء ${toAr(s[6])} · ${toAr(s[7])} كلمة · ${toAr(s[8])} حرفاً</div>
  <div class="muted" style="margin-top:8px">أبرز جذور السورة (الأكثر تميّزاً لها مقارنة بباقي القرآن):</div>
  <div class="chips">${RM.stop[n-1].map(id=>`<span class="chip" data-goroot="${id}">${spaced(R[id])}</span>`).join('')}</div>
  <div class="muted">أقرب السور إليها بالجذور المشتركة:</div>
  <div class="chips">${RM.snn[n-1].map((x,k)=>`<span class="chip" data-s="${x}">${SP[x][1]} <small>${toAr(Math.round(RM.snn_sim[n-1][k]*100))}٪</small></span>`).join('')}</div>
  <div class="muted">اضغط على أي كلمة لعرض جذرها وصيغتها ونوعها.</div>
  <div id="rBody" class="ar" style="margin-top:10px"></div>`;
  const body=()=>{const en=$('rEn').checked;$('rBody').innerHTML=vis.map(vi=>{const v=V[vi];return en?`<div id="a${v[1]}" style="margin-bottom:8px">${tokHL(vi)} <span class="num" ${pst(v)}>﴿${toAr(v[1])}﴾</span><div class="en">${esc(v[5])}</div></div>`:`<span id="a${v[1]}" class="ayah">${tokHL(vi)} <span class="num" ${pst(v)}>﴿${toAr(v[1])}﴾</span> </span>`}).join('')};
  body();$('rEn').onchange=body;
  $('rMap').onclick=()=>{$('ms').value=n;location.hash='map'};
  $('rS').onclick=()=>{$('fs').value=n;location.hash='search';$('q').focus()};
  setTimeout(()=>{const el=ayah?document.getElementById('a'+ayah):r;if(el){el.scrollIntoView({behavior:'smooth',block:'center'});if(ayah)el.style.background='var(--hit)'}},50);
}

// ---------- verse map ----------
let HL=null;
const PAL=n=>`hsl(${(n*137.508)%360},62%,50%)`;
const P=i=>$('msrc').value==='roots'?RM.vxyz[i]:[V[i][6],V[i][7],V[i][8]];
function drawMap(){
  if(!window.Plotly){$('vmap').innerHTML='<div class="muted" style="padding:20px">تعذّر تحميل مكتبة الرسم (Plotly).</div>';return}
  const only=+$('ms').value,cm=$('mc').value;
  const rs=$('msrc').value==='roots';
  const idx=[];for(let i=0;i<V.length;i++)if((!only||V[i][0]===only)&&!(rs&&EMPTY.has(i)))idx.push(i);
  const col=i=>{const v=V[i];if(cm==='place')return SP[v[0]][4]==='مكية'?css('--mk'):css('--md');if(cm==='juz')return `hsl(${v[2]*12},60%,50%)`;return PAL(v[0])};
  const txt=i=>{const v=V[i];return `${SP[v[0]][1]} ${v[0]}:${v[1]} · ${PLACES[v[9]]}<br>${wrap(v[4])}`};
  const traces=[];
  const hs=HL?new Set(HL):null;
  const base=hs?idx.filter(i=>!hs.has(i)):idx;
  if(cm==='place'&&!hs){
    PLACES.forEach((nm,c)=>{const g=idx.filter(i=>V[i][9]===c);if(!g.length)return;
      traces.push({type:'scatter3d',mode:'markers',name:`${nm} (${g.length})`,x:g.map(i=>P(i)[0]),y:g.map(i=>P(i)[1]),z:g.map(i=>P(i)[2]),customdata:g,text:g.map(txt),hovertemplate:'%{text}<extra></extra>',
        marker:{size:c>=2?7:(only?5:3),opacity:c>=2?1:0.8,color:PCOL()[c]}})});
  }else
  traces.push({type:'scatter3d',mode:'markers',name:hs?'باقي الآيات':'الآيات',x:base.map(i=>P(i)[0]),y:base.map(i=>P(i)[1]),z:base.map(i=>P(i)[2]),customdata:base,
    text:base.map(txt),hovertemplate:'%{text}<extra></extra>',marker:{size:hs?2:(only?5:3),opacity:hs?0.18:0.8,color:hs?'#999':base.map(col)}});
  if(hs){const h=idx.filter(i=>hs.has(i));traces.push({type:'scatter3d',mode:'markers',name:'نتائج البحث',x:h.map(i=>P(i)[0]),y:h.map(i=>P(i)[1]),z:h.map(i=>P(i)[2]),customdata:h,text:h.map(txt),hovertemplate:'%{text}<extra></extra>',marker:{size:5,color:'#e0452b',opacity:0.95}})}
  const ax={showbackground:false,showticklabels:false,title:'',showgrid:true,gridcolor:css('--line'),zeroline:false};
  Plotly.react('vmap',traces,baseLayout({margin:{l:0,r:0,t:0,b:0},showlegend:!!hs||cm==='place',legend:{x:0,y:1,font:{size:14}},scene:{xaxis:ax,yaxis:ax,zaxis:ax},hoverlabel:{font:{family:'Noto Naskh Arabic',size:15}}}),{displaylogo:false,responsive:true});
  $('vmap').removeAllListeners&&$('vmap').removeAllListeners('plotly_click');
  $('vmap').on('plotly_click',e=>pickVerse(e.points[0].customdata));
  $('clearHl').style.display=hs?'':'none';
  $('mapNote').textContent=hs?`مميّز باللون الأحمر: ${HL.length} آية من نتائج البحث «${$('q').value}».`:(rs?'كل نقطة آية. الآيات التي تشترك في جذور أكثر (خاصة الجذور النادرة) تقع متقاربة. محسوبة من النص العربي فقط. استُبعدت ٢٢ آية من الحروف المقطعة لا جذور فيها.':'كل نقطة آية. التقارب هنا محسوب من الترجمة الإنجليزية بنموذج OpenAI (مشروع QuranGPT).')+' اسحب للتدوير، واضغط على نقطة لقراءة الآية.';
}
function wrap(t){const w=t.split(' ');let o='',l='';w.forEach(x=>{if((l+x).length>45){o+=l+'<br>';l=''}l+=x+' '});return o+l}
function dist(a,b){return Math.hypot(V[a][6]-V[b][6],V[a][7]-V[b][7],V[a][8]-V[b][8])}
function pickVerse(i){
  const v=V[i],rs=$('msrc').value==='roots';
  const near=rs?RM.vnn[i].map((j,k)=>({j,sim:RM.vnn_sim[i][k]})):V.map((_,j)=>j).filter(j=>j!==i).sort((a,b)=>dist(i,a)-dist(i,b)).slice(0,8).map(j=>({j}));
  const mine=new Set(VW[i].map(w=>w[2]).filter(x=>x>=0));
  const p=$('pick');p.style.display='block';
  p.innerHTML=`<span class="ref" data-s="${v[0]}" data-a="${v[1]}">${SP[v[0]][1]} ${toAr(v[0])}:${toAr(v[1])} ← افتح في السورة</span> <span class="muted">· ${PLACES[v[9]]}</span><div class="ar">${tokHL(i)}</div><div class="en">${esc(v[5])}</div>
  <h3 style="margin:12px 0 4px;font-size:16px">${rs?'أقرب الآيات إليها بالجذور المشتركة':'أقرب الآيات إليها على خريطة QuranGPT'}</h3>`+near.map(({j,sim})=>{const w=V[j];
    const shared=rs?[...new Set(VW[j].map(x=>x[2]).filter(x=>x>=0&&mine.has(x)))]:[];
    return `<div class="res"><span class="ref" data-s="${w[0]}" data-a="${w[1]}">${SP[w[0]][1]} ${toAr(w[0])}:${toAr(w[1])}</span>${rs?` <span class="muted">· تشابه ${toAr(Math.round(sim*100))}٪</span>`:''}<div class="ar" style="font-size:19px">${tokHL(j)}</div>${shared.length?`<div class="chips"><small class="muted">جذور مشتركة:</small> ${shared.map(id=>`<span class="chip" data-goroot="${id}">${spaced(R[id])}</span>`).join('')}</div>`:''}</div>`}).join('');
  p.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ---------- surah map ----------
function drawSurahMap(){
  if(!window.Plotly)return;
  const t=$('smt').value;
  const C={};V.forEach(v=>{const c=C[v[0]]||(C[v[0]]=[0,0,0,0]);c[0]+=v[6];c[1]+=v[7];c[2]+=v[8];c[3]++});
  const col=S.map(s=>s[4]==='مكية'?css('--mk'):css('--md'));
  const sz=S.map(s=>6+Math.sqrt(s[5])*2.2);
  const text=S.map(s=>`${s[1]} (${s[0]})<br>${s[2]}<br>${s[4]} · ${s[5]} آية<br>آيات مكية: ${s[9]} · غير مكية: ${s[10]}`);
  let tr,lay;
  if(t==='centroid'||t==='rroots'){
    const Q3=t==='rroots'?(s=>RM.sxyz[s[0]-1]):(s=>[C[s[0]][0]/C[s[0]][3],C[s[0]][1]/C[s[0]][3],C[s[0]][2]/C[s[0]][3]]);
    tr=[{type:'scatter3d',mode:'markers+text',x:S.map(s=>Q3(s)[0]),y:S.map(s=>Q3(s)[1]),z:S.map(s=>Q3(s)[2]),
      text:S.map(s=>s[1]),hovertext:text,hoverinfo:'text',customdata:S.map(s=>s[0]),textfont:{size:11,color:css('--ink')},marker:{size:sz.map(x=>x/1.6),color:col,opacity:0.85}}];
    const ax={showbackground:false,showticklabels:false,title:'',gridcolor:css('--line'),zeroline:false};
    lay=baseLayout({margin:{l:0,r:0,t:0,b:0},scene:{xaxis:ax,yaxis:ax,zaxis:ax}});
  }else{
    tr=[{type:'scatter',mode:'markers',x:S.map(s=>s[0]),y:S.map(s=>s[5]),hovertext:text,hoverinfo:'text',customdata:S.map(s=>s[0]),marker:{size:sz,color:col,opacity:0.8,line:{width:0}}}];
    lay=baseLayout({margin:{l:60,r:20,t:20,b:50},xaxis:{title:'ترتيب المصحف',gridcolor:css('--line')},yaxis:{title:'عدد الآيات (لوغاريتمي)',type:'log',gridcolor:css('--line')}});
  }
  Plotly.react('smap',tr,lay,{displaylogo:false,responsive:true});
  $('smap').removeAllListeners&&$('smap').removeAllListeners('plotly_click');
  $('smap').on('plotly_click',e=>openSurah(e.points[0].customdata));
}

// ---------- routing ----------
const VIEWS=['search','surahs','roots','map','surah-map'];
function show(v){
  VIEWS.forEach(x=>{$('v-'+x).classList.toggle('on',x===v)});
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='map')drawMap();if(v==='roots')drawRoots();if(v==='surah-map')drawSurahMap();
}
function route(){const h=location.hash.slice(1);show(VIEWS.includes(h)?h:'search');window.scrollTo(0,0)}
window.addEventListener('hashchange',route);

document.addEventListener('click',e=>{
  const t=e.target;
  if(t.id==='wclose'){closePop();return}
  if(t.id==='rmore'){RLIM+=480;drawRoots();return}
  const gr=t.closest('[data-goroot]');if(gr){goRoot(+gr.dataset.goroot);return}
  const gl=t.closest('[data-golem]');if(gl){goLem(+gl.dataset.golem);return}
  const lc=t.closest('[data-lem]');if(lc){const l=+lc.dataset.lem;LEMF=LEMF===l?null:l;runSearch();return}
  const w=t.closest('.w');if(w){showWord(+w.dataset.vi,+w.dataset.ti);return}
  const r=t.closest('.ref');if(r){openSurah(+r.dataset.s,+r.dataset.a);return}
  const c=t.closest('.sc[data-s],.chip[data-s]');if(c)openSurah(+c.dataset.s);
});
$('sf').addEventListener('submit',e=>{e.preventDefault();LEMF=null;runSearch()});
$('mode').addEventListener('change',()=>{LEMF=null;modeUI()});
['rq','rsort'].forEach(id=>$(id).addEventListener('input',()=>{RLIM=240;drawRoots()}));
$('msrc').addEventListener('change',()=>{$('pick').style.display='none';drawMap()});
$('rootsList').innerHTML=R.map(r=>`<option value="${r}">`).join('');
['mode','fs','fj','fp','norm','showEn'].forEach(id=>$(id).addEventListener('change',()=>{if($('q').value.trim())runSearch()}));
['sq','sort','sp'].forEach(id=>$(id).addEventListener('input',drawGrid));
['ms','mc'].forEach(id=>$(id).addEventListener('change',drawMap));
$('smt').addEventListener('change',drawSurahMap);
$('toMap').onclick=()=>{HL=LAST.res.map(r=>r.i);$('ms').value=0;location.hash='map';if(location.hash==='#map')drawMap()};
$('clearHl').onclick=()=>{HL=null;drawMap()};
fillSelects();drawGrid();modeUI();route();
document.getElementById('splash').classList.add('gone');
