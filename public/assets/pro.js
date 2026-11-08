import {analyze,parseDemand,SAMPLE,reportText,formatNumber} from './logic.js';
import {drawHistogram,drawSimulationDots} from './chart.js';
import {loadWorkbook,inspectTable,selectedSeries,toCSV,downloadText} from './importer.js';
import {initI18n,lang,t,errorMessage} from './i18n.js';
import {printRiskReport} from './pdf-report.js';
const $=id=>document.getElementById(id), f=n=>formatNumber(n,1,lang());
let authorized=false,skus=[],analyses=new Map(),selected=null,editing=null,stripeHealth=null;
const KEY='demandscope_pro_skus_v1';
function warn(msg){$('proAlert').textContent=errorMessage(msg instanceof Error?msg:new Error(msg));$('proAlert').classList.remove('hidden')}
function clearWarn(){$('proAlert').classList.add('hidden')}
function toast(v){$('toast').textContent=v;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2600)}
async function call(path,body){const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body??{})});let data={};try{data=await res.json()}catch{}if(!res.ok){const parts=[data.error,data.detail,data.hint,data.request_id?('Request ID: '+data.request_id):null].filter(Boolean);throw new Error(parts.join(' / ')||'通信に失敗しました')}return data}
async function checkStripeHealth(){
 try{
  const res=await fetch('/api/stripe-status',{cache:'no-store'});
  stripeHealth=await res.json();
  const el=$('stripeHealth');
  if(!stripeHealth.configured){
   const labels=(stripeHealth.issues||[]).map(i=>{
    if(i.name==='STRIPE_SECRET_KEY'&&i.reason==='test_key_format')return lang()==='en'?'Stripe key is not sk_test_ / rk_test_':'Stripeキーが sk_test_ / rk_test_ 形式ではありません';
    if(i.name==='STRIPE_SECRET_KEY')return lang()==='en'?'Stripe key is missing':'STRIPE_SECRET_KEYが未登録です';
    if(i.name==='SESSION_SECRET'&&i.reason==='too_short')return lang()==='en'?'SESSION_SECRET is shorter than 32 characters':'SESSION_SECRETが32文字未満です';
    if(i.name==='SESSION_SECRET')return lang()==='en'?'SESSION_SECRET is missing':'SESSION_SECRETが未登録です';
    return i.name;
   });
   el.textContent=(lang()==='en'?'Setup problem: ':'設定エラー: ')+(labels.join(' / ')||stripeHealth.missing?.join(', ')||'unknown');
   el.className='stripe-health bad';return
  }
  if(stripeHealth.reachable){el.textContent=lang()==='en'?'✓ Stripe API reachable ('+stripeHealth.key_type+')':'✓ Stripe API接続済み（'+stripeHealth.key_type+'）';el.className='stripe-health good';return}
  el.textContent=(lang()==='en'?'Stripe API unreachable: ':'Stripe API未接続: ')+(stripeHealth.detail||stripeHealth.hint||'unknown error');
  el.className='stripe-health bad';
 }catch(e){const el=$('stripeHealth');el.textContent=lang()==='en'?'Stripe connection check failed.':'Stripe接続確認に失敗しました。';el.className='stripe-health bad'}
}
async function boot(){try{await checkStripeHealth();const params=new URLSearchParams(location.search);if(params.has('session_id')){const sessionId=params.get('session_id');history.replaceState({},'',location.pathname);await call('/api/activate',{session_id:sessionId});toast(lang()==='en'?'Test checkout verified':'テスト決済を確認しました');}
 if(params.get('checkout')==='cancelled'){history.replaceState({},'',location.pathname);warn('決済はキャンセルされました。');}
 const res=await fetch('/api/entitlement',{cache:'no-store'});
 if(!res.ok){access(false,true);warn(lang()==='en'?'Pro requires deployment of Cloudflare Pages Functions and Stripe test configuration.':'Proを利用するにはCloudflare Pages FunctionsとStripeテスト設定のデプロイが必要です。');return;}
 const state=await res.json();access(!!state.active,state.configured===false);if(state.configured===false&&state.missing?.length)warn((lang()==='en'?'Setup needed: ':'設定が必要です: ')+state.missing.join(', '));if(state.error)warn(state.error);
 }catch(e){access(false,false);warn(e.message)} }
