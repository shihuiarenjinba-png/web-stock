import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseDelimited} from '../public/assets/importer.js';
import {parseMarkdownHistoryTable,analyzeMarkdownHistory} from '../public/assets/markdown.js';
import {parseCovariateTable} from '../public/assets/markdown-covariates.js';

const fixture=name=>readFileSync(new URL('./fixtures/markdown/'+name,import.meta.url),'utf8');
const parseCore=name=>parseMarkdownHistoryTable(parseDelimited(fixture(name)));
const summarize=x=>({
  status:x.status,
  periods:x.periodsUsed,
  slope:Number.isFinite(x.slope)?Number(x.slope.toFixed(4)):null,
  r2:Number.isFinite(x.r2)?Number(x.r2.toFixed(4)):null,
  residualSd:Number.isFinite(x.residualSd)?Number(x.residualSd.toFixed(4)):null,
  recommendation:x.recommendation?{
    discount:Number(x.recommendation.discount.toFixed(4)),
    price:Number(x.recommendation.price.toFixed(2)),
    expectedGrossProfit:Number(x.recommendation.expectedGrossProfit.toFixed(2))
  }:null,
  revenueMean:x.financial?.metrics?.revenue?Number(x.financial.metrics.revenue.mean.toFixed(2)):null,
  revenueSd:x.financial?.metrics?.revenue?Number(x.financial.metrics.revenue.sd.toFixed(2)):null,
  grossProfitMean:x.financial?.metrics?.grossProfit?Number(x.financial.metrics.grossProfit.mean.toFixed(2)):null,
  grossProfitSd:x.financial?.metrics?.grossProfit?Number(x.financial.metrics.grossProfit.sd.toFixed(2)):null,
  outlierCount:Object.values(x.financial?.metrics||{}).filter(Boolean).reduce((n,m)=>n+(m.outliers?.length||0),0),
  correlations:(x.financial?.correlations||[]).map(c=>({
    pair:c.a+'~'+c.b,
    r:Number.isFinite(c.r)?Number(c.r.toFixed(4)):null,
    trimmed:Number.isFinite(c.rWithoutOutliers)?Number(c.rWithoutOutliers.toFixed(4)):null,
    sensitive:c.outlierSensitive
  })),
  warnings:[...(x.warnings||[]),...(x.financial?.warnings||[])]
});

function analyze(rows,covariates=[]){
  return analyzeMarkdownHistory({
    history:rows,
    covariates,
    maxYears:10,
    maxPeriods:4000,
    financialDiagnostics:true,
    currentPrice:900,
    unitCost:500,
    currentInventory:1000,
    horizonPeriods:30,
    discounts:[0,.05,.1,.15,.2],
    runs:1200
  });
}

test('clean 10Y fixture produces a stable analyzable result',()=>{
  const result=analyze(parseCore('clean_10y_monthly.csv'));
  const summary=summarize(result);
  console.log('FIXTURE_ANALYSIS clean',JSON.stringify(summary));
  assert.equal(result.status,'READY');
  assert.ok(result.slope<0);
  assert.ok(result.r2>0.5);
  assert.equal(result.financial.costAvailable,true);
});

test('noisy fixture still runs and surfaces outliers/uncertainty',()=>{
  const result=analyze(parseCore('noisy_10y_monthly.csv'));
  const summary=summarize(result);
  console.log('FIXTURE_ANALYSIS noisy',JSON.stringify(summary));
  assert.ok(Number.isFinite(result.slope));
  assert.ok(Number.isFinite(result.r2));
  assert.ok(result.r2<0.05);
  assert.equal(result.status,'HOLD');
  assert.equal(result.recommendation,null);
  assert.ok(summary.outlierCount>0);
  assert.ok(result.warnings.some(w=>w.includes('ほとんど説明できません')));
  assert.ok(result.financial.warnings.length>0);
});

test('dirty Japanese CSV with BOM quoted commas is accepted by parser',()=>{
  const rows=parseCore('dirty_japanese_numeric.csv');
  console.log('FIXTURE_ANALYSIS dirty',JSON.stringify({rows:rows.length,first:rows[0],last:rows.at(-1)}));
  assert.equal(rows.length,5);
  assert.equal(rows[0].price,1200);
  assert.equal(rows[0].revenueReported,9600);
  assert.equal(rows.at(-1).unitCostHistorical,530);
});

test('missing price file is rejected before analysis',()=>{
  assert.throws(()=>parseCore('broken_missing_price.csv'),/price\/価格/);
  console.log('FIXTURE_ANALYSIS missing_price',JSON.stringify({rejected:true,reason:'required price column missing'}));
});

test('duplicate date file is rejected before analysis',()=>{
  assert.throws(()=>parseCore('broken_duplicate_date.csv'),/重複日付/);
  console.log('FIXTURE_ANALYSIS duplicate_date',JSON.stringify({rejected:true,reason:'duplicate date'}));
});

test('near-duplicate competitor price triggers multicollinearity HOLD',()=>{
  const core=parseCore('clean_10y_monthly.csv');
  const cov=parseCovariateTable(parseDelimited(fixture('high_corr_competitor.csv')),'competitor');
  const result=analyze(core,[cov]);
  const summary=summarize(result);
  console.log('FIXTURE_ANALYSIS high_corr',JSON.stringify(summary));
  assert.equal(result.status,'HOLD');
  assert.equal(result.recommendation,null);
  assert.ok(result.warnings.some(w=>w.includes('多重共線性')));
});
