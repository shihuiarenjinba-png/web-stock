import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MARKDOWN_COVARIATES,
  MAX_MARKDOWN_PERIODS,
  alignMarkdownCovariates,
  normalizeDateKey,
  parseCovariateTable
} from '../public/assets/markdown-covariates.js';
import {analyzeMarkdownHistory} from '../public/assets/markdown.js';

function day(i){
  const d=new Date(Date.UTC(2024,0,1+i));
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
  const x=alignMarkdownCovariates(history,[a,b]);
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
  assert.throws(()=>alignMarkdownCovariates(history,vars),/最大4個/);
});

test('caps analysis to the most recent 730 periods',()=>{
  const rows=Array.from({length:MAX_MARKDOWN_PERIODS+20},(_,i)=>({
    date:day(i),price:i%2?1000:900,units:10+(i%3),stockout:false,index:i,covariates:[]
  }));
  const x=alignMarkdownCovariates(rows,[]);
  assert.equal(x.rows.length,MAX_MARKDOWN_PERIODS);
  assert.equal(x.rows[0].date,day(20));
  assert.ok(x.warnings.some(w=>w.includes('直近730期')));
});

test('holds recommendation when an added variable is almost the same as price',()=>{
  const history=coreRows(45);
  const competitor={name:'competitor_price',map:new Map(history.map(r=>[r.date,r.price*1.001]))};
  const x=analyzeMarkdownHistory({
    history,
    covariates:[competitor],
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
