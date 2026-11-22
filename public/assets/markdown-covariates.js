import {numberOrNull} from './importer.js';

export const MAX_MARKDOWN_COVARIATES = 4;
export const MAX_MARKDOWN_PERIODS = 4000;
export const MULTICOLLINEARITY_WARN = 0.85;
export const MULTICOLLINEARITY_HOLD = 0.95;

const DATE_HEADER = /^(date|day|time|timestamp|period|日付|年月日|日時|期間|日)$/i;

export function normalizeDateKey(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0,10);
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    if (Number.isFinite(d.getTime())) return d.toISOString().slice(0,10);
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const simple = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?$/);
  if (simple) {
    const y=Number(simple[1]),m=Number(simple[2]),d=Number(simple[3]);
    const dt=new Date(Date.UTC(y,m-1,d));
    if (dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d) {
      return dt.toISOString().slice(0,10);
    }
    return null;
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0,10);
}

export function parseCovariateTable(rows, fallbackName='variable') {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('追加変数ファイルにヘッダーとデータが必要です。');
  const header = rows[0].map(v=>String(v ?? '').trim());
  const dateIndexes = header.map((v,i)=>DATE_HEADER.test(v)?i:-1).filter(i=>i>=0);
  if (dateIndexes.length !== 1) throw new Error('追加変数ファイルには date/日付 列を1つだけ含めてください。');
  const dateIndex = dateIndexes[0];

  const candidates=[];
  for(let c=0;c<header.length;c++){
    if(c===dateIndex)continue;
    let valid=true,seen=0;
    for(let r=1;r<rows.length;r++){
      const raw=rows[r]?.[c];
      if(raw===''||raw===null||raw===undefined)continue;
      seen++;
      if(numberOrNull(raw)===null){valid=false;break;}
    }
    if(valid&&seen>0)candidates.push({index:c,name:header[c]||fallbackName});
  }
  if(candidates.length!==1)throw new Error('追加変数ファイルは「日付 + 数値変数1列」の形式にしてください。');
  const variable=candidates[0];
  const map=new Map();
  for(let r=1;r<rows.length;r++){
    const dateRaw=rows[r]?.[dateIndex],valueRaw=rows[r]?.[variable.index];
    if((dateRaw===''||dateRaw===null||dateRaw===undefined)&&(valueRaw===''||valueRaw===null||valueRaw===undefined))continue;
    const date=normalizeDateKey(dateRaw);
    const value=numberOrNull(valueRaw);
    if(!date)throw new Error(`${r+1}行目の日付が不正です。`);
    if(value===null)throw new Error(`${r+1}行目の「${variable.name}」が数値ではありません。`);
    if(map.has(date))throw new Error(`追加変数「${variable.name}」に重複日付 ${date} があります。`);
    map.set(date,value);
  }
  if(map.size<2)throw new Error(`追加変数「${variable.name}」の有効データが少なすぎます。`);
  const vals=[...map.values()];
  const min=Math.min(...vals),max=Math.max(...vals);
  if(!(max>min))throw new Error(`追加変数「${variable.name}」が全期間で一定です。`);
  return {name:variable.name,map,count:map.size};
}

export function parseCovariateWorkbook(workbook, fallbackName='variable') {
  if(!workbook?.sheets?.length)throw new Error('追加変数ファイルを読み込めません。');
  const errors=[];
  for(const sheet of workbook.sheets){
    try{return {...parseCovariateTable(sheet.rows,fallbackName),sheet:sheet.name};}
    catch(e){errors.push(`${sheet.name}: ${e.message}`);}
  }
  throw new Error(errors[0]||'追加変数ファイルに利用できるシートがありません。');
}

function correlation(a,b){
  if(a.length!==b.length||a.length<2)return null;
  const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;
  let num=0,da=0,db=0;
  for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y;}
  if(da<=0||db<=0)return null;
  return num/Math.sqrt(da*db);
}

