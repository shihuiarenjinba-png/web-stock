import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMarkdownHistory,estimatePriceResponse,analyzeMarkdownHistory} from '../public/assets/markdown.js';

test('parses bilingual history and marks censored stockouts',()=>{
 const x=parseMarkdownHistory('日付,価格,販売数,在庫\n2026-01-01,1000,5,20\n2026-01-02,900,10,10');
 assert.equal(x.length,2);assert.equal(x[0].stockout,false);assert.equal(x[1].stockout,true);
});

function synthetic(){
 const rows=[];
 for(let i=0;i<45;i++){const price=i<15?1000:i<30?900:800;const base=price===1000?8:price===900?11:15;rows.push({price,units:base+(i%3)-1,stockout:false,index:i})}
 return rows;
}

test('lower-price higher-sales history produces negative response slope',()=>{
 const x=estimatePriceResponse(synthetic());
 assert.equal(x.status,'READY');assert.ok(x.slope<0);assert.ok(Number.isFinite(x.residualSd));
});

test('one price level cannot identify markdown response',()=>{
 const rows=Array.from({length:40},(_,i)=>({price:1000,units:10+(i%2),stockout:false,index:i}));
 const x=estimatePriceResponse(rows);assert.equal(x.status,'HOLD');assert.equal(x.slope,null);
});

test('scenario analysis compares profit and sell-through locally',()=>{
 const x=analyzeMarkdownHistory({history:synthetic(),currentPrice:1000,unitCost:500,currentInventory:350,horizonPeriods:30,discounts:[0,.1,.2],runs:1200});
 assert.equal(x.status,'READY');assert.equal(x.scenarios.length,3);assert.ok(x.recommendation);
 assert.ok(x.scenarios.every(s=>s.sellThroughProbability>=0&&s.sellThroughProbability<=1));
 assert.ok(x.scenarios[2].demandMultiplier>x.scenarios[0].demandMultiplier);
});

test('stockout-censored rows do not drive the regression',()=>{
 const rows=synthetic();for(let i=0;i<10;i++)rows.push({price:700,units:2,stockout:true,index:rows.length});
 const x=estimatePriceResponse(rows);assert.equal(x.usable.length,45);assert.ok(x.warnings.some(w=>w.includes('除外')));
});
