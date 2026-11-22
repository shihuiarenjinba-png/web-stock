import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseMarkdownHistoryTable,analyzeMarkdownHistory} from '../public/assets/markdown.js';

function readCsv(name){
  const text=readFileSync(new URL('./fixtures/noise/'+name,import.meta.url),'utf8').trim();
  return text.split(/\r?\n/).map(line=>line.split(','));
}
function summarize(name,result){
  const fin=result.financial||{};
  const corr=(fin.correlations||[]).map(x=>({
    pair:`${x.a}×${x.b}`,
    r:Number.isFinite(x.r)?Number(x.r.toFixed(3)):null,
    r_trim:Number.isFinite(x.rWithoutOutliers)?Number(x.rWithoutOutliers.toFixed(3)):null,
    sensitive:x.outlierSensitive
  }));
  const outliers=Object.entries(fin.metrics||{}).reduce((a,[k,m])=>{
    if(m?.outliers?.length)a[k]=m.outliers.map(x=>({date:x.date,z:Number(x.z.toFixed(2)),value:Number(x.value.toFixed(2))}));
    return a;
  },{});
  const summary={
    fixture:name,
    status:result.status,
    slope:Number.isFinite(result.slope)?Number(result.slope.toFixed(3)):null,
    r2:Number.isFinite(result.r2)?Number(result.r2.toFixed(3)):null,
    residualSd:Number.isFinite(result.residualSd)?Number(result.residualSd.toFixed(3)):null,
    recommendation:result.recommendation?{discount:result.recommendation.discount,price:Number(result.recommendation.price.toFixed(2)),grossProfit:Number(result.recommendation.expectedGrossProfit.toFixed(0))}:null,
    financialWarnings:fin.warnings||[],
    correlations:corr,
    outliers,
    warnings:result.warnings
  };
  console.log('NOISE_EXPERIMENT '+JSON.stringify(summary));
  return summary;
}
function analyze(name){
  const history=parseMarkdownHistoryTable(readCsv(name));
  return analyzeMarkdownHistory({
    history,
    maxYears:10,
    maxPeriods:4000,
    financialDiagnostics:true,
    currentPrice:1000,
    unitCost:510,
    currentInventory:500,
    horizonPeriods:30,
    discounts:[0,.05,.1,.15,.2],
    runs:1200
  });
}

test('clean fixture produces a strong usable price-response model',()=>{
  const s=summarize('clean_financial.csv',analyze('clean_financial.csv'));
  assert.equal(s.status,'READY');
  assert.ok(s.slope<0);
  assert.ok(s.r2>0.5);
});

test('heavy noise fixture is evaluated rather than silently treated as clean',()=>{
  const s=summarize('noisy_financial.csv',analyze('noisy_financial.csv'));
  assert.ok(['READY','HOLD'].includes(s.status));
  assert.ok(Number.isFinite(s.r2));
});

test('revenue outlier is surfaced and correlation sensitivity is measurable',()=>{
  const s=summarize('outlier_financial.csv',analyze('outlier_financial.csv'));
  assert.ok(Object.keys(s.outliers).length>0);
  assert.ok(s.financialWarnings.some(x=>x.includes('外れ値')));
});

test('near-flat price variation does not receive a strong clean-model verdict',()=>{
  const s=summarize('weak_price.csv',analyze('weak_price.csv'));
  assert.ok(s.r2<0.2||s.status==='HOLD');
});

test('malformed price fixture is rejected before analysis',()=>{
  assert.throws(()=>parseMarkdownHistoryTable(readCsv('malformed_price.csv')),/価格が正の数値/);
  console.log('NOISE_EXPERIMENT '+JSON.stringify({fixture:'malformed_price.csv',status:'REJECTED',reason:'invalid_price'}));
});

test('duplicate-date fixture is rejected before analysis',()=>{
  assert.throws(()=>parseMarkdownHistoryTable(readCsv('duplicate_date.csv')),/重複日付/);
  console.log('NOISE_EXPERIMENT '+JSON.stringify({fixture:'duplicate_date.csv',status:'REJECTED',reason:'duplicate_date'}));
});

test('price-like added variable triggers multicollinearity HOLD',()=>{
  const history=parseMarkdownHistoryTable(readCsv('clean_financial.csv'));
  const competitor={name:'competitor_price',map:new Map(history.map((r,i)=>[r.date,r.price*1.002+(i%2)*0.01]))};
  const result=analyzeMarkdownHistory({
    history,covariates:[competitor],maxYears:10,maxPeriods:4000,financialDiagnostics:true,
    currentPrice:1000,unitCost:510,currentInventory:500,horizonPeriods:30,discounts:[0,.1],runs:1200
  });
  const s=summarize('multicollinearity_synthetic',result);
  assert.equal(s.status,'HOLD');
  assert.ok(s.warnings.some(x=>x.includes('多重共線性')));
});


test('extreme units outlier blocks the price recommendation',()=>{
  const s=summarize('units_outlier.csv',analyze('units_outlier.csv'));
  assert.ok(s.financialWarnings.some(x=>x.includes('外れ値')));
  assert.equal(s.status,'HOLD');
  assert.equal(s.recommendation,null);
  assert.ok(s.warnings.some(x=>x.includes('5標準偏差')));
  console.log('NOISE_EXPERIMENT '+JSON.stringify({fixture:'units_outlier_model_effect',status:s.status,r2:s.r2,slope:s.slope,recommendation:s.recommendation}));
});

test('missing optional revenue or cost values are currently rejected explicitly',()=>{
  assert.throws(()=>parseMarkdownHistoryTable(readCsv('missing_optional_finance.csv')),/(売上|単位原価).*数値/);
  console.log('NOISE_EXPERIMENT '+JSON.stringify({fixture:'missing_optional_finance.csv',status:'REJECTED',reason:'optional_finance_missing_value'}));
});
