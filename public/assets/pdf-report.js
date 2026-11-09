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
  driver:'採用根拠',sma:'単純移動平均',overall:'全体平均',overview:'総合所見',priorities:'優先確認',actions:'推奨アクション',
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
  driver:'Volatility driver',sma:'Simple moving average',overall:'Overall mean',overview:'Portfolio interpretation',priorities:'Priority review',actions:'Recommended actions',
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
export function portfolioNarrative({results,language='ja'}){
 if(!Array.isArray(results)||!results.length)throw new Error('No results to summarize');
 const isEn=language==='en';
 const known=results.filter(x=>x?.result?.inventory!==null&&Number.isFinite(Number(x?.result?.stockout)));
 const near=results.filter(x=>x?.result?.inventory!==null&&Number(x.result.inventory)<=Number(x.result.reorderPoint)*1.05);
 const volatility=results.filter(x=>['recent','ewma'].includes(x?.result?.volatilityDriver));
 const warningCount=results.reduce((sum,x)=>sum+(Array.isArray(x?.result?.flags)?x.result.flags.length:0),0);
 const ranked=[...results].sort((a,b)=>{const ar=Number.isFinite(Number(a?.result?.stockout))?Number(a.result.stockout):-1;const br=Number.isFinite(Number(b?.result?.stockout))?Number(b.result.stockout):-1;if(br!==ar)return br-ar;const ag=a?.result?.inventory===null?-Infinity:Number(a.result.reorderPoint)-Number(a.result.inventory);const bg=b?.result?.inventory===null?-Infinity:Number(b.result.reorderPoint)-Number(b.result.inventory);return bg-ag;});
 const overview=[];
 if(isEn){
  overview.push(String(results.length)+' product'+(results.length===1?'':'s')+' were compared using the same 4,000-run inventory-risk framework.');
  if(known.length){const top=[...known].sort((a,b)=>Number(b.result.stockout)-Number(a.result.stockout))[0];overview.push('Among products with on-hand inventory entered, '+top.name+' has the highest estimated stockout probability at '+pct(top.result.stockout,language)+'.')}else overview.push('On-hand inventory is not entered, so stockout probabilities cannot yet be compared across products.');
  overview.push(near.length?(String(near.length)+' product'+(near.length===1?' is':'s are')+' at or within 5% above the estimated reorder point and should be reviewed first.'):'No product with entered inventory is currently at or within 5% above its estimated reorder point.');
 }else{
  overview.push(String(results.length)+'商品を、同一の4,000回シミュレーション条件で比較しています。');
  if(known.length){const top=[...known].sort((a,b)=>Number(b.result.stockout)-Number(a.result.stockout))[0];overview.push('現在庫が入力された商品の中では、'+top.name+'の推定欠品確率が最も高く、'+pct(top.result.stockout,language)+'です。')}else overview.push('現在庫が入力されていないため、商品間の欠品確率比較はまだできません。');
  overview.push(near.length?('現在庫が推奨発注点以下、または発注点の5%以内にある商品が'+near.length+'件あります。これらは優先して在庫ポジションを確認してください。'):'現在庫が入力された範囲では、推奨発注点以下または5%以内の商品はありません。');
 }
 const priorities=ranked.slice(0,Math.min(3,ranked.length)).map(x=>{const r=x.result;if(r.inventory!==null&&Number.isFinite(Number(r.stockout))){return isEn?x.name+': on-hand '+n(r.inventory,language)+', reorder point '+n(r.reorderPoint,language)+', estimated stockout '+pct(r.stockout,language)+'. Check inventory position and inbound orders before acting.':x.name+'：現在庫 '+n(r.inventory,language)+'、推奨発注点 '+n(r.reorderPoint,language)+'、推定欠品確率 '+pct(r.stockout,language)+'。発注判断前に在庫ポジションと入荷予定を確認してください。';}return isEn?x.name+': reorder point '+n(r.reorderPoint,language)+'. Enter on-hand inventory to estimate stockout probability.':x.name+'：推奨発注点 '+n(r.reorderPoint,language)+'。現在庫を入力すると欠品確率まで確認できます。';});
 const actions=[];
 if(near.length)actions.push(isEn?'Review the '+near.length+' product(s) closest to or below reorder point before lower-priority items.':'発注点以下または近接している'+near.length+'商品を、他の商品より先に確認してください。');
 if(volatility.length)actions.push(isEn?volatility.length+' product(s) use recent/EWMA volatility as the conservative driver; check for promotions, seasonality or structural demand changes.':volatility.length+'商品では直近または指数加重ボラティリティが保守推定の採用根拠です。販促・季節性・需要構造の変化がないか確認してください。');
 if(warningCount)actions.push(isEn?'There are '+warningCount+' model caution flag(s). Review each SKU caution section before using the numbers operationally.':'モデル上の注意事項が合計'+warningCount+'件あります。実務判断に使う前に各SKUの注意事項を確認してください。');
 actions.push(isEn?'Use inventory position (on-hand + on-order - committed), not on-hand stock alone, when comparing against the reorder point.':'発注点との比較には、現在庫だけでなく「手持ち＋発注残−引当済」の在庫ポジションを使用してください。');
 return {overview,priorities,actions};
}
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
 const narrative=portfolioNarrative({results,language});
 const summary=section(t.summary,'pdf-summary');summary.append(tableFor([t.product,t.reorder,t.safety,t.risk,t.warnings],model.map(x=>x.summary),'pdf-summary-table'));root.append(summary);
 const overview=section(t.overview,'pdf-narrative');narrative.overview.forEach(v=>overview.append(cell('p',v)));root.append(overview);
 const narrativeGrid=document.createElement('div');narrativeGrid.className='pdf-narrative-grid';
 const priorityBox=section(t.priorities,'pdf-narrative-box');const priorityList=document.createElement('ol');narrative.priorities.forEach(v=>priorityList.append(cell('li',v)));priorityBox.append(priorityList);
 const actionBox=section(t.actions,'pdf-narrative-box');const actionList=document.createElement('ul');narrative.actions.forEach(v=>actionList.append(cell('li',v)));actionBox.append(actionList);
 narrativeGrid.append(priorityBox,actionBox);root.append(narrativeGrid);
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
