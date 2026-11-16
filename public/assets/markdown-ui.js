import {analyzeMarkdownHistory} from './markdown.js';
const $=id=>document.getElementById(id);
function pct(v){return (100*v).toFixed(1)+'%'}
function yen(v){return Number.isFinite(v)?Math.round(v).toLocaleString('ja-JP')+'円':'—'}
function render(result){
 const status=$('markdownStatus'),out=$('markdownResults'),table=$('markdownTableBody'),notes=$('markdownNotes');
 status.textContent=result.status==='READY'?'推定可能':'データ不足 / HOLD';
 status.className=result.status==='READY'?'ready-tag':'ready-tag pending-tag';
 notes.textContent=[`有効履歴: ${result.usable.length}期 / 価格水準: ${result.prices.length}`,result.slope===null?'価格反応: 推定不可':`価格反応係数: ${result.slope.toFixed(3)} / R²: ${result.r2===null?'—':result.r2.toFixed(3)}`,...result.warnings].join('\n');
 table.innerHTML=result.scenarios.map(s=>`<tr><td>${pct(s.discount)}</td><td>${yen(s.price)}</td><td>${s.expectedSales.toFixed(1)}</td><td>${s.expectedLeftover.toFixed(1)}</td><td>${pct(s.sellThroughProbability)}</td><td>${yen(s.expectedGrossProfit)}</td></tr>`).join('');
 const rec=$('markdownRecommendation');
 rec.textContent=result.recommendation
   ?`履歴モデル上の期待粗利益最大: ${pct(result.recommendation.discount)} 値下げ（期待粗利益 ${yen(result.recommendation.expectedGrossProfit)}）。因果効果の保証ではありません。`
   :'十分な価格履歴がないため、値下げ率の推奨は行いません。';
 out.classList.remove('hidden');
}
$('markdownForm')?.addEventListener('submit',e=>{
 e.preventDefault();
 try{
  if(!Array.isArray(globalThis.demandScopeCapabilities)||!globalThis.demandScopeCapabilities.includes('markdown'))throw new Error('値下げ判断を利用できる契約が必要です。');
  const discounts=$('markdownDiscounts').value.split(/[\s,，、;；]+/).filter(Boolean).map(x=>Number(x)/100);
  const r=analyzeMarkdownHistory({
    history:$('markdownHistory').value,
    currentPrice:Number($('markdownCurrentPrice').value),
    unitCost:Number($('markdownUnitCost').value),
    currentInventory:Number($('markdownInventory').value),
    horizonPeriods:Number($('markdownHorizon').value),
    leftoverPenalty:Number($('markdownLeftoverPenalty').value||0),
    discounts,
    runs:3000
  });
  render(r);
 }catch(err){
  $('markdownResults').classList.remove('hidden');
  $('markdownRecommendation').textContent=err.message||String(err);
  $('markdownTableBody').innerHTML='';
  $('markdownNotes').textContent='';
 }
});
