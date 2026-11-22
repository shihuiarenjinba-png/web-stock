function mean(a){return a.reduce((s,v)=>s+v,0)/a.length}
function sd(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))}
function corr(a,b){
  if(a.length!==b.length||a.length<3)return null;
  const ma=mean(a),mb=mean(b);
  let num=0,da=0,db=0;
  for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y}
  if(da<=0||db<=0)return null;
  return num/Math.sqrt(da*db);
}
function metricStats(rows,key){
  const items=rows.filter(r=>Number.isFinite(r[key])).map(r=>({date:r.date,value:r[key]}));
  if(!items.length)return null;
  const values=items.map(x=>x.value),m=mean(values),s=sd(values);
  const outliers=s>0?items.map(x=>({...x,z:(x.value-m)/s})).filter(x=>Math.abs(x.z)>=2.5):[];
  return {n:values.length,mean:m,sd:s,min:Math.min(...values),max:Math.max(...values),outliers};
}
function pair(rows,a,b){
  const paired=rows.filter(r=>Number.isFinite(r[a])&&Number.isFinite(r[b]));
  if(paired.length<3)return null;
  const av=paired.map(r=>r[a]),bv=paired.map(r=>r[b]);
  const ma=mean(av),sa=sd(av),mb=mean(bv),sb=sd(bv);
  const filtered=paired.filter(r=>{
    const za=sa>0?(r[a]-ma)/sa:0;
    const zb=sb>0?(r[b]-mb)/sb:0;
    return Math.abs(za)<2.5&&Math.abs(zb)<2.5;
  });
  const rAll=corr(av,bv);
  const rTrim=filtered.length>=3?corr(filtered.map(r=>r[a]),filtered.map(r=>r[b])):null;
  return {
    a,b,n:paired.length,r:rAll,
    rWithoutOutliers:rTrim,
    outlierSensitive:Number.isFinite(rAll)&&Number.isFinite(rTrim)&&Math.abs(rAll-rTrim)>=0.2
  };
}

export function buildFinancialRows(rows){
  return rows.map(r=>{
    const calculatedRevenue=r.price*r.units;
    const revenue=Number.isFinite(r.revenue)?r.revenue:calculatedRevenue;
    const totalCost=Number.isFinite(r.totalCost)
      ? r.totalCost
      : Number.isFinite(r.unitCostHistorical)?r.unitCostHistorical*r.units:null;
    const grossProfit=Number.isFinite(totalCost)?revenue-totalCost:null;
    const grossMargin=Number.isFinite(grossProfit)&&revenue>0?grossProfit/revenue:null;
    return {...r,calculatedRevenue,revenue,totalCost,grossProfit,grossMargin};
  });
}

export function analyzeFinancialHistory(rows,{enabled=false}={}){
  if(!enabled)return {enabled:false,available:false,reason:'plan_required'};
  const enriched=buildFinancialRows(rows);
  const hasReportedRevenue=enriched.some(r=>Number.isFinite(r.revenueReported));
  const hasCost=enriched.some(r=>Number.isFinite(r.totalCost));
  const metrics={
    units:metricStats(enriched,'units'),
    price:metricStats(enriched,'price'),
    revenue:metricStats(enriched,'revenue'),
    totalCost:metricStats(enriched,'totalCost'),
    grossProfit:metricStats(enriched,'grossProfit'),
    grossMargin:metricStats(enriched,'grossMargin')
  };
  const pairs=[
    ['price','units'],
    ['price','revenue'],
    ['price','totalCost'],
    ['price','grossProfit'],
    ['units','revenue'],
    ['units','grossProfit'],
    ['revenue','totalCost'],
    ['revenue','grossProfit']
  ].map(([a,b])=>pair(enriched,a,b)).filter(Boolean);
  const warnings=[];
  if(!hasReportedRevenue)warnings.push('reported revenue列がないため、売上は price × units の計算値を使用しています。');
  if(!hasCost)warnings.push('費用列がないため、粗利益・粗利率の診断は行っていません。');
  if(pairs.some(x=>x.outlierSensitive))warnings.push('一部の相関は外れ値を除くと大きく変化します。因果関係として解釈しないでください。');
  const totalOutliers=Object.values(metrics).filter(Boolean).reduce((s,m)=>s+m.outliers.length,0);
  if(totalOutliers)warnings.push(`|z| >= 2.5 の外れ値候補を延べ${totalOutliers}件検出しました。`);
  return {
    enabled:true,
    available:true,
    revenueSource:hasReportedRevenue?'reported':'price_x_units',
    costAvailable:hasCost,
    rows:enriched,
    metrics,
    correlations:pairs,
    warnings
  };
}