function access(ok,unconfigured){authorized=ok;if(!ok){skus=[];analyses.clear();selected=null;}$('proStatus').textContent=ok?(lang()==='en'?'Pro active':'Pro 利用中'):unconfigured?(lang()==='en'?'Stripe not configured':'Stripe 未設定'):(lang()==='en'?'Pro inactive':'Pro 未契約');$('proStatus').classList.toggle('pending-tag',!ok);$('preview').classList.toggle('hidden',ok);$('proWorkspace').classList.toggle('hidden',!ok);$('checkout').classList.toggle('hidden',ok);$('portal').classList.toggle('hidden',!ok);$('logout').classList.toggle('hidden',!ok);$('accessTitle').textContent=ok?(lang()==='en'?'✓ Test subscription verified':'✓ Pro テスト契約を確認しました'):t('🔒 Stripe テスト決済で利用開始');$('accessText').textContent=ok?(lang()==='en'?'Multi-product import and analysis are available.':'複数商品の編集と一括実行が使用できます。'):(lang()==='en'?'After a verified Stripe test subscription, bulk import is unlocked.':'テストモードのStripe Checkoutで契約状態を確認後、機能が開放されます。');$('checkout').disabled=unconfigured;if(unconfigured)$('accessText').textContent=lang()==='en'?'Configure the Stripe TEST secret key and session secret on Cloudflare Pages.':'Cloudflare Pagesにテスト用Stripe秘密鍵とセッション秘密値を設定してください。';if(ok){try{const local=JSON.parse(localStorage.getItem(KEY)||'[]');skus=Array.isArray(local)?local.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.data==='string').filter(x=>x.data.length<=200000&&x.name.length<=90).slice(0,200):[]}catch{skus=[]}renderTable()}}
$('checkout').addEventListener('click',async()=>{
 clearWarn();$('checkoutError').classList.add('hidden');const button=$('checkout');const original=button.textContent;button.disabled=true;button.textContent=lang()==='en'?'Connecting to Stripe…':'Stripeに接続中…';
 try{const x=await call('/api/checkout');if(!x.url)throw new Error(lang()==='en'?'Checkout URL was not returned.':'決済URLが返されませんでした。');location.assign(x.url)}
 catch(e){const message=e.message||String(e);warn(message);$('checkoutError').textContent=message;$('checkoutError').classList.remove('hidden');await checkStripeHealth();button.disabled=false;button.textContent=original}
});
$('portal').addEventListener('click',async()=>{try{const x=await call('/api/portal');location.assign(x.url)}catch(e){warn(e.message)}});
$('logout').addEventListener('click',async()=>{try{await call('/api/logout');access(false,false);toast('サインアウトしました')}catch(e){warn(e.message)}});
$('addToggle').addEventListener('click',()=>showEditor());$('cancelEdit').addEventListener('click',()=>{$('skuForm').classList.add('hidden');editing=null});
function showEditor(sku=null){editing=sku?.id??null;$('skuForm').reset();$('skuName').value=sku?.name||'';$('skuLead').value=sku?.lead??7;$('skuStock').value=sku?.stock??'';$('skuService').value=sku?.service??95;$('skuMethod').value=sku?.method||'sma';$('skuWindow').value=sku?.window??7;$('skuData').value=sku?.data||'';$('saveSku').textContent=editing?(lang()==='en'?'Save changes':'変更を保存'):t('商品を保存');$('skuForm').classList.remove('hidden');$('skuName').focus()}
function analyzeSku(s){return analyze({demand:parseDemand(s.data),leadTime:s.lead,service:s.service,inventory:s.stock,method:s.method,window:s.window})}
$('skuForm').addEventListener('submit',e=>{e.preventDefault();if(!authorized)return;clearWarn();const s={id:editing||(globalThis.crypto?.randomUUID?.() ?? 'sku_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)),name:$('skuName').value.trim(),lead:Number($('skuLead').value),stock:$('skuStock').value.trim()===''?null:Number($('skuStock').value),method:$('skuMethod').value,window:Number($('skuWindow').value),service:Number($('skuService').value),data:$('skuData').value.trim()};if(!s.name)return warn('商品名を入力してください。');if(s.data.length>200000)return warn('需要データが長すぎます。');try{analyzeSku(s)}catch(err){return warn(err.message)}if(!editing&&skus.length>=200)return warn('このテスト版では登録は最大200商品です。');if(editing){skus=skus.map(t=>t.id===editing?s:t)}else skus.push(s);analyses.delete(s.id);persist();$('skuForm').classList.add('hidden');editing=null;selected=s.id;renderTable();toast('商品を保存しました')});
function persist(){try{localStorage.setItem(KEY,JSON.stringify(skus))}catch{warn('このブラウザでの保存に失敗しました。容量やプライベートモードを確認してください。')}}
// Yield between SKUs so the browser can repaint; prevent excessive batch work.
$('runAll').addEventListener('click',async()=>{
 if(!authorized)return;
 clearWarn();if(!skus.length)return warn(lang()==='en'?'Register a product first.':'先に商品を登録してください。');
 const MAX_DRAWS=25_000_000;
 const draws=skus.reduce((n,s)=>n+4000*s.lead,0);
 if(draws>MAX_DRAWS)return warn(lang()==='en'?'Batch is too large. Reduce lead times or process fewer products (25 million daily draws max).':'一括処理が大きすぎます。リードタイムを短くするか商品数を減らしてください（最大2,500万日次抽選）。');
 const button=$('runAll');button.disabled=true;
 const errs=[];let ok=0;
 try{
   analyses.clear();
   for(let i=0;i<skus.length;i++){
     const s=skus[i];
     try{analyses.set(s.id,analyzeSku(s));ok++;}catch(e){errs.push(`${s.name}: ${e.message}`)}
     if(i%3===2){button.textContent=`${i+1}/${skus.length}`;await new Promise(resolve=>setTimeout(resolve,0));}
   }
   if(!selected)selected=skus[0].id;
   renderTable();
   toast(lang()==='en'?`${ok} succeeded / ${errs.length} failed`:`成功 ${ok}件 / 失敗 ${errs.length}件`);
   if(errs.length)warn(errs.slice(0,10).join(' / ') +(errs.length>10?' …':''));
 }finally{button.disabled=false;button.textContent=lang()==='en'?'Run all':'▣ 一括実行';}
});
function renderTable(){const body=$('skuBody');body.replaceChildren();if(!skus.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='muted';td.style.cssText='padding:23px;text-align:center';td.textContent=t('商品を登録してください。');tr.append(td);body.append(tr);$('selectedDetails').classList.add('hidden');return;}
 for(const sku of skus){const r=analyses.get(sku.id);const tr=document.createElement('tr');tr.tabIndex=0;tr.classList.toggle('selected',sku.id===selected);let vals=[sku.name,r?f(r.historicalMean):(lang()==='en'?'Not run':'未計算'),r?f(r.safetyStock):'—',r?f(r.reorderPoint):'—',r?(r.stockout===null?(lang()==='en'?'Not entered':'未入力'):f(r.stockout)+'%'):'—'];for(const [i,v] of vals.entries()){const td=document.createElement('td');td.textContent=v;if(i===0)td.style.fontWeight='750';tr.append(td)}const td=document.createElement('td');const edit=document.createElement('button');edit.className='btn btn-mini btn-ghost';edit.type='button';edit.textContent=lang()==='en'?'Edit':'編集';edit.addEventListener('click',ev=>{ev.stopPropagation();showEditor(sku)});const del=document.createElement('button');del.className='btn btn-mini btn-ghost';del.type='button';del.style.cssText='margin-left:5px;color:#ffa7b0';del.textContent=lang()==='en'?'Delete':'削除';del.addEventListener('click',ev=>{ev.stopPropagation();if(!confirm(`「${sku.name}」を削除しますか？`))return;skus=skus.filter(s=>s.id!==sku.id);analyses.delete(sku.id);if(selected===sku.id)selected=skus[0]?.id??null;persist();renderTable()});td.append(edit,del);tr.append(td);tr.addEventListener('click',()=>{selected=sku.id;renderTable()});tr.addEventListener('keydown',e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selected=sku.id;renderTable()}});body.append(tr)}
 const s=skus.find(v=>v.id===selected)||skus[0];selected=s.id;const r=analyses.get(selected);$('selectedDetails').classList.toggle('hidden',!r);if(r){$('detailName').textContent=s.name;$('detailMean').textContent=f(r.mean);$('detailP95').textContent=f(r.p95);$('detailVol').textContent=f(r.sigma);$('detailVolNote').textContent=lang()==='en'?`Max of full ${f(r.sigmaLong)}, recent ${r.recentWindow}-period ${f(r.sigmaRecent)}, EWMA ${f(r.sigmaEwma)} (${r.volatilityDriver})`:`長期 ${f(r.sigmaLong)} / 直近${r.recentWindow}期 ${f(r.sigmaRecent)} / 指数加重 ${f(r.sigmaEwma)} の最大値（${r.volatilityDriver}）`;$('proReport').textContent=reportText(r,s.name,lang());requestAnimationFrame(()=>{drawHistogram($('proHist'),r,lang());drawSimulationDots($('proDots'),r,lang());});}}
$('proCopy').addEventListener('click',async()=>{const t=$('proReport').textContent;try{await navigator.clipboard.writeText(t);toast('結果をコピーしました')}catch{toast('テキストを選択してコピーしてください')}});
window.addEventListener('resize',()=>{if(authorized&&analyses.get(selected)){const r=analyses.get(selected);drawHistogram($('proHist'),r,lang());drawSimulationDots($('proDots'),r,lang());}});
let importBook=null,importInspection=null;
function fillOptions(el,items){el.replaceChildren(...items.map((value,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=value;return o}));}
function renderPreview(ins){const table=document.createElement('table');for(const row of ins.preview){const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=String(v);tr.append(td)}table.append(tr)}$('proPreview').replaceChildren(table)}
function renderImportSeries(){
 const axis=$('proOrientation').value,series=importInspection?.series[axis]||[],root=$('proSeries');
 const previous=new Map([...root.querySelectorAll('input[type=checkbox]')].map(x=>[x.value,x.checked]));root.replaceChildren();
 $('proCount').textContent=lang()==='en'?`Detected: ${series.length} valid numeric series (${axis === 'column' ? 'columns' : 'rows'}). Split or sum aligned periods.`:`${series.length}系列を検出（${axis==='column'?'列':'行'}方向）。分割するか、同じ期間の需要を合算するかを選択してください。`;
 for(const s of series){
   const label=document.createElement('label');label.className='series-item';
   const check=document.createElement('input');check.type='checkbox';check.value=s.key;check.checked=previous.has(s.key)?previous.get(s.key):true;
   const name=document.createElement('span');name.className='series-name';name.textContent=s.name;
   const count=document.createElement('span');count.className='series-count';count.textContent=`${s.length} ${lang()==='en'?'days':'期'}`;
   label.append(check,name,count);root.append(label);
 }
 if(!series.length)root.textContent=lang()==='en'?'No demand series detected. Try another orientation or sheet.':'需要系列が見つかりません。方向またはシートを変えてください。';
}
function renderImportedSheet(){
 importInspection=inspectTable(importBook.sheets[Number($('proSheet').value)].rows);
 $('proOrientation').value=importInspection.orientation;renderImportSeries();renderPreview(importInspection);
}
$('proFile').addEventListener('change',async ev=>{
 clearWarn();$('proImport').classList.add('hidden');importBook=null;importInspection=null;
 try{if(!ev.target.files?.[0])return;$('proFileName').textContent=ev.target.files[0].name;importBook=await loadWorkbook(ev.target.files[0]);fillOptions($('proSheet'),importBook.sheets.map(s=>s.name));renderImportedSheet();$('proImport').classList.remove('hidden');}
 catch(e){warn(e)}
});
$('proSheet').addEventListener('change',()=>{try{renderImportedSheet();clearWarn()}catch(e){warn(e)}});
$('proOrientation').addEventListener('change',renderImportSeries);
$('proSelectAll').addEventListener('click',()=>{$('proSeries').querySelectorAll('input').forEach(el=>el.checked=true)});
$('proImportRun').addEventListener('click',()=>{
 if(!authorized)return warn(lang()==='en'?'Pro subscription required.':'Pro契約を確認してください。');clearWarn();
 try{
 const keys=[...$('proSeries').querySelectorAll('input:checked')].map(el=>el.value);
 const split=document.querySelector('input[name=importMode]:checked')?.value!=='aggregate';
 const list=selectedSeries(importInspection,$('proOrientation').value,keys,split);
 if(skus.length+list.length>200)throw new Error(lang()==='en'?'This pilot supports up to 200 product series.':'この試作版では登録可能な系列は最大200件です。');
 const errors=[],accepted=[];
 for(const x of list){
   const product={id:(globalThis.crypto?.randomUUID?.() ?? 'sku_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)),name:x.name,lead:7,stock:null,service:95,method:'sma',window:7,data:x.values.join(',')};
   try{if(x.values.length<10)throw new Error(lang()==='en'?'At least 10 daily values are needed for the default 7-day moving average.':'初期設定の7日移動平均には少なくとも10期が必要です。');accepted.push(product)}
   catch(e){errors.push(`${x.name}: ${errorMessage(e)}`)}
 }
 if(!accepted.length)throw new Error(errors.join(' / '));
 skus.push(...accepted);persist();selected=accepted[0].id;analyses.clear();renderTable();
 toast(lang()==='en'?`Imported ${accepted.length} series.`:`${accepted.length}系列を登録しました。`);
 if(errors.length)warn(errors.slice(0,8).join(' / '));
 }catch(e){warn(e)}
});
$('proPdf').addEventListener('click',()=>{if(!authorized)return warn(lang()==='en'?'Pro subscription required.':'Pro契約を確認してください。');const all=skus.filter(s=>analyses.has(s.id)).map(s=>({name:s.name,result:analyses.get(s.id)}));if(!all.length)return warn(lang()==='en'?'Run the batch first.':'先に一括実行してください。');toast(printRiskReport({results:all,language:lang(),chartCanvas:all.length===1?$('proHist'):null}));});
$('downloadPro').addEventListener('click',()=>{
 if(!authorized)return warn(lang()==='en'?'Pro subscription required.':'Pro契約を確認してください。');
 if(!analyses.size)return warn(lang()==='en'?'Run simulations before downloading.':'一括実行後にダウンロードしてください。');
 const rows=[['SKU','Daily baseline','Residual SD','Lead-time mean','Lead-time SD','P50','P90','P95','P99','Safety stock','Reorder point','Stockout (%)','Latest z-score','Runs']];
 for(const s of skus){const r=analyses.get(s.id);if(r)rows.push([s.name,r.futureBaseline,r.sigma,r.mean,r.sd,r.median,r.p90,r.p95,r.p99,r.safetyStock,r.reorderPoint,r.stockout??'',r.lastZ??'',r.runs])}
 downloadText('demandscope-pro-results.csv',toCSV(rows));
});
initI18n(()=>{if(importInspection)renderImportSeries();renderTable();access(authorized,false);$('proFileName').textContent=$('proFile').files?.[0]?.name||t('ファイルが選択されていません');});
boot();
