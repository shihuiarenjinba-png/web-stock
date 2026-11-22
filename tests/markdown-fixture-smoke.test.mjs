import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseDelimited} from '../public/assets/importer.js';
import {parseCovariateTable} from '../public/assets/markdown-covariates.js';
import {analyzeMarkdownHistory,parseMarkdownHistoryTable} from '../public/assets/markdown.js';

function fixture(name){
  const text=readFileSync(new URL('./fixtures/markdown/'+name,import.meta.url),'utf8');
  return parseDelimited(text,',');
}
function history(name){return parseMarkdownHistoryTable(fixture(name))}
function summarize(label,x){
  const outliers=x.financial?.metrics
    ? Object.values(x.financial.metrics).filter(Boolean).reduce((s,m)=>s+(m.outliers?.length||0),0)
    : 0;
  const summary={
    label,
    status:x.status,
    slope:Number.isFinite(x.slope)?Number(x.slope.toFixed(4)):null,
    r2:Number.isFinite(x.r2)?Number(x.r2.toFixed(4)):null,
    residualSd:Number.isFinite(x.residualSd)?Number(x.residualSd.toFixed(4)):null,
    recommendationDiscount:Number.isFinite(x.recommendation?.discount)?x.recommendation.discount:null,
    costAvailable:x.financial?.costAvailable??null,
    revenueSource:x.financial?.revenueSource??null,
    outlierCount:outliers,
    warnings:[...(x.warnings||[]),...(x.financial?.warnings||[])]
  };
  console.log('FIXTURE_ANALYSIS '+JSON.stringify(summary));
  return summary;
}
function run(rows,extra={}){
  return analyzeMarkdownHistory({
    history:rows,
    covariates:[],
    maxYears:10,
    maxPeriods:4000,
    financialDiagnostics:true,
    currentPrice:1000,
    unitCost:500,
    currentInventory:1000,
    horizonPeriods:30,
    discounts:[0,.05,.1,.15,.2],
    runs:1200,
    ...extra
  });
}

test('clean signal is analyzable with negative price response',()=>{
  const x=run(history('clean_signal.csv'));
  const s=summarize('clean_signal',x);
  assert.equal(s.status,'READY');
  assert.ok(s.slope<0);
  assert.ok(s.r2>0.5);
  assert.equal(s.costAvailable,true);
});

test('strong noise does not crash and reports materially weaker fit than clean fixture',()=>{
  const cleanResult=run(history('clean_signal.csv'));
  const noisyResult=run(history('noisy_signal.csv'));
  const c=summarize('clean_reference',cleanResult);
  const n=summarize('noisy_signal',noisyResult);
  assert.ok(Number.isFinite(n.r2));
  assert.ok(n.r2<c.r2);
  assert.ok(n.residualSd>c.residualSd);
});

test('single shock is detected as an outlier candidate',()=>{
  const x=run(history('outlier_shock.csv'));
  const s=summarize('outlier_shock',x);
  assert.ok(s.outlierCount>0);
  assert.ok(x.financial.warnings.some(w=>w.includes('外れ値')));
});

test('flat-price history is held because price response cannot be identified',()=>{
  const x=run(history('flat_price.csv'));
  const s=summarize('flat_price',x);
  assert.equal(s.status,'HOLD');
  assert.equal(s.slope,null);
  assert.ok(s.warnings.some(w=>w.includes('価格水準が1つ')));
});

test('missing cost keeps demand analysis but disables gross-profit diagnostics',()=>{
  const x=run(history('missing_cost.csv'));
  const s=summarize('missing_cost',x);
  assert.equal(s.costAvailable,false);
  assert.ok(s.warnings.some(w=>w.includes('費用列がない')));
  assert.equal(x.financial.metrics.grossProfit,null);
});

test('malformed core file is rejected before analysis',()=>{
  assert.throws(
    ()=>history('malformed_duplicate_bad_price.csv'),
    /重複日付|価格が正の数値/
  );
  console.log('FIXTURE_ANALYSIS '+JSON.stringify({label:'malformed_duplicate_bad_price',status:'REJECTED_AS_EXPECTED'}));
});

test('near-duplicate external price variable triggers multicollinearity HOLD',()=>{
  const rows=history('clean_signal.csv');
  const parsed=parseCovariateTable(fixture('collinear_competitor_price.csv'),'competitor_price');
  const x=run(rows,{covariates:[parsed]});
  const s=summarize('collinear_competitor_price',x);
  assert.equal(s.status,'HOLD');
  assert.ok(s.warnings.some(w=>w.includes('多重共線性')));
});
