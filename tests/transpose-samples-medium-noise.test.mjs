import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseDelimited,inspectTable,transposeTable} from '../public/assets/importer.js';
import {parseMarkdownHistoryTable,analyzeMarkdownHistory} from '../public/assets/markdown.js';
import {parseCovariateTable} from '../public/assets/markdown-covariates.js';

function readCsv(path){
  return parseDelimited(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
}
function analyzeFixture(path){
  const history=parseMarkdownHistoryTable(readCsv(path));
  return analyzeMarkdownHistory({
    history,
    maxYears:10,
    maxPeriods:4000,
    financialDiagnostics:true,
    currentPrice:1000,
    unitCost:520,
    currentInventory:500,
    horizonPeriods:30,
    discounts:[0,.05,.1,.15,.2],
    runs:1200
  });
}

test('transpose helper preserves rectangular table content',()=>{
  const src=[['date','2026-01-01','2026-01-02'],['price',1000,900],['units',10,12]];
  assert.deepEqual(transposeTable(src),[
    ['date','price','units'],
    ['2026-01-01',1000,10],
    ['2026-01-02',900,12]
  ]);
});

test('core Markdown sample parses identically in normal and transposed form',()=>{
  const normal=parseMarkdownHistoryTable(readCsv('public/samples/markdown-core-basic.csv'));
  const transposed=parseMarkdownHistoryTable(readCsv('public/samples/markdown-core-basic-transposed.csv'));
  assert.equal(normal.length,36);
  assert.deepEqual(transposed,normal);
});

test('10Y financial sample parses identically in normal and transposed form',()=>{
  const normal=parseMarkdownHistoryTable(readCsv('public/samples/markdown-core-10y-financial.csv'));
  const transposed=parseMarkdownHistoryTable(readCsv('public/samples/markdown-core-10y-financial-transposed.csv'));
  assert.equal(normal.length,36);
  assert.deepEqual(transposed,normal);
  assert.ok(normal.every(r=>Number.isFinite(r.revenueReported)));
  assert.ok(normal.every(r=>Number.isFinite(r.unitCostHistorical)));
});

test('covariate sample parses identically in normal and transposed form',()=>{
  const normal=parseCovariateTable(readCsv('public/samples/markdown-covariate-promotion.csv'),'promotion');
  const transposed=parseCovariateTable(readCsv('public/samples/markdown-covariate-promotion-transposed.csv'),'promotion');
  assert.equal(normal.name,'promotion');
  assert.equal(transposed.name,'promotion');
  assert.deepEqual([...transposed.map.entries()],[...normal.map.entries()]);
});

test('inventory samples expose equivalent demand series in both orientations',()=>{
  const normal=inspectTable(readCsv('public/samples/inventory-demand.csv'));
  const transposed=inspectTable(readCsv('public/samples/inventory-demand-transposed.csv'));
  assert.equal(normal.detected.column,2);
  assert.equal(transposed.detected.row,2);
  const n=normal.series.column.map(x=>x.values);
  const t=transposed.series.row.map(x=>x.values);
  assert.deepEqual(t,n);
});

test('medium noise fixture is analyzed and reports a moderate fit without fabricating certainty',()=>{
  const result=analyzeFixture('tests/fixtures/noise/medium_noise.csv');
  console.log('MEDIUM_NOISE_EXPERIMENT '+JSON.stringify({
    status:result.status,
    slope:Number(result.slope?.toFixed(3)),
    r2:Number(result.r2?.toFixed(3)),
    residualSd:Number(result.residualSd?.toFixed(3)),
    recommendation:result.recommendation?{
      discount:result.recommendation.discount,
      price:Number(result.recommendation.price.toFixed(2)),
      grossProfit:Number(result.recommendation.expectedGrossProfit.toFixed(0))
    }:null,
    warnings:result.warnings,
    financialWarnings:result.financial?.warnings||[]
  }));
  assert.ok(result.r2>0.05&&result.r2<0.8);
  assert.ok(result.slope<0);
});

test('sample files meet the minimum Markdown history requirement',()=>{
  for(const path of ['public/samples/markdown-core-basic.csv','public/samples/markdown-core-10y-financial.csv']){
    const rows=parseMarkdownHistoryTable(readCsv(path));
    assert.ok(rows.length>=28);
    assert.ok(new Set(rows.map(r=>r.price)).size>=2);
  }
});
