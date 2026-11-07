/** Client-only printable report. The browser's Save as PDF preserves JP/EN glyphs
 * and selectable text. No third-party scripts or data upload. */
const T={ja:{title:'需要予測・在庫リスク分析レポート',total:'対象商品',baseline:'基準需要（日次）',sigma:'残差標準偏差',ltmean:'リードタイム需要平均',ltsd:'リードタイム需要標準偏差',safety:'安全在庫',reorder:'推奨発注点',risk:'在庫切れ確率',p90:'90%点',p95:'95%点',p99:'99%点',z:'直近の乖離（σ）',runs:'試行回数',details:'系列別の分析結果',limit:'この結果は独立した日次需要・固定リードタイム等の仮定に基づく推計値であり、実際の欠品を保証しません。',save:'印刷画面の保存先で「PDFに保存」を選択してください。'},en:{title:'Demand forecast & inventory risk report',total:'Product',baseline:'Daily forecast baseline',sigma:'Residual SD',ltmean:'Mean lead-time demand',ltsd:'Lead-time demand SD',safety:'Safety stock',reorder:'Reorder point',risk:'Stockout probability',p90:'P90',p95:'P95',p99:'P99',z:'Latest deviation (σ)',runs:'Simulation runs',details:'Results by series',limit:'Estimates assume independent daily demand and fixed lead time; no stockout guarantee.',save:'In the print dialog, select Save as PDF as your destination.'}};
const n=(v,loc)=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat(loc==='ja'?'ja-JP':'en-US',{maximumFractionDigits:2}).format(v);
function cell(tag,text){const el=document.createElement(tag);el.textContent=String(text);return el}
function tableFor(columns,rows){const table=document.createElement('table');const tr=document.createElement('tr');columns.forEach(x=>tr.append(cell('th',x)));const thead=document.createElement('thead');thead.append(tr);table.append(thead);const body=document.createElement('tbody');rows.forEach(row=>{const r=document.createElement('tr');row.forEach(x=>r.append(cell('td',x)));body.append(r)});table.append(body);return table}
function section(label){const s=document.createElement('section');s.className='pdf-section';s.append(cell('h2',label));return s}
export function printRiskReport({results,language='ja',chartCanvas=null}){
 if(!Array.isArray(results)||!results.length)throw new Error('No results to export');
 document.getElementById('pdf-print-area')?.remove();
 const t=T[language==='en'?'en':'ja'];const root=document.createElement('article');root.id='pdf-print-area';root.setAttribute('aria-label',t.title);
 root.append(cell('h1',t.title));const dt=cell('p',new Intl.DateTimeFormat(language==='en'?'en-US':'ja-JP',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date()));root.append(dt);
 const labels=[t.total,t.baseline,t.sigma,t.ltmean,t.ltsd,t.safety,t.reorder,t.risk,t.p90,t.p95,t.p99,t.z,t.runs];
 const rows=results.map(({name,result:r})=>[name,n(r.futureBaseline,language),n(r.sigma,language),n(r.mean,language),n(r.sd,language),n(r.safetyStock,language),n(r.reorderPoint,language),r.stockout===null?'—':n(r.stockout,language)+'%',n(r.p90,language),n(r.p95,language),n(r.p99,language),r.lastZ===null?'—':n(r.lastZ,language),n(r.runs,language)]);
 for(let i=0;i<rows.length;i++){
  const s=section(`${t.details} ${i+1} / ${rows.length} · ${results[i].name}`);s.classList.toggle('pdf-newpage',i>0);
  s.append(tableFor([t.total,'Value'],labels.map((label,j)=>[label,rows[i][j]])));
  // Only the selected series histogram is available in the live dashboard.
  if(chartCanvas&&results.length===1&&chartCanvas.width&&chartCanvas.height){try{const img=document.createElement('img');img.className='pdf-plot';img.alt='Lead-time demand distribution';img.src=chartCanvas.toDataURL('image/png');s.append(img)}catch{}}
  root.append(s);
 }
 root.append(cell('p',t.limit));document.body.append(root);
 const cleanup=()=>{root.remove();window.removeEventListener('afterprint',cleanup)};
 window.addEventListener('afterprint',cleanup,{once:true});
 // Print is invoked synchronously from the download button to avoid popup blockers.
 window.print();
 return t.save;
}
