import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseDelimited,inspectTable,selectedSeries} from '../public/assets/importer.js';
import {parseDemand,analyze} from '../public/assets/logic.js';
import {parseMarkdownHistoryTable,analyzeMarkdownHistory} from '../public/assets/markdown.js';
import {parseCovariateTable} from '../public/assets/markdown-covariates.js';
import {analyzeFinancialHistory} from '../public/assets/markdown-financial.js';
import {markdownHistoryPolicy,freeManualIssue} from '../public/assets/plan-limits.js';

const read=name=>readFileSync(new URL('./fixtures/dirty-sweep/'+name,import.meta.url),'utf8');
const csv=name=>parseDelimited(read(name));
const log=(name,payload)=>console.log('DIRTY_SWEEP '+name+' '+JSON.stringify(payload));

test('importer absorbs BOM blank rows notes reordered whitespace and quoted thousands',()=>{
  const rows=csv('inventory_dirty.csv');
  const ins=inspectTable(rows);
  assert.equal(ins.detected.column,2);
  assert.deepEqual(ins.series.column.map(x=>x.name),['SKU-A','SKU-B']);
  const semicolon=inspectTable(csv('semicolon_quoted.csv'));
  assert.equal(semicolon.detected.column,2);
  assert.equal(semicolon.series.column[0].values[0],1200);
  log('importer_tolerated',{bom:true,blankRows:true,extraNotes:true,semicolon:true,quotedThousands:true});
});

test('inventory importer drops only the broken series when one series has an internal gap',()=>{
  const ins=inspectTable(csv('inventory_internal_gap.csv'));
  assert.equal(ins.detected.column,1);
  assert.equal(ins.series.column[0].name,'SKU-B');
  assert.equal(ins.rejected.column.length,1);
  assert.equal(ins.rejected.column[0].name,'SKU-A');
  assert.equal(ins.rejected.column[0].reason,'internal_gap');
  assert.deepEqual(selectedSeries(ins,'column',[ins.series.column[0].key])[0].values,[15,16,17,18,19]);
  log('inventory_internal_gap',{accepted:['SKU-B'],rejected:['SKU-A'],reason:'internal_gap'});
});

test('manual demand tolerates mixed separators but rejects textual NA and negatives',()=>{
  const values=parseDemand(' 10, 11\n12，13 ; 14  15 ');
  assert.deepEqual(values,[10,11,12,13,14,15]);
  assert.throws(()=>parseDemand('10,NA,12'),/無効/);
  assert.throws(()=>parseDemand('10,-1,12'),/無効/);
  assert.equal(freeManualIssue(values),null);
  log('manual_input',{mixedSeparators:'accepted',NA:'rejected',negative:'rejected'});
});

test('inventory simulation survives zeros and a moderate spike with explicit cautions',()=>{
  const demand=[10,11,9,10,0,12,11,10,9,11,10,12,35,11,10,9,10,12,11,10,9,10,11,12,10,9,11,10,12,11,10,9,10,11,12];
  const r=analyze({demand,leadTime:7,method:'sma',window:7,inventory:100});
  assert.ok(Number.isFinite(r.mean)&&Number.isFinite(r.sd));
  assert.ok(r.flags.some(x=>x.includes('需要0')));
  log('inventory_moderate_damage',{sigma:Number(r.sigma.toFixed(3)),stockout:Number(r.stockout.toFixed(2)),flags:r.flags});
});

test('Markdown core accepts reordered columns extra notes blank rows and thousand separators',()=>{
  const rows=parseMarkdownHistoryTable(csv('core_reordered_extra.csv'));
  assert.equal(rows.length,4);
  assert.equal(rows[0].price,1000);
  assert.equal(rows[0].units,10);
  assert.equal(rows[0].date,'2026-01-01');
  log('markdown_reordered',{rows:rows.length,first:rows[0]});
});

test('Markdown core accepts ragged transposed input and ignores irrelevant note row',()=>{
  const rows=parseMarkdownHistoryTable(csv('core_transposed_ragged.csv'));
  assert.equal(rows.length,4);
  assert.deepEqual(rows.map(x=>x.price),[1000,950,900,850]);
  log('markdown_transposed_ragged',{rows:rows.length,prices:rows.map(x=>x.price)});
});

