import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze,parseDemand,RUNS,reportText,SAMPLE,riskLabel} from '../public/assets/logic.js';
test('multiline comma Japanese comma parsing',()=>{assert.deepEqual(parseDemand('1, 2\n3，4;5'),[1,2,3,4,5]);});
test('bad data rejected',()=>{assert.throws(()=>parseDemand('1,not-number,2'),/無効/);assert.throws(()=>parseDemand('2,-1,3'),/無効/);});
test('constant demand zero residual and safe stock',()=>{const r=analyze({demand:Array(35).fill(10),leadTime:7,service:95,method:'overall',inventory:69});assert.equal(r.sigma,0);assert.equal(r.mean,70);assert.equal(r.reorderPoint,70);assert.equal(r.safetyStock,0);assert.equal(r.stockout,100);});
test('rolling baseline has no lookahead',()=>{const r=analyze({demand:[1,1,1,10,10,10,10,10],method:'sma',window:3,leadTime:2});assert.equal(r.baselines[3],1);assert.equal(r.baselines[4],4);assert.equal(r.futureBaseline,10);});
test('simulated percentiles ordered, seed reproducible',()=>{const p={demand:SAMPLE,leadTime:7,method:'sma',service:95,inventory:400};const r=analyze(p),b=analyze(p);assert.equal(r.sums.length,RUNS);assert.deepEqual(r.sums,b.sums);assert.ok(r.p90<=r.p95&&r.p95<=r.p99);assert.ok(r.reorderPoint>=r.mean);assert.ok(r.stockout>=0&&r.stockout<=100);assert.match(reportText(r),/在庫切れ確率/);});
test('larger inventory reduces stockout risk',()=>{const a=analyze({demand:SAMPLE,leadTime:7,inventory:200});const b=analyze({demand:SAMPLE,leadTime:7,inventory:600});assert.ok(a.stockout>b.stockout);});
test('valid input bounds',()=>{assert.throws(()=>analyze({demand:[1,2,3],service:100}),/サービス/);assert.throws(()=>analyze({demand:[1,2,3],leadTime:0}),/リードタイム/);assert.equal(riskLabel(null),'比較不可');});


test('conservative volatility never drops below component estimates',()=>{
 const r=analyze({demand:SAMPLE,leadTime:7,method:'sma',window:7});
 assert.ok(r.sigma>=r.sigmaLong-1e-12);
 assert.ok(r.sigma>=r.sigmaRecent-1e-12);
 assert.ok(r.sigma>=r.sigmaEwma-1e-12);
 assert.ok(['long','recent','ewma'].includes(r.volatilityDriver));
 assert.ok(r.recentWindow>=10&&r.recentWindow<=28);
});
test('recent volatility jump is not diluted by calmer old history',()=>{
 const calm=Array.from({length:55},(_,i)=>100+(i%3)-1);
 const turbulent=[72,130,75,128,70,135,78,125,73,132,76,129,71,136,74];
 const r=analyze({demand:[...calm,...turbulent],leadTime:7,method:'sma',window:7});
 assert.ok(r.sigmaRecent>r.sigmaLong);
 assert.equal(r.sigma,r.sigmaRecent);
 assert.equal(r.volatilityDriver,'recent');
 assert.ok(r.flags.some(x=>x.includes('短期リスク')||x.includes('直近')));
});
test('simulation remains finite sorted and reproducible after volatility guard',()=>{
 const p={demand:SAMPLE,leadTime:5,method:'overall',service:97};
 const r=analyze(p), b=analyze(p);
 assert.equal(r.sums.length,4000);
 assert.ok(r.sums.every(Number.isFinite));
 assert.ok(r.sums.every((v,i,a)=>i===0||a[i-1]<=v));
 assert.deepEqual(r.sums,b.sums);
 assert.ok(Number.isFinite(r.sigmaLong)&&Number.isFinite(r.sigmaRecent)&&Number.isFinite(r.sigmaEwma));
});
