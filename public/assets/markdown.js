function mean(a){return a.reduce((s,v)=>s+v,0)/a.length}
function sd(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))}
function finite(name,v,{min=-Infinity,max=Infinity}={}){const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${name} is invalid`);return n}
function rng(seed=0x9e3779b9){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function gaussian(r){return Math.sqrt(-2*Math.log(Math.max(r(),1e-12)))*Math.cos(2*Math.PI*r())}
function seedFrom(rows,discount){let x=2166136261;for(const r of rows){for(const v of [r.price,r.units]){x^=Math.round(v*100);x=Math.imul(x,16777619)}}x^=Math.round(discount*10000);return x>>>0}

export function parseMarkdownHistory(text){
  const lines=String(text??'').trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length)throw new Error('値下げ履歴を入力してください。');
  const split=line=>line.split(/[\t,，;]/).map(x=>x.trim());
  let start=0,header=null;
  const first=split(lines[0]).map(x=>x.toLowerCase());
  if(first.some(x=>/price|価格|単価/.test(x))&&first.some(x=>/units|sales|qty|販売|数量|個数/.test(x))){header=first;start=1}
  const find=(re,fallback)=>header?header.findIndex(x=>re.test(x)):fallback;
  const pi=find(/price|価格|単価/,header?null:0), ui=find(/units|sales|qty|販売|数量|個数/,header?null:1);
  const ai=find(/available|stock|在庫|販売可能/,header?null:2), si=find(/stockout|欠品/,header?null:3);
  if(pi<0||ui<0)throw new Error('price/価格 と units/販売数 の列が必要です。');
  const rows=[];
  for(let i=start;i<lines.length;i++){
    const c=split(lines[i]);
    const price=Number(c[pi]),units=Number(c[ui]);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(units)||units<0)throw new Error(`${i+1}行目の価格または販売数が不正です。`);
    const available=ai>=0&&c[ai]!==undefined&&c[ai]!==''?Number(c[ai]):null;
    if(available!==null&&(!Number.isFinite(available)||available<0))throw new Error(`${i+1}行目の在庫/販売可能数が不正です。`);
    const stockout=si>=0&&c[si]!==undefined?/^(1|true|yes|y|欠品)$/i.test(c[si]):(available!==null&&available<=units);
    rows.push({price,units,available,stockout,index:rows.length});
  }
  if(rows.length<2)throw new Error('履歴が少なすぎます。');
  return rows;
}

function solve3(m,b){
  const a=m.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<3;i++){
    let p=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;
    if(Math.abs(a[p][i])<1e-10)return null;
    [a[i],a[p]]=[a[p],a[i]];
    const d=a[i][i];for(let k=i;k<4;k++)a[i][k]/=d;
    for(let j=0;j<3;j++)if(j!==i){const q=a[j][i];for(let k=i;k<4;k++)a[j][k]-=q*a[i][k]}
  }
  return [a[0][3],a[1][3],a[2][3]];
}

export function estimatePriceResponse(rows){
  const usable=rows.filter(r=>!r.stockout);
  const prices=[...new Set(usable.map(r=>r.price))].sort((a,b)=>a-b);
  const counts=new Map(prices.map(p=>[p,usable.filter(r=>r.price===p).length]));
  const warnings=[];
  if(rows.some(r=>r.stockout))warnings.push('欠品または販売可能数で打ち切られた期は価格反応推定から除外しました。');
  if(usable.length<28)warnings.push('有効履歴が28期未満です。価格反応の推定は不安定です。');
  if(prices.length<2)warnings.push('価格水準が1つしかないため、値下げ効果を識別できません。');
  if(prices.length>=2&&Math.min(...counts.values())<5)warnings.push('一部価格水準の観測が5期未満です。');
  if(usable.length<3||prices.length<2)return {status:'HOLD',usable,prices,counts,warnings,slope:null,r2:null,residualSd:null};

  const basePrice=Math.exp(mean(usable.map(r=>Math.log(r.price))));
  const n=Math.max(1,usable.length-1);
  const x=usable.map((r,i)=>[1,Math.log(r.price/basePrice),i/n-.5]);
  const y=usable.map(r=>Math.log1p(r.units));
  const xtx=Array.from({length:3},()=>Array(3).fill(0)),xty=Array(3).fill(0);
  for(let i=0;i<x.length;i++)for(let a=0;a<3;a++){xty[a]+=x[i][a]*y[i];for(let c=0;c<3;c++)xtx[a][c]+=x[i][a]*x[i][c]}
  const beta=solve3(xtx,xty);
  if(!beta)return {status:'HOLD',usable,prices,counts,warnings:[...warnings,'回帰行列が特異で推定できません。'],slope:null,r2:null,residualSd:null};
  const fitted=x.map(v=>beta[0]+beta[1]*v[1]+beta[2]*v[2]);
  const residuals=y.map((v,i)=>v-fitted[i]);
  const ybar=mean(y),sst=y.reduce((s,v)=>s+(v-ybar)**2,0),sse=residuals.reduce((s,v)=>s+v*v,0);
  const r2=sst>0?1-sse/sst:null,residualSd=sd(residuals);
  if(beta[1]>=0)warnings.push('履歴では低価格ほど販売数が増える関係を確認できません。値下げ推奨はHOLDです。');
  if(r2!==null&&r2<0.05)warnings.push('価格・時間トレンドだけでは販売変動をほとんど説明できません。');
  const enough=usable.length>=28&&prices.length>=2&&Math.min(...counts.values())>=5&&beta[1]<0;
  return {status:enough?'READY':'HOLD',usable,prices,counts,warnings,slope:beta[1],timeSlope:beta[2],intercept:beta[0],basePrice,r2,residualSd};
}

export function analyzeMarkdownHistory({history,currentPrice,unitCost,currentInventory,horizonPeriods=30,discounts=[0,.05,.1,.15,.2],leftoverPenalty=0,runs=3000}){
  const rows=typeof history==='string'?parseMarkdownHistory(history):history;
  const fit=estimatePriceResponse(rows);
  currentPrice=finite('currentPrice',currentPrice,{min:0.000001});
  unitCost=finite('unitCost',unitCost,{min:0});
  currentInventory=finite('currentInventory',currentInventory,{min:0});
  horizonPeriods=Math.round(finite('horizonPeriods',horizonPeriods,{min:1,max:365}));
  leftoverPenalty=finite('leftoverPenalty',leftoverPenalty,{min:0});
  runs=Math.round(finite('runs',runs,{min:1000,max:5000}));
  const recent=fit.usable.slice(-Math.min(14,fit.usable.length));
  const currentObserved=recent.filter(r=>Math.abs(r.price-currentPrice)/currentPrice<0.03);
  const baselinePool=currentObserved.length>=3?currentObserved:recent;
  const baselineUnits=baselinePool.length?mean(baselinePool.map(r=>r.units)):0;
  if(!Number.isFinite(fit.slope))return {...fit,baselineUnits,scenarios:[],recommendation:null};

  const scenarios=discounts.map(raw=>{
    const discount=finite('discount',raw,{min:0,max:.9});
    const price=currentPrice*(1-discount);
    const demandMultiplier=Math.exp(fit.slope*Math.log(price/currentPrice));
    const logMean=Math.log1p(Math.max(0,baselineUnits*demandMultiplier));
    const random=rng(seedFrom(fit.usable,discount));
    let gp=0,left=0,sold=0,sellThrough=0;
    for(let r=0;r<runs;r++){
      let demand=0;
      for(let t=0;t<horizonPeriods;t++){
        const daily=Math.max(0,Math.exp(logMean+(fit.residualSd||0)*gaussian(random))-1);
        demand+=daily;
      }
      const sales=Math.min(currentInventory,demand),leftover=Math.max(0,currentInventory-sales);
      gp+=sales*(price-unitCost)-leftover*leftoverPenalty;
      left+=leftover;sold+=sales;if(demand>=currentInventory)sellThrough++;
    }
    return {discount,price,demandMultiplier,expectedSales:sold/runs,expectedLeftover:left/runs,sellThroughProbability:sellThrough/runs,expectedGrossProfit:gp/runs};
  });
  let recommendation=null;
  if(fit.status==='READY'&&scenarios.length){
    recommendation=[...scenarios].sort((a,b)=>b.expectedGrossProfit-a.expectedGrossProfit||a.discount-b.discount)[0];
  }
  return {...fit,baselineUnits,currentPrice,unitCost,currentInventory,horizonPeriods,leftoverPenalty,runs,scenarios,recommendation};
}