test('Markdown rejects partial optional financial series instead of silently imputing',()=>{
  assert.throws(()=>parseMarkdownHistoryTable(csv('core_optional_gap.csv')),/売上.*数値/);
  assert.throws(()=>parseMarkdownHistoryTable(csv('core_bad_currency.csv')),/価格が正の数値/);
  log('markdown_finance_damage',{partialRevenue:'rejected',currencyDecoratedNumber:'rejected'});
});

test('Markdown recognizes common unit suffixes in headers',()=>{
  const rows=parseMarkdownHistoryTable(csv('core_units_in_headers.csv'));
  assert.equal(rows.length,4);
  assert.equal(rows[0].price,1000);
  assert.equal(rows[0].units,8);
  log('markdown_header_units',{accepted:true});
});

test('dirty covariate with comments whitespace BOM semicolon is accepted',()=>{
  const x=parseCovariateTable(csv('covariate_dirty.csv'),'promotion');
  assert.equal(x.name,'promotion');
  assert.equal(x.count,4);
  assert.deepEqual([...x.map.values()],[0,1,0,1]);
  log('covariate_tolerated',{name:x.name,count:x.count});
});

test('covariate internal missing value is rejected rather than compressed',()=>{
  assert.throws(()=>parseCovariateTable(csv('covariate_gap.csv'),'promotion'),/数値ではありません/);
  assert.throws(()=>parseCovariateTable([
    ['date','cpi'],
    ['2026-01-01',100],
    ['2026-01-02',100],
    ['2026-01-03',100]
  ],'cpi'),/全期間で一定/);
  log('covariate_damage',{internalGap:'rejected',constantSeries:'rejected'});
});

test('financial diagnostics remain finite on mildly damaged but valid rows',()=>{
  const base=parseMarkdownHistoryTable(csv('core_reordered_extra.csv'));
  const enriched=base.map((r,i)=>({...r,revenueReported:r.price*r.units+(i===2?250:0),unitCostHistorical:500+i*5}));
  const f=analyzeFinancialHistory(enriched,{enabled:true});
  assert.ok(Number.isFinite(f.metrics.revenue.mean));
  assert.ok(Number.isFinite(f.metrics.revenue.sd));
  assert.ok(f.correlations.length>0);
  log('financial_valid_noise',{revenueMean:Number(f.metrics.revenue.mean.toFixed(2)),revenueSd:Number(f.metrics.revenue.sd.toFixed(2)),correlations:f.correlations.length});
});

test('Markdown full analysis with slightly damaged but valid input either READY or transparent HOLD',()=>{
  const history=parseMarkdownHistoryTable(csv('core_reordered_extra.csv'));
  const expanded=[];
  for(let k=0;k<8;k++)for(const r of history){
    const d=new Date(r.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+k*7);
    expanded.push({...r,date:d.toISOString().slice(0,10),index:expanded.length,units:r.units+(k%3)-1});
  }
  const result=analyzeMarkdownHistory({
    history:expanded,maxYears:5,maxPeriods:2000,financialDiagnostics:false,
    currentPrice:900,unitCost:500,currentInventory:300,horizonPeriods:30,discounts:[0,.05,.1],runs:1200
  });
  assert.ok(['READY','HOLD'].includes(result.status));
  assert.ok(result.warnings.every(x=>typeof x==='string'));
  log('markdown_full',{status:result.status,slope:result.slope,r2:result.r2,warnings:result.warnings,recommendation:result.recommendation?.discount??null});
});

test('plan policies stay bounded when dirty data tests exercise long-history paths',()=>{
  assert.deepEqual(markdownHistoryPolicy(['markdown']),{maxYears:5,maxPeriods:2000,tier:'5y'});
  assert.deepEqual(markdownHistoryPolicy(['markdown','markdown10']),{maxYears:10,maxPeriods:4000,tier:'10y'});
});

test('all first-party JavaScript source areas remain included in repository-wide check surface',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const check=pkg.scripts.check;
  for(const required of [
    'public/assets/logic.js','public/assets/importer.js','public/assets/app.js','public/assets/markdown.js',
    'public/assets/markdown-financial.js','public/assets/markdown-covariates.js','public/assets/markdown-ui.js',
    'public/assets/pro.js','server/stripe.js','server/access.js','server/capacity.js',
    'functions/api/checkout.js','functions/api/entitlement.js','functions/api/stripe-webhook.js'
  ]) assert.ok(check.includes(required),required+' missing from check script');
  log('script_check_surface',{covered:true});
});
