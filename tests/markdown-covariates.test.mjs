import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MARKDOWN_COVARIATES,
  MAX_MARKDOWN_PERIODS,
  alignMarkdownCovariates,
  normalizeDateKey,
  parseCovariateTable
} from '../public/assets/markdown-covariates.js';
import {markdownHistoryPolicy} from '../public/assets/plan-limits.js';
import {analyzeMarkdownHistory,parseMarkdownHistoryTable} from '../public/assets/markdown.js';

function day(i,start='2020-01-01'){
  const d=new Date(start+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+i);
  return d.toISOString().slice(0,10);
}

function month(i,startYear=2010){
  const d=new Date(Date.UTC(startYear,i,1));
  return d.toISOString().slice(0,10);
}

function coreRows(n=40){
  return Array.from({length:n},(_,i)=>{
    const price=i<Math.floor(n/3)?1000:i<Math.floor(2*n/3)?900:800;
    const base=price===1000?8:price===900?11:15;
    return {date:day(i),price,units:base+(i%3)-1,stockout:false,index:i,covariates:[]};
  });
}

test('normalizes common date formats and Excel serial dates',()=>{
  assert.equal(normalizeDateKey('2026/11/22'),'2026-11-22');
  assert.equal(normalizeDateKey('2026年11月22日'),'2026-11-22');
  assert.equal(normalizeDateKey(45292),'2024-01-01');
});

test('parses one date plus one numeric variable per file',()=>{
  const x=parseCovariateTable([
    ['日付','競合価格'],
    ['2024-01-01','1200'],
    ['2024-01-02','1180']
  ],'competitor');
  assert.equal(x.name,'競合価格');
  assert.equal(x.count,2);
  assert.equal(x.map.get('2024-01-02'),1180);
});

test('rejects duplicate dates in covariate files',()=>{
  assert.throws(()=>parseCovariateTable([
    ['date','cpi'],
    ['2024-01-01',100],
    ['2024-01-01',101]
  ]),/重複日付/);
});

test('aligns multiple variables by common dates only',()=>{
  const history=coreRows(40);
  const a={name:'promo',map:new Map(Array.from({length:35},(_,i)=>[day(i+5),i%2]))};
  const b={name:'cpi',map:new Map(Array.from({length:30},(_,i)=>[day(i+8),100+i*.1]))};
  const x=alignMarkdownCovariates(history,[a,b],{maxPeriods:2000,maxYears:5});
  assert.equal(x.rows.length,30);
  assert.equal(x.rows[0].date,day(8));
  assert.equal(x.rows.at(-1).date,day(37));
  assert.deepEqual(x.covariateNames,['promo','cpi']);
  assert.ok(x.warnings.some(w=>w.includes('共通日付')));
});

test('limits explanatory variables to four',()=>{
  const history=coreRows(40);
  const vars=Array.from({length:MAX_MARKDOWN_COVARIATES+1},(_,j)=>({
    name:'v'+j,
    map:new Map(history.map((r,i)=>[r.date,i+j]))
  }));
  assert.throws(()=>alignMarkdownCovariates(history,vars,{maxPeriods:2000,maxYears:5}),/最大4個/);
});

test('hard observation cap keeps only the most recent 4000 points',()=>{
  const rows=Array.from({length:MAX_MARKDOWN_PERIODS+20},(_,i)=>({
    date:day(i,'2010-01-01'),price:i%2?1000:900,units:10+(i%3),stockout:false,index:i,covariates:[]
  }));
  const x=alignMarkdownCovariates(rows,[],{maxPeriods:MAX_MARKDOWN_PERIODS});
  assert.equal(x.rows.length,MAX_MARKDOWN_PERIODS);
  assert.equal(x.rows[0].date,day(20,'2010-01-01'));
  assert.ok(x.warnings.some(w=>w.includes('4000観測点')));
});

test('5-year tier trims older daily history by calendar span',()=>{
  const rows=Array.from({length:7*366},(_,i)=>({
    date:day(i,'2018-01-01'),price:i%3===0?1000:900,units:10+(i%4),stockout:false,index:i,covariates:[]
  }));
  const x=alignMarkdownCovariates(rows,[],{maxYears:5,maxPeriods:2000});
  assert.ok(x.rows.length<=1832);
  assert.ok(x.rows.length>1800);
  assert.ok(x.warnings.some(w=>w.includes('直近5年')));
});

test('10-year tier keeps ten years of monthly data regardless of low row count',()=>{
  const rows=Array.from({length:180},(_,i)=>({
    date:month(i),price:i%3===0?1000:900,units:10+(i%4),stockout:false,index:i,covariates:[]
  }));
  const x=alignMarkdownCovariates(rows,[],{maxYears:10,maxPeriods:4000});
  assert.equal(x.rows.length,121);
  assert.equal(x.rows[0].date,'2014-12-01');
  assert.equal(x.rows.at(-1).date,'2024-12-01');
});

test('plan policy maps normal markdown to 5 years and markdown10 to 10 years',()=>{
  assert.deepEqual(markdownHistoryPolicy(['markdown']),{maxYears:5,maxPeriods:2000,tier:'5y'});
  assert.deepEqual(markdownHistoryPolicy(['markdown','markdown10']),{maxYears:10,maxPeriods:4000,tier:'10y'});
});

test('holds recommendation when an added variable is almost the same as price',()=>{
  const history=coreRows(45);
  const competitor={name:'competitor_price',map:new Map(history.map(r=>[r.date,r.price*1.001]))};
  const x=analyzeMarkdownHistory({
    history,
    covariates:[competitor],
    maxYears:5,
    maxPeriods:2000,
    currentPrice:1000,
    unitCost:500,
    currentInventory:350,
    horizonPeriods:30,
    discounts:[0,.1],
    runs:1200
  });
  assert.equal(x.status,'HOLD');
  assert.equal(x.recommendation,null);
  assert.ok(x.warnings.some(w=>w.includes('多重共線性')));
});


test('core history file requires date price and units in the same table',()=>{
  const rows=parseMarkdownHistoryTable([
    ['date','price','units','inventory'],
    ['2026-01-01','1,000',8,40],
    ['2026-01-02',900,11,29]
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].price,1000);
  assert.equal(rows[1].units,11);
});

test('core history file rejects missing price column',()=>{
  assert.throws(()=>parseMarkdownHistoryTable([
    ['date','units'],
    ['2026-01-01',8],
    ['2026-01-02',11]
  ]),/price\/価格/);
});

test('core history file rejects duplicated dates and malformed price',()=>{
  assert.throws(()=>parseMarkdownHistoryTable([
    ['date','price','units'],
    ['2026-01-01',1000,8],
    ['2026-01-01',900,11]
  ]),/重複日付/);
  assert.throws(()=>parseMarkdownHistoryTable([
    ['date','price','units'],
    ['2026-01-01','abc',8],
    ['2026-01-02',900,11]
  ]),/価格が正の数値/);
});
