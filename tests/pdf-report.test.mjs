import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze,SAMPLE} from '../public/assets/logic.js';
import {riskReportModel,portfolioNarrative} from '../public/assets/pdf-report.js';

test('PDF report model includes portfolio summary and decision fields',()=>{
 const result=analyze({demand:SAMPLE,leadTime:7,service:95,inventory:320});
 const [row]=riskReportModel({results:[{name:'SKU-A',result}],language:'ja'});
 assert.equal(row.name,'SKU-A');
 assert.equal(row.summary[0],'SKU-A');
 assert.ok(row.details.some(x=>x[0]==='推奨発注点'));
 assert.ok(row.details.some(x=>x[0]==='安全在庫'));
 assert.ok(row.details.some(x=>x[0]==='在庫切れ確率'));
 assert.ok(row.details.some(x=>x[0]==='ボラティリティ内訳'));
 assert.equal(row.sums.length,4000);
});

test('PDF report model carries actual model cautions instead of generic warnings',()=>{
 const short=analyze({demand:[10,12,9,11,15,8,14,10,13,12],leadTime:2,service:95,method:'sma',window:3});
 const [row]=riskReportModel({results:[{name:'Short history',result:short}],language:'ja'});
 assert.ok(row.flags.length>0);
 assert.ok(row.flags.some(x=>x.includes('30期未満')||x.includes('残差')));
});

test('PDF report model supports multiple products and English labels',()=>{
 const a=analyze({demand:SAMPLE,leadTime:5,service:90});
 const b=analyze({demand:SAMPLE.map(v=>v+3),leadTime:10,service:97});
 const rows=riskReportModel({results:[{name:'A',result:a},{name:'B',result:b}],language:'en'});
 assert.equal(rows.length,2);
 assert.ok(rows[0].details.some(x=>x[0]==='Reorder point'));
 assert.ok(rows[1].details.some(x=>x[0]==='Service level'));
});

test('PDF report model rejects empty export',()=>{
 assert.throws(()=>riskReportModel({results:[],language:'ja'}),/No results/);
});


test('Pro PDF narrative ranks the highest stockout risk and gives actionable context',()=>{
 const a=analyze({demand:SAMPLE,leadTime:7,service:95,inventory:250});
 const b=analyze({demand:SAMPLE.map(v=>v+3),leadTime:7,service:95,inventory:420});
 const narrative=portfolioNarrative({results:[{name:'SKU-A',result:a},{name:'SKU-B',result:b}],language:'ja'});
 assert.ok(narrative.overview.some(x=>x.includes('2商品')));
 assert.ok(narrative.overview.some(x=>x.includes('SKU-A')||x.includes('SKU-B')));
 assert.equal(narrative.priorities.length,2);
 assert.match(narrative.priorities[0],/現在庫/);
 assert.ok(narrative.actions.some(x=>x.includes('在庫ポジション')));
});

test('Pro PDF narrative handles missing inventory without inventing stockout risk',()=>{
 const r=analyze({demand:SAMPLE,leadTime:7,service:95,inventory:null});
 const narrative=portfolioNarrative({results:[{name:'SKU-X',result:r}],language:'ja'});
 assert.ok(narrative.overview.some(x=>x.includes('欠品確率比較はまだできません')));
 assert.ok(narrative.priorities[0].includes('現在庫を入力'));
});
