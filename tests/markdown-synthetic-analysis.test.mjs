import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {analyzeMarkdownHistory,parseMarkdownHistoryTable} from '../public/assets/markdown.js';
import {parseCovariateTable} from '../public/assets/markdown-covariates.js';

const base='tests/fixtures/markdown-synthetic/';
function readCsv(name){
  const text=readFileSync(base+name,'utf8').trim();
  return text.split(/\r?\n/).map(line=>line.split(','));
}
function parseCore(name){return parseMarkdownHistoryTable(readCsv(name))}
function common(history){
  return {
    history,
    maxYears:10,
    maxPeriods:4000,
    financialDiagnostics:true,
    currentPrice:1000,
    unitCost:500,
    currentInventory:800,
    horizonPeriods:30,
    discounts:[0,.05,.1,.15,.2],
    runs:1200
  };
}
function summarize(x){
  const corrs=(x.financial?.correlations||[]).map(v=>({
    pair:`${v.a}~${v.b}`,
    r:Number(v.r?.toFixed?.(3)),
    trimmed:Number(v.rWithoutOutliers?.toFixed?.(3)),
    outlierSensitive:v.outlierSensitive
  }));
  return {
    status:x.status,
    slope:Number.isFinite(x.slope)?Number(x.slope.toFixed(3)):null,
    r2:Number.isFinite(x.r2)?Number(x.r2.toFixed(3)):null,
    residualSd:Number.isFinite(x.residualSd)?Number(x.residualSd.toFixed(3)):null,
    recommendation:x.recommendation?{
      discount:Number(x.recommendation.discount.toFixed(3)),
      price:Math.round(x.recommendation.price),
      expectedGrossProfit:Math.round(x.recommendation.expectedGrossProfit)
    }:null,
    warnings:x.warnings,
    financialWarnings:x.financial?.warnings||[],
    correlations:corrs,
    revenueOutliers:x.financial?.metrics?.revenue?.outliers?.map(o=>({date:o.date,z:Number(o.z.toFixed(2))}))||[],
    grossProfitOutliers:x.financial?.metrics?.grossProfit?.outliers?.map(o=>({date:o.date,z:Number(o.z.toFixed(2))}))||[]
  };
}

test('synthetic clean/noisy/outlier/flat/collinear files exercise production analysis',()=>{
  const clean=analyzeMarkdownHistory(common(parseCore('clean_signal.csv')));
  const noisy=analyzeMarkdownHistory(common(parseCore('noisy_signal.csv')));
  const outlier=analyzeMarkdownHistory(common(parseCore('finance_outlier.csv')));
  const flat=analyzeMarkdownHistory(common(parseCore('flat_price.csv')));

  const collHistory=parseCore('collinear_base.csv');
  const collParsed=parseCovariateTable(readCsv('collinear_competitor.csv'),'competitor_price');
  const collinear=analyzeMarkdownHistory({
    ...common(collHistory),
    covariates:[collParsed]
  });

  let missingPriceError='';
  try{parseCore('missing_price.csv')}catch(e){missingPriceError=e.message}

  const report={
    clean:summarize(clean),
    noisy:summarize(noisy),
    financial_outlier:summarize(outlier),
    flat_price:summarize(flat),
    collinear:summarize(collinear),
    missing_price:{error:missingPriceError}
  };
  console.log('SYNTHETIC_ANALYSIS_RESULT='+JSON.stringify(report));

  assert.equal(clean.status,'READY');
  assert.ok(clean.slope<0);
  assert.ok(clean.r2>0.5);

  assert.equal(noisy.status,'READY');
  assert.ok(noisy.slope<0);
  assert.ok(noisy.r2<clean.r2);

  assert.equal(flat.status,'HOLD');
  assert.equal(flat.slope,null);
  assert.ok(flat.warnings.some(w=>w.includes('価格水準が1つ')));

  assert.equal(outlier.financial.enabled,true);
  assert.ok(outlier.financial.metrics.revenue.outliers.length>=1);
  assert.ok(outlier.financial.warnings.some(w=>w.includes('外れ値')));

  assert.equal(collinear.status,'HOLD');
  assert.ok(collinear.warnings.some(w=>w.includes('多重共線性')));

  assert.match(missingPriceError,/price\/価格/);
});
