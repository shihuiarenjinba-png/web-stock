import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeFinancialHistory} from '../public/assets/markdown-financial.js';
import {analyzeMarkdownHistory,parseMarkdownHistoryTable} from '../public/assets/markdown.js';

function rowsWithFinance(n=36){
  const rows=[['date','price','units','revenue','unit_cost']];
  const start=new Date('2026-01-01T00:00:00Z');
  for(let i=0;i<n;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    const price=i<12?1200:i<24?1000:850;
    const units=i<12?7+(i%2):i<24?10+(i%3):14+(i%3);
    const revenue=price*units-(i%5===0?50:0);
    const unitCost=500+(i%4)*5;
    rows.push([d.toISOString().slice(0,10),price,units,revenue,unitCost]);
  }
  return rows;
}

test('core history accepts reported revenue and one cost representation',()=>{
  const rows=parseMarkdownHistoryTable(rowsWithFinance(4));
  assert.equal(rows[0].revenueReported,8350);
  assert.equal(rows[0].unitCostHistorical,500);
  assert.equal(rows[0].totalCost,null);
});

test('core history rejects unit cost and total cost together',()=>{
  assert.throws(()=>parseMarkdownHistoryTable([
    ['date','price','units','unit_cost','total_cost'],
    ['2026-01-01',1000,10,400,4000],
    ['2026-01-02',900,11,400,4400]
  ]),/両方を同時/);
});

test('10Y financial diagnostics calculate revenue cost profit SD and correlations',()=>{
  const rows=parseMarkdownHistoryTable(rowsWithFinance());
  rows[20].revenueReported*=3;
  const x=analyzeFinancialHistory(rows,{enabled:true});
  assert.equal(x.enabled,true);
  assert.equal(x.revenueSource,'reported');
  assert.equal(x.costAvailable,true);
  assert.ok(x.metrics.revenue.sd>0);
  assert.ok(x.metrics.grossProfit.sd>0);
  assert.ok(x.correlations.some(v=>v.a==='price'&&v.b==='revenue'));
  assert.ok(Object.values(x.metrics).some(m=>m?.outliers?.length));
});

test('financial diagnostics remain disabled for the 5Y tier',()=>{
  const rows=parseMarkdownHistoryTable(rowsWithFinance());
  const x=analyzeFinancialHistory(rows,{enabled:false});
  assert.deepEqual(x,{enabled:false,available:false,reason:'plan_required'});
});

test('10Y Markdown analysis exposes financial diagnostics only when enabled',()=>{
  const history=parseMarkdownHistoryTable(rowsWithFinance());
  const common={
    history,
    maxYears:10,
    maxPeriods:4000,
    currentPrice:1000,
    unitCost:500,
    currentInventory:500,
    horizonPeriods:30,
    discounts:[0,.05,.1],
    runs:1200
  };
  const lower=analyzeMarkdownHistory({...common,financialDiagnostics:false});
  const upper=analyzeMarkdownHistory({...common,financialDiagnostics:true});
  assert.equal(lower.financial.enabled,false);
  assert.equal(upper.financial.enabled,true);
  assert.equal(upper.financial.revenueSource,'reported');
  assert.equal(upper.financial.costAvailable,true);
});
