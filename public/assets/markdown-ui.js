import {analyzeMarkdownHistory,parseMarkdownHistoryWorkbook} from './markdown.js';
import {loadWorkbook} from './importer.js';
import {MAX_MARKDOWN_COVARIATES,parseCovariateWorkbook} from './markdown-covariates.js';
import {markdownHistoryPolicy} from './plan-limits.js';

const $=id=>document.getElementById(id);
function pct(v){return (100*v).toFixed(1)+'%'}
function yen(v){return Number.isFinite(v)?Math.round(v).toLocaleString('ja-JP')+'円':'—'}

let markdownCovariates=[];
let markdownCoreHistory=null;

function render(result){
 const status=$('markdownStatus'),out=$('markdownResults'),table=$('markdownTableBody'),notes=$('markdownNotes');
 status.textContent=result.status==='READY'?'推定可能':'データ不足 / HOLD';
 status.className=result.status==='READY'?'ready-tag':'ready-tag pending-tag';
 const variableText=result.covariateNames?.length
   ? `追加変数: ${result.covariateNames.join(', ')}`
   : '追加変数: なし';
 const coefficients=Object.entries(result.covariateCoefficients||{})
   .map(([name,value])=>`${name}: ${Number(value).toFixed(3)}`);
 const correlations=(result.correlationDiagnostics||[])
   .filter(x=>Math.abs(x.r)>=0.85)
   .map(x=>`相関注意 ${x.a} × ${x.b}: r=${x.r.toFixed(3)}`);
 notes.textContent=[
   `契約上限: ${result.maxYears ?? '—'}年 / 最大${result.maxPeriods ?? '—'}観測点`,
   `使用期間: ${result.periodsUsed ?? result.usable.length}期 / 有効履歴: ${result.usable.length}期 / 価格水準: ${result.prices.length}`,
   variableText,
   result.slope===null?'価格反応: 推定不可':`価格反応係数: ${result.slope.toFixed(3)} / R²: ${result.r2===null?'—':result.r2.toFixed(3)}`,
   ...(coefficients.length?[`追加変数係数（標準化）: ${coefficients.join(' / ')}`]:[]),
   ...correlations,
   ...result.warnings
 ].join('\n');
 table.innerHTML=result.scenarios.map(s=>`<tr><td>${pct(s.discount)}</td><td>${yen(s.price)}</td><td>${s.expectedSales.toFixed(1)}</td><td>${s.expectedLeftover.toFixed(1)}</td><td>${pct(s.sellThroughProbability)}</td><td>${yen(s.expectedGrossProfit)}</td></tr>`).join('');
 const rec=$('markdownRecommendation');
 rec.textContent=result.recommendation
   ?`履歴モデル上の期待粗利益最大: ${pct(result.recommendation.discount)} 値下げ（期待粗利益 ${yen(result.recommendation.expectedGrossProfit)}）。因果効果の保証ではありません。`
   :'十分な価格履歴、または安定した変数構成がないため、値下げ率の推奨は行いません。';
 renderFinancial(result.financial);
 out.classList.remove('hidden');
}

function showCoreHistory(){
 const el=$('markdownCoreStatus');
 if(!el)return;
 if(!markdownCoreHistory){el.textContent='基準履歴ファイルが選択されていません';return;}
 const rows=markdownCoreHistory.rows;
 const hasRevenue=rows.some(r=>Number.isFinite(r.revenueReported));
 const hasCost=rows.some(r=>Number.isFinite(r.totalCost)||Number.isFinite(r.unitCostHistorical));
 const orientation=markdownCoreHistory.orientation==='transposed'?'転置→自動変換':'通常形式';
 el.textContent=`${markdownCoreHistory.file} / ${markdownCoreHistory.sheet} / ${rows.length}期 / ${orientation} / 売上:${hasRevenue?'あり':'なし'} / 費用:${hasCost?'あり':'なし'}`;
}

$('markdownCoreFile')?.addEventListener('change',async e=>{
 markdownCoreHistory=null;
 const file=e.target.files?.[0];
 try{
   if(!file)throw new Error('基準履歴ファイルを選択してください。');
   const workbook=await loadWorkbook(file);
   const parsed=parseMarkdownHistoryWorkbook(workbook);
   markdownCoreHistory={...parsed,file:file.name};
   showCoreHistory();
 }catch(err){
   e.target.value='';
   markdownCoreHistory=null;
   showCoreHistory();
   $('markdownResults').classList.remove('hidden');
   $('markdownRecommendation').textContent=err.message||String(err);
   $('markdownTableBody').innerHTML='';
   $('markdownNotes').textContent='';
 }
});

showCoreHistory();

function showCovariateFiles(){
 const el=$('markdownCovariateStatus');
 if(!el)return;
 if(!markdownCovariates.length){
   el.textContent=`追加説明変数なし（最大${MAX_MARKDOWN_COVARIATES}ファイル）`;
   return;
 }
 el.textContent=`${markdownCovariates.length}/${MAX_MARKDOWN_COVARIATES}変数: ${markdownCovariates.map(x=>`${x.name}（${x.count}期・${x.orientation==='transposed'?'転置→自動変換':'通常'}）`).join(' / ')}`;
}

$('markdownCovariateFiles')?.addEventListener('change',async e=>{
 markdownCovariates=[];
 const files=[...(e.target.files||[])];
 try{
   if(files.length>MAX_MARKDOWN_COVARIATES)throw new Error(`追加説明変数ファイルは最大${MAX_MARKDOWN_COVARIATES}個です。`);
   const parsed=[];
   for(const file of files){
     const workbook=await loadWorkbook(file);
     const fallback=(file.name||'variable').replace(/\.[^.]+$/,'').slice(0,80);
     parsed.push(parseCovariateWorkbook(workbook,fallback));
   }
   const names=new Set();
   for(const item of parsed){
     const key=item.name.toLowerCase();
     if(names.has(key))throw new Error(`追加変数名「${item.name}」が重複しています。ヘッダー名を分けてください。`);
     names.add(key);
   }
   markdownCovariates=parsed;
   showCovariateFiles();
 }catch(err){
   e.target.value='';
   markdownCovariates=[];
   showCovariateFiles();
   $('markdownResults').classList.remove('hidden');
   $('markdownRecommendation').textContent=err.message||String(err);
   $('markdownTableBody').innerHTML='';
   $('markdownNotes').textContent='';
 }
});

showCovariateFiles();

$('markdownForm')?.addEventListener('submit',e=>{
 e.preventDefault();
 try{
  if(!Array.isArray(globalThis.demandScopeCapabilities)||!globalThis.demandScopeCapabilities.includes('markdown'))throw new Error('値下げ判断を利用できる契約が必要です。');
  if(!markdownCoreHistory?.rows?.length)throw new Error('date / price / units を含む基準履歴ファイルを選択してください。');
  const discounts=$('markdownDiscounts').value.split(/[\s,，、;；]+/).filter(Boolean).map(x=>Number(x)/100);
  const policy=markdownHistoryPolicy(globalThis.demandScopeCapabilities);
  const r=analyzeMarkdownHistory({
    history:markdownCoreHistory?.rows,
    covariates:markdownCovariates,
    maxYears:policy.maxYears,
    maxPeriods:policy.maxPeriods,
    financialDiagnostics:globalThis.demandScopeCapabilities.includes('markdown10'),
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
