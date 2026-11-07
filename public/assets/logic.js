/** Demand Risk Simulator — deterministic, browser-only simulation core. */
export const RUNS = 4000;
export const SAMPLE = [38,42,41,45,37,43,40,44,48,46,39,42,43,47,40,45,49,46,43,41,44,50,48,46,41,45,47,51,43,45,49,48,52,46,47,51,50,53,48,46,49,55,52,50,47,51,54,56,50,49,52,57,55,51,48,53,56,58,52,54,55,59,56,52,54,60,57,55,52,58];

export function parseDemand(text) {
  const tokens = String(text ?? '').trim().split(/[\s,，、;；]+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('過去需要データを入力してください。');
  if (tokens.length > 10000) throw new Error('入力は最大10,000期までです。');
  const nums = tokens.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error(`${i + 1}番目の値「${v}」が無効です。0以上の数値を入力してください。`);
    return n;
  });
  return nums;
}

function average(values) { return values.reduce((a,b)=>a+b,0) / values.length; }
function sampleSd(values) {
  if (values.length < 2) return 0;
  const m = average(values);
  return Math.sqrt(values.reduce((a,v)=>a+(v-m)**2,0)/(values.length-1));
}
function quantile(sorted, p) {
  const index=(sorted.length-1)*p, lo=Math.floor(index), hi=Math.ceil(index);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);
}
function rng(seed=0x8f34a317) {
  let state=seed>>>0;
  return ()=> {state=(state+0x6D2B79F5)>>>0; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function gaussian(random) { return Math.sqrt(-2*Math.log(Math.max(random(),1e-12)))*Math.cos(2*Math.PI*random()); }
function sampleSeed(values, leadTime, service, method, window) {
  let x=2166136261;
  for (const v of values) { x^=Math.round(v*100); x=Math.imul(x,16777619); }
  for(const v of [leadTime,service,window,method==='sma'?1:0]){ x^=v; x=Math.imul(x,16777619); }
  return x>>>0;
}
export function analyze({ demand, leadTime=7, service=95, method='sma', window=7, inventory=null, runs=RUNS }) {
  if(!Array.isArray(demand)||demand.length<3) throw new Error('需要データは3期以上必要です。');
  if(!demand.every(v=>Number.isFinite(v)&&v>=0&&v<=1e9)) throw new Error('需要データに無効な値があります。');
  if(!Number.isInteger(leadTime)||leadTime<1||leadTime>365) throw new Error('リードタイムは1〜365日の整数で指定してください。');
  if(!Number.isFinite(service)||service<50||service>99.9) throw new Error('サービスレベルは50〜99.9%で指定してください。');
  if(!['sma','overall'].includes(method)) throw new Error('基準ラインの方式が無効です。');
  if(!Number.isInteger(window)||window<2||window>365) throw new Error('移動平均の期間は2〜365日で指定してください。');
  if(!Number.isInteger(runs)||runs<3000||runs>5000) throw new Error('試行回数は3,000〜5,000回にしてください。');
  if(inventory!==null&&(!Number.isFinite(inventory)||inventory<0)) throw new Error('現在庫は0以上の数値で指定してください。');
  const n=demand.length;
  if(method==='sma' && n<window+3) throw new Error(`移動平均${window}日を使う場合、需要データは${window+3}日以上必要です。`);
  const historicalMean=average(demand);
  let baselines, residuals, futureBaseline;
  if(method==='overall') {
    baselines=demand.map(()=>historicalMean);
    residuals=demand.map((v)=>v-historicalMean);
    futureBaseline=historicalMean;
  } else {
    baselines=demand.map((_,i)=>i>=window?average(demand.slice(i-window,i)):null);
    residuals=demand.slice(window).map((v,i)=>v-baselines[i+window]);
    futureBaseline=average(demand.slice(-window));
  }
  const residualMean=average(residuals);
  const sigma=sampleSd(residuals);
  const lastResidual=demand[n-1] - (baselines[n-1]??historicalMean);
  const lastZ=sigma>0?lastResidual/sigma:null;
  const random=rng(sampleSeed(demand,leadTime,service,method,window));
  const sums=[];
  // Independent future days, normally distributed residuals, non-negative demand floor.
  // Do not clamp/round after aggregation: fractional input data must retain its units.
  for(let r=0;r<runs;r++){
    let total=0;
    for(let t=0;t<leadTime;t++) total+=Math.max(0, futureBaseline+sigma*gaussian(random));
    sums.push(total);
  }
  sums.sort((a,b)=>a-b);
  const mean=average(sums), sd=sampleSd(sums), p90=quantile(sums,.9), p95=quantile(sums,.95), p99=quantile(sums,.99);
  const target=quantile(sums,service/100);
  const baseStock=Math.ceil(mean);
  const reorderPoint=Math.max(baseStock,Math.ceil(target));
  const safetyStock=Math.max(0,reorderPoint-baseStock);
  const stockout=inventory===null?null:100*sums.filter(v=>v>inventory).length/runs;
  const stockZ=inventory===null||sd===0?null:(inventory-mean)/sd;
  const flags=[];
  if(n<30) flags.push('履歴が30期未満です。分布推定の不確実性が高くなります。');
  if(method==='sma'&&residuals.length<15) flags.push('移動平均の残差が15個未満です。標準偏差が不安定になりやすいです。');
  if(sigma===0) flags.push('残差のばらつきが0です。モデル上の需要リスクを過小評価する可能性があります。');
  if(demand.some(v=>v===0)&&demand.some(v=>v>0)) flags.push('需要0の日があります。正規分布モデルが実際の需要分布に合わない場合があります。');
  return {runs,n,method,window,leadTime,service,historicalMean,baselines,residuals,residualMean,sigma,futureBaseline,lastResidual,lastZ,mean,sd,median:quantile(sums,.5),p90,p95,p99,target,baseStock,safetyStock,reorderPoint,stockout,stockZ,inventory,flags,sums,demand};
}
export function formatNumber(n, digits=1, locale='ja') { return n===null||!Number.isFinite(n)?'—':n.toLocaleString(locale==='en'?'en-US':'ja-JP',{maximumFractionDigits:digits}); }
export function riskLabel(z,locale='ja'){if(z===null)return locale==='en'?'Unavailable':'比較不可';const a=Math.abs(z);if(locale==='en')return a<1?'Typical':a<2?'Moderate deviation':a<3?'Large deviation':'Extreme deviation';return a<1?'通常範囲':a<2?'やや大きい変動':a<3?'大きい変動':'非常に大きい変動';}
export function reportText(r, sku='', locale='ja') {
 const f=n=>formatNumber(n,2,locale);
 if(locale==='en') return [
 `Demand & inventory risk simulator${sku?' — '+sku:''}`,
 `Historical periods: ${r.n} / Baseline: ${r.method==='sma'?r.window+'-day simple moving average':'overall mean'}`,
 `Daily forecast baseline: ${f(r.futureBaseline)} / Historical mean: ${f(r.historicalMean)}`,
 `Residual sample SD: ${f(r.sigma)} / Residual mean: ${f(r.residualMean)}`,
 `Lead time: ${r.leadTime} days / Monte Carlo runs: ${r.runs}`,
 `Lead-time demand mean: ${f(r.mean)} / SD: ${f(r.sd)} / Median: ${f(r.median)}`,
 `P90: ${f(r.p90)} / P95: ${f(r.p95)} / P99: ${f(r.p99)}`,
 `Cycle service level: ${r.service}% / Safety stock: ${f(r.safetyStock)} / Reorder point: ${f(r.reorderPoint)}`,
 `On-hand stock: ${r.inventory===null?'not entered':f(r.inventory)} / Stockout probability: ${r.stockout===null?'not estimated':f(r.stockout)+'%'}`,
 `Last residual: ${f(r.lastResidual)} / Residual z-score: ${r.lastZ===null?'N/A':r.lastZ.toFixed(2)+'σ'} (${riskLabel(r.lastZ,'en')})`,
 'Assumptions: independent normal daily residuals, zero floor on demand, constant lead time; no seasonality.',
 'Inventory note: reorder point applies to inventory position; estimates are not guarantees.',
 ...r.flags.map(()=>'Caution: small or unusual samples can make risk estimates unreliable.')].join('\n');
 return [`需要予測・在庫リスクシミュレーター${sku?' — '+sku:''}`,
 `過去需要: ${r.n}期 / 基準: ${r.method==='sma'?r.window+'期の単純移動平均':'全体平均'}`,
 `予測基準（日次）: ${f(r.futureBaseline)} / 過去需要の平均: ${f(r.historicalMean)}`,
 `残差の標準偏差（標本）: ${f(r.sigma)} / 残差平均: ${f(r.residualMean)}`,
 `リードタイム: ${r.leadTime}日 / シミュレーション: ${r.runs.toLocaleString()}回`,
 `リードタイム需要 平均: ${f(r.mean)} / 標準偏差: ${f(r.sd)} / 中央値: ${f(r.median)}`,
 `90%点: ${f(r.p90)} / 95%点: ${f(r.p95)} / 99%点: ${f(r.p99)}`,
 `サービスレベル: ${r.service}% / 推奨安全在庫: ${f(r.safetyStock)} / 発注点: ${f(r.reorderPoint)}`,
 `現在庫: ${r.inventory===null?'未入力':f(r.inventory)} / 在庫切れ確率: ${r.stockout===null?'算定なし':f(r.stockout)+'%'}`,
 `直近需要の残差: ${f(r.lastResidual)} / 残差z値: ${r.lastZ===null?'—':r.lastZ.toFixed(2)+'σ'}（${riskLabel(r.lastZ)}）`,
 `前提: 将来の日次需要は一定基準＋独立な正規乱数×残差標準偏差、需要は0未満を0に補正。`,`注意: 発注点は在庫ポジションを使う管理向けの目安です。予測・欠品確率の保証ではありません。`,...r.flags.map(v=>'注意: '+v)].join('\n');
}
