import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze,SAMPLE} from '../public/assets/logic.js';
import {riskReportModel} from '../public/assets/pdf-report.js';

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
