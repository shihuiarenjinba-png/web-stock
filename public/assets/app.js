import {drawHistogram} from './chart.js';
import {analyze,parseDemand,SAMPLE,formatNumber,riskLabel,reportText} from './logic.js';
import {loadWorkbook,inspectTable,selectedSeries,toCSV,downloadText} from './importer.js';
import {initI18n,lang,t,errorMessage,applyI18n} from './i18n.js';
import {freeFileIssue,freeSeriesIssue,freeManualIssue} from './plan-limits.js';
const $=id=>document.getElementById(id), f=n=>formatNumber(n,1,lang());
const form=$('form'),status=$('status');
let workbook=null,inspection=null, results=[],selected=0, fileReadSequence=0;
function invalidateResults(){
 if(!results.length)return;
 results=[];selected=0;
 $('empty').classList.remove('hidden');$('results').classList.add('hidden');$('freeMulti').classList.add('hidden');
 status.textContent=lang()==='en'?'Input changed — run again':'入力を変更しました・再実行してください';
 status.classList.add('pending-tag');
}

function notify(s){const n=$('toast');n.textContent=s;n.classList.remove('hidden');setTimeout(()=>n.classList.add('hidden'),2500);}
function error(e){const n=$('error');n.textContent=errorMessage(e);n.classList.remove('hidden');}
function clearError(){$('error').classList.add('hidden')}
function options(el,values){el.replaceChildren(...values.map((x,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent=x;return op}));}
function preview(target,ins){const table=document.createElement('table');ins.preview.forEach(row=>{const tr=document.createElement('tr');row.forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.append(td)});table.append(tr)});$(target).replaceChildren(table);}
function readSheet(){
 const i=Number($('freeSheet').value);inspection=inspectTable(workbook.sheets[i].rows);
 $('freeOrientation').value=inspection.orientation;renderSeries();preview('freePreview',inspection);
}
function renderSeries(){
 const axis=$('freeOrientation').value,all=inspection?.series[axis]||[],root=$('freeSeries');
 const previous=new Map([...root.querySelectorAll('input[type=checkbox]')].map(x=>[x.value,{checked:x.checked,stock:x.closest('label')?.querySelector('.series-stock')?.value||''}]));root.replaceChildren();
 all.forEach((s,i)=>{
   const wrap=document.createElement('label');wrap.className='series-item';
   const input=document.createElement('input');input.type='checkbox';input.value=s.key;input.checked=previous.has(s.key)?previous.get(s.key).checked:i<2;
   input.addEventListener('change',()=>{
     const selected=[...root.querySelectorAll('input:checked')];
     if(selected.length>2){input.checked=false;notify(lang()==='en'?'Free: select up to 2 series.':'無料版では2系列まで選択できます。');}
     refreshLimits();
   });
   const name=document.createElement('span');name.className='series-name';name.textContent=s.name;
   const size=document.createElement('span');size.className='series-count';size.textContent=`${s.length} ${lang()==='en'?'days':'期'}`;
   const stockCell=document.createElement('span');stockCell.className='series-stock-cell';
   const stockCaption=document.createElement('span');stockCaption.className='series-stock-caption';stockCaption.textContent=lang()==='en'?'On-hand (units)':'現在庫（個）';
   const stock=document.createElement('input');stock.type='number';stock.className='series-stock';stock.min='0';stock.step='any';stock.placeholder=lang()==='en'?'e.g. 120':'例：120';stock.title=lang()==='en'?'Actual on-hand quantity (optional), not historical demand':'実際の現在庫数（任意）。過去の需要ではありません';stock.setAttribute('aria-label',`${s.name} ${lang()==='en'?'on-hand inventory in units':'現在庫（個）'}`);stock.value=previous.get(s.key)?.stock||'';
   stock.addEventListener('click',e=>e.stopPropagation());
   stockCell.append(stockCaption,stock);wrap.append(input,name,size,stockCell);root.append(wrap);
 });
 refreshLimits();
 if(!all.length){root.textContent=lang()==='en'?'No complete numeric demand series found. Choose another sheet or direction.':'数値の需要系列が検出されませんでした。シートまたは方向を変更してください。';}
}
function refreshLimits(){const root=$('freeSeries'),checked=root.querySelectorAll('input:checked').length;root.querySelectorAll('input[type=checkbox]').forEach(c=>{c.disabled=checked>=2&&!c.checked;c.closest('label').classList.toggle('limit-disabled',c.disabled);})}
$('freeFile').addEventListener('change',async e=>{
 const fileSequence=++fileReadSequence;
 clearError();$('freeFileName').textContent=e.target.files?.[0]?.name??t('ファイルが選択されていません');results=[];$('empty').classList.remove('hidden');$('results').classList.add('hidden');$('freeMulti').classList.add('hidden');$('status').textContent=lang()==='en'?'Not run':'未実行';$('status').classList.add('pending-tag');$('freeImport').classList.add('hidden');workbook=null;inspection=null;
 try{if(!e.target.files?.[0])return;const file=e.target.files[0];if(freeFileIssue(file)==='file_size')throw new Error(lang()==='en'?'Free accepts files up to 500 KB. Use Pro for larger business files.':'無料版で読み込めるファイルは最大500KBです。大きな業務ファイルはProをご利用ください。');const loaded=await loadWorkbook(file);if(fileSequence!==fileReadSequence)return;workbook=loaded;options($('freeSheet'),workbook.sheets.map(s=>s.name));readSheet();$('freeImport').classList.remove('hidden');}
 catch(err){if(fileSequence===fileReadSequence)error(err)}
});
$('freeSheet').addEventListener('change',()=>{try{results=[];$('empty').classList.remove('hidden');$('results').classList.add('hidden');$('status').textContent=lang()==='en'?'Not run':'未実行';readSheet();clearError()}catch(e){error(e)}});
$('freeOrientation').addEventListener('change',()=>{invalidateResults();renderSeries()});
$('freeImportRun').addEventListener('click',()=>{
 clearError();try{
   const keys=[...$('freeSeries').querySelectorAll('input:checked')].map(el=>el.value);
   const series=selectedSeries(inspection,$('freeOrientation').value,keys,true);
   const freeIssue=freeSeriesIssue(series);if(freeIssue==='series_count')throw new Error('select_series');if(freeIssue==='period_count')throw new Error(lang()==='en'?'Free analyzes up to 100 periods per series. Use Pro for longer histories.':'無料版は1系列あたり最大100期までです。長期履歴はProで分析してください。');
   results=series.map(s=>{
     const box=[...$('freeSeries').querySelectorAll('input[type=checkbox]')].find(el=>el.value===s.key)?.closest('label')?.querySelector('.series-stock');
     const raw=box?.value?.trim();const inv=raw?Number(raw):(series.length===1&&$('inventory').value.trim()!==''?Number($('inventory').value):null);
     return {name:s.name,result:analyze({demand:s.values,leadTime:Number($('lead').value),service:95,method:'sma',window:7,inventory:inv})};
   });
   selected=0;render();
   if(series.length>1)notify(lang()==='en'?'Two series analyzed. Add stock per series to estimate stockout probability.':'2系列を分析しました。在庫切れ確率は各系列の在庫入力から算出します。');
 }catch(e){error(e)}
});
for(const id of ['data','lead','service','inventory','method','window'])$(id).addEventListener('input',invalidateResults);
$('freeSeries').addEventListener('input',invalidateResults);
$('freeSeries').addEventListener('change',invalidateResults);
$('method').addEventListener('change',()=>{$('windowField').classList.toggle('hidden',$('method').value!=='sma')});
$('sample').addEventListener('click',()=>{$('data').value=SAMPLE.join(', ');$('inventory').value=390;clearError();form.requestSubmit();});
form.addEventListener('submit',e=>{e.preventDefault();clearError();try{
 const inv=$('inventory').value.trim()===''?null:Number($('inventory').value);
 const demand=parseDemand($('data').value);if(freeManualIssue(demand)==='period_count')throw new Error(lang()==='en'?'Free manual analysis is limited to 100 periods. Use Pro for longer histories.':'無料版の手動分析は最大100期までです。長期履歴はProをご利用ください。');
 const result=analyze({demand,leadTime:Number($('lead').value),service:95,method:'sma',window:7,inventory:inv});
 results=[{name:lang()==='en'?'Manual series':'手動入力',result}];selected=0;render();
}catch(err){error(err);status.textContent=lang()==='en'?'Input error':'入力エラー';status.classList.add('pending-tag');}});
$('sampleCsv').addEventListener('click',()=>{const vals=SAMPLE.map((n,i)=>[i+1,n,Math.max(0,n+((i%5)-2)*3)]);downloadText('demandscope-sample-2-series.csv',toCSV([['Day','SKU-A','SKU-B'],...vals]));notify(lang()==='en'?'Two-series sample CSV saved.':'2系列のCSVサンプルを保存しました。');});
$('downloadFree').addEventListener('click',()=>{if(!results.length)return;downloadText('demandscope-free-summary.csv',toCSV([
 [lang()==='en'?'Series':'系列',lang()==='en'?'Safety stock':'安全在庫',lang()==='en'?'Reorder point':'発注点',lang()==='en'?'Stockout (%)':'欠品確率 (%)'],
 ...results.map(({name,result:r})=>[name,r.safetyStock,r.reorderPoint,r.stockout??''])
]));});
function render(){
 if(!results.length)return;
 const r=results[selected].result;$('empty').classList.add('hidden');$('results').classList.remove('hidden');
 status.textContent=lang()==='en'?`${r.runs.toLocaleString()} runs`:`${r.runs.toLocaleString()}回 実行済み`;status.classList.remove('pending-tag');
 $('freeMulti').classList.toggle('hidden',results.length<=1);
 $('freeMulti').replaceChildren(...results.map((item,i)=>{const b=document.createElement('button');b.type='button';b.className='btn btn-mini'+(i===selected?' chosen':'');b.textContent=item.name;b.addEventListener('click',()=>{selected=i;render()});return b}));
 const ids={safety:r.safetyStock,reorder:r.reorderPoint,baseline:r.futureBaseline,sigma:r.sigma,historical:r.historicalMean,mean:r.mean,sd:r.sd,median:r.median,p90:r.p90,p95:r.p95,p99:r.p99};
 for(const [id,v]of Object.entries(ids))$(id).textContent=id==='safety'||id==='reorder'?formatNumber(v,0,lang()):f(v);
 $('risk').textContent=r.stockout===null?'—':f(r.stockout);$('riskUnit').textContent=r.stockout===null?'':'%';$('inventoryLegend').classList.toggle('hidden',r.inventory===null);
 const z=r.lastZ===null?'—':(r.lastZ>=0?'+':'')+r.lastZ.toFixed(2)+'σ';
 $('zTitle').textContent=lang()==='en'?`Latest deviation: ${z} / ${riskLabel(r.lastZ,'en')}`:`直近需要の基準からの乖離：${z} / ${riskLabel(r.lastZ)}`;
 $('zDesc').textContent=lang()==='en'?`Last demand ${f(r.demand.at(-1))} − baseline ${f(r.baselines.at(-1)??r.historicalMean)} = ${f(r.lastResidual)}. Deviation is scaled by residual SD (not standard error).`:`直近の需要 ${f(r.demand.at(-1))} − 当日の基準 ${f(r.baselines.at(-1)??r.historicalMean)} = ${f(r.lastResidual)}。残差を標準偏差で割った値です（標準誤差ではありません）。`;
 $('warnings').classList.toggle('hidden',!r.flags.length);$('warnings').replaceChildren(...r.flags.map(s=>{const p=document.createElement('p');p.textContent='⚠ '+(lang()==='en'?'Model caution: interpret with care.':s);return p}));
 $('report').textContent=reportText(r,results[selected].name,lang());requestAnimationFrame(()=>drawHistogram($('hist'),r,lang()));
}
window.addEventListener('resize',()=>{if(results.length)drawHistogram($('hist'),results[selected].result,lang())});
initI18n(()=>{if(inspection)renderSeries();if(results.length)render();$('freeFileName').textContent=$('freeFile').files?.[0]?.name||t('ファイルが選択されていません');});
