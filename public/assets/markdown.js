import {alignMarkdownCovariates,normalizeDateKey} from './markdown-covariates.js';
import {numberOrNull} from './importer.js';

function mean(a){return a.reduce((s,v)=>s+v,0)/a.length}
function sd(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))}
function finite(name,v,{min=-Infinity,max=Infinity}={}){const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${name} is invalid`);return n}
function rng(seed=0x9e3779b9){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function gaussian(r){return Math.sqrt(-2*Math.log(Math.max(r(),1e-12)))*Math.cos(2*Math.PI*r())}
function seedFrom(rows,discount){let x=2166136261;for(const r of rows){for(const v of [r.price,r.units]){x^=Math.round(v*100);x=Math.imul(x,16777619)}}x^=Math.round(discount*10000);return x>>>0}

const CORE_DATE_HEADER=/^(date|day|time|timestamp|period|日付|年月日|日時|期間|日)$/i;
const CORE_PRICE_HEADER=/^(price|unit_price|selling_price|価格|単価|販売価格)$/i;
const CORE_UNITS_HEADER=/^(units|sales|qty|quantity|units_sold|販売|販売数|数量|個数|販売個数)$/i;
const CORE_AVAILABLE_HEADER=/^(available|stock|inventory|在庫|販売可能|販売可能数)$/i;
const CORE_STOCKOUT_HEADER=/^(stockout|out_of_stock|欠品|品切れ)$/i;

function uniqueHeaderIndex(header,re,label){
  const hits=header.map((v,i)=>re.test(String(v??'').trim())?i:-1).filter(i=>i>=0);
  if(hits.length!==1)throw new Error(`基準履歴ファイルには ${label} 列を1つだけ含めてください。`);
  return hits[0];
}

export function parseMarkdownHistoryTable(rows){
  if(!Array.isArray(rows)||rows.length<2)throw new Error('基準履歴ファイルにヘッダーとデータが必要です。');
  const nonEmpty=rows.filter(r=>Array.isArray(r)&&r.some(v=>v!==''&&v!==null&&v!==undefined));
  if(nonEmpty.length<2)throw new Error('基準履歴ファイルに有効なデータがありません。');
  const header=nonEmpty[0].map(v=>String(v??'').trim());
  const di=uniqueHeaderIndex(header,CORE_DATE_HEADER,'date/日付');
  const pi=uniqueHeaderIndex(header,CORE_PRICE_HEADER,'price/価格');
  const ui=uniqueHeaderIndex(header,CORE_UNITS_HEADER,'units/販売数');
  const ai=header.findIndex(v=>CORE_AVAILABLE_HEADER.test(v));
  const si=header.findIndex(v=>CORE_STOCKOUT_HEADER.test(v));
  const rowsOut=[],dates=new Set();
  for(let r=1;r<nonEmpty.length;r++){
    const row=nonEmpty[r];
    const date=normalizeDateKey(row?.[di]);
    const price=numberOrNull(row?.[pi]);
    const units=numberOrNull(row?.[ui]);
    if(!date)throw new Error(`${r+1}行目の日付が不正です。`);
    if(dates.has(date))throw new Error(`基準履歴ファイルに重複日付 ${date} があります。`);
    if(!Number.isFinite(price)||price<=0)throw new Error(`${r+1}行目の価格が正の数値ではありません。`);
    if(!Number.isFinite(units)||units<0)throw new Error(`${r+1}行目の販売数が0以上の数値ではありません。`);
    let available=null;
    if(ai>=0&&row?.[ai]!==''&&row?.[ai]!==null&&row?.[ai]!==undefined){
      available=numberOrNull(row[ai]);
      if(!Number.isFinite(available)||available<0)throw new Error(`${r+1}行目の在庫/販売可能数が不正です。`);
    }
    const rawStockout=si>=0?row?.[si]:null;
    const stockout=si>=0?/^(1|true|yes|y|欠品|品切れ)$/i.test(String(rawStockout??'').trim()):(available!==null&&available<=units);
    dates.add(date);
    rowsOut.push({date,price,units,available,stockout,index:rowsOut.length,covariates:[]});
  }
  if(rowsOut.length<2)throw new Error('基準履歴ファイルの有効履歴が少なすぎます。');
  rowsOut.sort((a,b)=>a.date.localeCompare(b.date));
  return rowsOut.map((row,index)=>({...row,index}));
}

export function parseMarkdownHistoryWorkbook(workbook){
  if(!workbook?.sheets?.length)throw new Error('基準履歴ファイルを読み込めません。');
  const errors=[];
  for(const sheet of workbook.sheets){
    try{return {rows:parseMarkdownHistoryTable(sheet.rows),sheet:sheet.name};}
    catch(e){errors.push(`${sheet.name}: ${e.message}`);}
  }
  throw new Error(errors[0]||'date / price / units を含むシートがありません。');
}

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
  const di=find(/^(date|day|time|timestamp|period|日付|年月日|日時|期間|日)$/i,-1);
  if(pi<0||ui<0||di<0)throw new Error('date/日付、price/価格、units/販売数 の3列が必要です。');
  const rows=[],dates=new Set();
  for(let i=start;i<lines.length;i++){
    const c=split(lines[i]);
    const price=Number(c[pi]),units=Number(c[ui]);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(units)||units<0)throw new Error(`${i+1}行目の価格または販売数が不正です。`);
    const available=ai>=0&&c[ai]!==undefined&&c[ai]!==''?Number(c[ai]):null;
    if(available!==null&&(!Number.isFinite(available)||available<0))throw new Error(`${i+1}行目の在庫/販売可能数が不正です。`);
    const stockout=si>=0&&c[si]!==undefined?/^(1|true|yes|y|欠品)$/i.test(c[si]):(available!==null&&available<=units);
    const date=di>=0?normalizeDateKey(c[di]):null;
    if(di>=0&&!date)throw new Error(`${i+1}行目の日付が不正です。`);
    if(date&&dates.has(date))throw new Error(`価格・販売履歴に重複日付 ${date} があります。`);
    if(date)dates.add(date);
    rows.push({price,units,available,stockout,date,index:rows.length,covariates:[]});
  }
  if(rows.length<2)throw new Error('履歴が少なすぎます。');
  if(di>=0)rows.sort((a,b)=>a.date.localeCompare(b.date));
  return rows.map((r,index)=>({...r,index}));
}

function solveLinear(m,b){
  const n=m.length;
  if(!n||b.length!==n)return null;
  const a=m.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<n;i++){
    let p=i;
    for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;
    if(!Number.isFinite(a[p][i])||Math.abs(a[p][i])<1e-10)return null;
    [a[i],a[p]]=[a[p],a[i]];
    const d=a[i][i];
    for(let k=i;k<=n;k++)a[i][k]/=d;
    for(let j=0;j<n;j++)if(j!==i){
      const q=a[j][i];
      for(let k=i;k<=n;k++)a[j][k]-=q*a[i][k];
    }
  }
  return a.map(r=>r[n]);
}

function standardizeColumns(rows,count){
  const stats=[];
  for(let j=0;j<count;j++){
    const values=rows.map(r=>Number(r.covariates?.[j]));
    if(values.some(v=>!Number.isFinite(v)))return null;
    const m=mean(values),s=sd(values);
    if(!(s>1e-12))return null;
    stats.push({mean:m,sd:s});
  }
  return stats;
}

export function estimatePriceResponse(rows,{covariateNames=[]}={}){
  const usable=rows.filter(r=>!r.stockout);
  const prices=[...new Set(usable.map(r=>r.price))].sort((a,b)=>a-b);
  const counts=new Map(prices.map(p=>[p,usable.filter(r=>r.price===p).length]));
  const warnings=[];
  if(rows.some(r=>r.stockout))warnings.push('欠品または販売可能数で打ち切られた期は価格反応推定から除外しました。');
  if(usable.length<28)warnings.push('有効履歴が28期未満です。価格反応の推定は不安定です。');
  if(prices.length<2)warnings.push('価格水準が1つしかないため、値下げ効果を識別できません。');
  if(prices.length>=2&&Math.min(...counts.values())<5)warnings.push('一部価格水準の観測が5期未満です。');
  const covCount=Math.min(covariateNames.length,usable[0]?.covariates?.length||0);
  if(usable.length<3||prices.length<2)return {status:'HOLD',usable,prices,counts,warnings,slope:null,r2:null,residualSd:null,covariateCoefficients:{}};

  const covStats=standardizeColumns(usable,covCount);
  if(covCount&&!covStats)return {status:'HOLD',usable,prices,counts,warnings:[...warnings,'欠品除外後に定数化した追加変数があり、回帰できません。'],slope:null,r2:null,residualSd:null,covariateCoefficients:{}};

  const basePrice=Math.exp(mean(usable.map(r=>Math.log(r.price))));
  const n=Math.max(1,usable.length-1);
  const x=usable.map((r,i)=>{
    const base=[1,Math.log(r.price/basePrice),i/n-.5];
    for(let j=0;j<covCount;j++)base.push((r.covariates[j]-covStats[j].mean)/covStats[j].sd);
    return base;
  });
  const y=usable.map(r=>Math.log1p(r.units));
  const p=x[0].length;
  const xtx=Array.from({length:p},()=>Array(p).fill(0)),xty=Array(p).fill(0);
  for(let i=0;i<x.length;i++)for(let a=0;a<p;a++){xty[a]+=x[i][a]*y[i];for(let c=0;c<p;c++)xtx[a][c]+=x[i][a]*x[i][c]}
  const beta=solveLinear(xtx,xty);
  if(!beta)return {status:'HOLD',usable,prices,counts,warnings:[...warnings,'回帰行列が特異で推定できません。変数間の強い相関を確認してください。'],slope:null,r2:null,residualSd:null,covariateCoefficients:{}};
  const fitted=x.map(v=>v.reduce((s,z,j)=>s+z*beta[j],0));
  const residuals=y.map((v,i)=>v-fitted[i]);
  const ybar=mean(y),sst=y.reduce((s,v)=>s+(v-ybar)**2,0),sse=residuals.reduce((s,v)=>s+v*v,0);
  const r2=sst>0?1-sse/sst:null,residualSd=sd(residuals);
  if(beta[1]>=0)warnings.push('履歴では低価格ほど販売数が増える関係を確認できません。値下げ推奨はHOLDです。');
  if(r2!==null&&r2<0.05)warnings.push('価格・時間トレンド・追加変数でも販売変動をほとんど説明できません。');
  const covariateCoefficients={};
  for(let j=0;j<covCount;j++)covariateCoefficients[covariateNames[j]||`variable_${j+1}`]=beta[3+j];
  const enough=usable.length>=28&&prices.length>=2&&Math.min(...counts.values())>=5&&beta[1]<0;
  return {status:enough?'READY':'HOLD',usable,prices,counts,warnings,slope:beta[1],timeSlope:beta[2],intercept:beta[0],basePrice,r2,residualSd,covariateCoefficients,covariateStats:covStats};
}

export function analyzeMarkdownHistory({history,covariates=[],maxYears=null,maxPeriods=4000,currentPrice,unitCost,currentInventory,horizonPeriods=30,discounts=[0,.05,.1,.15,.2],leftoverPenalty=0,runs=3000}){
  const rawRows=typeof history==='string'?parseMarkdownHistory(history):history;
  const aligned=alignMarkdownCovariates(rawRows,covariates,{maxYears,maxPeriods});
  const fit=estimatePriceResponse(aligned.rows,{covariateNames:aligned.covariateNames});
  fit.warnings=[...aligned.warnings,...fit.warnings];
  fit.covariateNames=aligned.covariateNames;
  fit.correlationDiagnostics=aligned.diagnostics;
  if(aligned.hardMulticollinearity){
    fit.status='HOLD';
    fit.warnings.push('説明変数間の相関が強すぎるため、価格推奨を停止しました。変数を減らしてください。');
  }

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
  if(!Number.isFinite(fit.slope))return {...fit,baselineUnits,scenarios:[],recommendation:null,periodsUsed:aligned.rows.length,maxYears:aligned.maxYears,maxPeriods:aligned.maxPeriods};

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
  return {...fit,baselineUnits,currentPrice,unitCost,currentInventory,horizonPeriods,leftoverPenalty,runs,scenarios,recommendation,periodsUsed:aligned.rows.length,maxYears:aligned.maxYears,maxPeriods:aligned.maxPeriods};
}
