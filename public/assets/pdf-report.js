/** Client-only printable report. Browser Save as PDF preserves JP/EN glyphs,
 * selectable text and vector SVG charts. No demand data is uploaded. */
const T={
 ja:{
  title:'需要予測・在庫リスク分析レポート',generated:'作成日時',summary:'全体サマリー',details:'商品別詳細',
  product:'商品',metric:'指標',value:'値',history:'履歴期数',baseline:'基準需要（日次）',model:'基準方式',sigma:'採用残差SD',
  vol:'ボラティリティ内訳',lt:'リードタイム',service:'サービスレベル',ltmean:'リードタイム需要平均',
  ltsd:'リードタイム需要SD',safety:'安全在庫',reorder:'推奨発注点',inventory:'現在庫',
  risk:'在庫切れ確率',p50:'P50',p90:'P90',p95:'P95',p99:'P99',z:'直近の乖離（σ）',
  runs:'試行回数',warnings:'注意事項',none:'なし',notEntered:'未入力',distribution:'リードタイム需要分布',
  driver:'採用根拠',sma:'単純移動平均',overall:'全体平均',
  limit:'前提: 将来の日次需要は一定基準＋独立な正規乱数×残差標準偏差、需要は0未満を0に補正し、リードタイムは固定とします。季節性・休日・自己相関・入荷遅延・欠品による売上欠測等は直接扱いません。発注点は在庫ポジション管理の目安であり、現在庫だけをそのまま発注判断に使わないでください。推計値は実際の欠品や販売成果を保証しません。',
  save:'印刷画面の保存先で「PDFに保存」を選択してください。'
 },
 en:{
  title:'Demand forecast & inventory risk report',generated:'Generated',summary:'Portfolio summary',details:'Product details',
  product:'Product',metric:'Metric',value:'Value',history:'History',baseline:'Daily baseline',model:'Baseline model',sigma:'Selected residual SD',
  vol:'Volatility breakdown',lt:'Lead time',service:'Service level',ltmean:'Mean lead-time demand',
  ltsd:'Lead-time demand SD',safety:'Safety stock',reorder:'Reorder point',inventory:'On-hand stock',
  risk:'Stockout probability',p50:'P50',p90:'P90',p95:'P95',p99:'P99',z:'Latest deviation (σ)',
  runs:'Simulation runs',warnings:'Cautions',none:'None',notEntered:'Not entered',distribution:'Lead-time demand distribution',
  driver:'Volatility driver',sma:'Simple moving average',overall:'Overall mean',
  limit:'Assumptions: constant baseline plus independent normally distributed residuals, non-negative demand floor and fixed lead time. Seasonality, holidays, autocorrelation, lead-time uncertainty and lost-sales censoring are not modeled directly. Reorder point is a benchmark for inventory-position management; do not use on-hand stock alone as the replenishment trigger. Estimates do not guarantee stockout or sales outcomes.',
  save:'In the print dialog, select Save as PDF as your destination.'
 }
};
const locale=l=>l==='en'?'en-US':'ja-JP';
const n=(v,l)=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat(locale(l),{maximumFractionDigits:2}).format(v);
const pct=(v,l)=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':n(v,l)+'%';
function cell(tag,text){const el=document.createElement(tag);el.textContent=String(text);return el}
function tableFor(columns,rows,klass=''){const table=document.createElement('table');if(klass)table.className=klass;const tr=document.createElement('tr');columns.forEach(x=>tr.append(cell('th',x)));const thead=document.createElement('thead');thead.append(tr);table.append(thead);const body=document.createElement('tbody');rows.forEach(row=>{const r=document.createElement('tr');row.forEach(x=>r.append(cell('td',x)));body.append(r)});table.append(body);return table}
function section(label,klass=''){const s=document.createElement('section');s.className=['pdf-section',klass].filter(Boolean).join(' ');s.append(cell('h2',label));return s}
function methodLabel(r,t){return r.method==='sma'?t.sma+(r.window?' ('+r.window+')':''):t.overall}
function driverLabel(r){return r.volatilityDriver==='recent'?'recent':r.volatilityDriver==='ewma'?'EWMA':'long'}
export function riskReportModel({results,language='ja'}){
 if(!Array.isArray(results)||!results.length)throw new Error('No results to export');
 const t=T[language==='en'?'en':'ja'];
 return results.map(({name,result:r})=>({
  name,
  summary:[name,n(r.reorderPoint,language),n(r.safetyStock,language),pct(r.stockout,language),String(r.flags?.length||0)],
  details:[
   [t.history,n(r.n,language)],[t.model,methodLabel(r,t)],[t.baseline,n(r.futureBaseline,language)],
   [t.sigma,n(r.sigma,language)],[t.vol,'long '+n(r.sigmaLong,language)+' / recent '+n(r.sigmaRecent,language)+' / EWMA '+n(r.sigmaEwma,language)],
   [t.driver,driverLabel(r)],[t.lt,n(r.leadTime,language)],[t.service,pct(r.service,language)],
   [t.ltmean,n(r.mean,language)],[t.ltsd,n(r.sd,language)],[t.p50,n(r.median,language)],
   [t.p90,n(r.p90,language)],[t.p95,n(r.p95,language)],[t.p99,n(r.p99,language)],
   [t.safety,n(r.safetyStock,language)],[t.reorder,n(r.reorderPoint,language)],
   [t.inventory,r.inventory===null?t.notEntered:n(r.inventory,language)],[t.risk,pct(r.stockout,language)],
   [t.z,r.lastZ===null?'—':n(r.lastZ,language)+'σ'],[t.runs,n(r.runs,language)]
  ],
  flags:Array.isArray(r.flags)?r.flags.filter(Boolean):[],
  sums:Array.isArray(r.sums)?r.sums:[]
 }));
}
function distributionSvg(values,language='ja'){
 const w=760,h=210,pad={l:42,r:20,t:18,b:36},svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('class','pdf-svg');svg.setAttribute('role','img');
 if(!values.length)return svg;
 const min=values[0],max=values[values.length-1],bins=24,span=Math.max(max-min,1e-9),counts=Array(bins).fill(0);
 for(const v of values){const i=Math.min(bins-1,Math.floor((v-min)/span*bins));counts[i]++}
 const maxC=Math.max(...counts,1),plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b,ns='http://www.w3.org/2000/svg';
 const axis=document.createElementNS(ns,'path');axis.setAttribute('d','M'+pad.l+' '+pad.t+'V'+(pad.t+plotH)+'H'+(pad.l+plotW));axis.setAttribute('class','pdf-axis');svg.append(axis);
 counts.forEach((c,i)=>{const rect=document.createElementNS(ns,'rect');const bw=plotW/bins;rect.setAttribute('x',String(pad.l+i*bw+1));rect.setAttribute('y',String(pad.t+plotH-(c/maxC)*plotH));rect.setAttribute('width',String(Math.max(1,bw-2)));rect.setAttribute('height',String((c/maxC)*plotH));rect.setAttribute('class','pdf-bar');svg.append(rect)});
 const labels=[[min,pad.l],[max,pad.l+plotW]];for(const pair of labels){const v=pair[0],x=pair[1],tx=document.createElementNS(ns,'text');tx.setAttribute('x',String(x));tx.setAttribute('y',String(h-12));tx.setAttribute('text-anchor',x===pad.l?'start':'end');tx.setAttribute('class','pdf-axis-label');tx.textContent=n(v,language);svg.append(tx)}
 return svg;
}
export function printRiskReport({results,language='ja'}){
 const t=T[language==='en'?'en':'ja'],model=riskReportModel({results,language});
 document.getElementById('pdf-print-area')?.remove();
 const root=document.createElement('article');root.id='pdf-print-area';root.setAttribute('aria-label',t.title);
 root.append(cell('h1',t.title));
 const stamp=new Intl.DateTimeFormat(locale(language),{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
 const dt=cell('p',t.generated+': '+stamp);dt.className='pdf-muted';root.append(dt);
 const summary=section(t.summary,'pdf-summary');summary.append(tableFor([t.product,t.reorder,t.safety,t.risk,t.warnings],model.map(x=>x.summary),'pdf-summary-table'));root.append(summary);
 model.forEach((item,i)=>{
  const s=section(t.details+' '+(i+1)+' / '+model.length+' · '+item.name,'pdf-detail');s.classList.add('pdf-newpage');
  const paired=[];for(let j=0;j<item.details.length;j+=2){const a=item.details[j],b=item.details[j+1]||['',''];paired.push([a[0],a[1],b[0],b[1]])}
  s.append(tableFor([t.metric,t.value,t.metric,t.value],paired,'pdf-detail-table'));
  const chartTitle=cell('h3',t.distribution);chartTitle.className='pdf-chart-title';s.append(chartTitle,distributionSvg(item.sums,language));
  const warnTitle=cell('h3',t.warnings);warnTitle.className='pdf-chart-title';s.append(warnTitle);
  if(item.flags.length){const ul=document.createElement('ul');ul.className='pdf-flags';item.flags.forEach(v=>ul.append(cell('li',v)));s.append(ul)}else{s.append(cell('p',t.none))}
  root.append(s);
 });
 const caveat=cell('p',t.limit);caveat.className='pdf-caveat';root.append(caveat);document.body.append(root);
 const cleanup=()=>{root.remove();window.removeEventListener('afterprint',cleanup)};
 window.addEventListener('afterprint',cleanup,{once:true});window.print();return t.save;
}