function cutoffDateForYears(lastDate,maxYears){
  const d=new Date(lastDate+'T00:00:00Z');
  if(!Number.isFinite(d.getTime()))throw new Error('履歴の日付を解釈できません。');
  d.setUTCFullYear(d.getUTCFullYear()-maxYears);
  return d.toISOString().slice(0,10);
}

export function alignMarkdownCovariates(history,covariates,{maxPeriods=MAX_MARKDOWN_PERIODS,maxYears=null}={}){
  if(!Array.isArray(history))throw new Error('履歴データが不正です。');
  if(!Array.isArray(covariates))throw new Error('追加変数が不正です。');
  if(covariates.length>MAX_MARKDOWN_COVARIATES)throw new Error(`追加説明変数は最大${MAX_MARKDOWN_COVARIATES}個です。`);
  if(!Number.isInteger(maxPeriods)||maxPeriods<28||maxPeriods>MAX_MARKDOWN_PERIODS)throw new Error('分析観測点上限が不正です。');
  if(maxYears!==null&&(!Number.isInteger(maxYears)||maxYears<1||maxYears>10))throw new Error('分析年数上限が不正です。');

  const warnings=[];
  let rows=[...history];
  const hasCovariates=covariates.length>0;
  if(hasCovariates){
    if(rows.some(r=>!r.date))throw new Error('追加変数を使う場合、価格・販売履歴にも date/日付 列が必要です。');
    const before=rows.length;
    rows=rows
      .filter(r=>covariates.every(c=>c.map.has(r.date)))
      .map(r=>({...r,covariates:covariates.map(c=>c.map.get(r.date))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
    if(rows.length<before)warnings.push(`追加変数との共通日付に揃え、${before-rows.length}期を除外しました。`);
    if(rows.length<2)throw new Error('複数ファイルに共通する日付が不足しています。');
  }else{
    rows=rows.map(r=>({...r,covariates:[]})).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  }

  if(maxYears!==null){
    if(rows.some(r=>!r.date))throw new Error(`${maxYears}年の契約上限を確認するため、価格・販売履歴に date/日付 列が必要です。`);
    const last=rows.at(-1)?.date;
    const cutoff=cutoffDateForYears(last,maxYears);
    const before=rows.length;
    rows=rows.filter(r=>r.date>=cutoff);
    if(rows.length<before)warnings.push(`契約上限に合わせ、最新日から直近${maxYears}年のデータだけを使用しました。`);
  }

  if(rows.length>maxPeriods){
    rows=rows.slice(-maxPeriods);
    warnings.push(`処理上限により直近${maxPeriods}観測点のみ使用しました。`);
  }
  if(rows.length<2)throw new Error('分析可能な共通期間が不足しています。');

  const diagnostics=[];
  if(covariates.length&&rows.length>=3){
    const series=[
      {name:'log(price)',values:rows.map(r=>Math.log(r.price))},
      ...covariates.map((c,j)=>({name:c.name,values:rows.map(r=>r.covariates[j])}))
    ];
    for(let i=0;i<series.length;i++){
      for(let j=i+1;j<series.length;j++){
        const r=correlation(series[i].values,series[j].values);
        if(Number.isFinite(r)){
          diagnostics.push({a:series[i].name,b:series[j].name,r});
          const ar=Math.abs(r);
          if(ar>=MULTICOLLINEARITY_HOLD)warnings.push(`多重共線性リスク: ${series[i].name} と ${series[j].name} の |r|=${ar.toFixed(3)}。`);
          else if(ar>=MULTICOLLINEARITY_WARN)warnings.push(`高相関注意: ${series[i].name} と ${series[j].name} の |r|=${ar.toFixed(3)}。`);
        }
      }
    }
  }

  const hardMulticollinearity=diagnostics.some(d=>Math.abs(d.r)>=MULTICOLLINEARITY_HOLD);
  return {rows,warnings,diagnostics,hardMulticollinearity,covariateNames:covariates.map(c=>c.name),maxYears,maxPeriods};
}
