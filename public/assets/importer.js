/** In-browser CSV / TSV / XLSX demand-series import. No network calls. */
const MAX_FILE = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED = 24 * 1024 * 1024;
const MAX_ROWS = 10010, MAX_COLS = 256, MAX_CELLS = 550000;
const NUM_RE = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
export function numberOrNull(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\u00a0/g,'');
  if (!s) return null;
  const normalized = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s) ? s.replace(/,/g,'') : s;
  return NUM_RE.test(normalized) ? Number(normalized) : null;
}
export function parseDelimited(text, delimiter) {
  if (text.length > 13 * 1024 * 1024) throw new Error('file_too_large');
  const src = text.replace(/^\uFEFF/,'');
  let sep=delimiter;
  if (!sep) {
    const sample=src.split(/\r?\n/).slice(0,7).join('\n');
    const counts=['\t',',',';'].map(s=>({s,n:(sample.match(new RegExp(s==='\t'?'\t':s===';'?';':',','g'))||[]).length}));
    counts.sort((a,b)=>b.n-a.n);sep=counts[0].n ? counts[0].s : ',';
  }
  const out=[],row=[];let cell='',quoted=false;
  for (let i=0;i<src.length;i++) {
    const ch=src[i];
    if(ch==='"') {if(quoted&&src[i+1]==='"'){cell+='"';i++;}else if(!quoted&&!cell){quoted=true;}else if(quoted){quoted=false;}else{cell+=ch;}}
    else if(ch===sep&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){row.push(cell);cell='';if(row.some(x=>String(x).trim()))out.push(row.splice(0));else row.length=0;if(ch==='\r'&&src[i+1]==='\n')i++;if(out.length>MAX_ROWS)throw new Error('too_many_rows');}
    else cell+=ch;
  }
  if(quoted)throw new Error('unclosed_quote');
  row.push(cell);if(row.some(x=>String(x).trim()))out.push(row);
  if(out.length>MAX_ROWS||out.some(r=>r.length>MAX_COLS))throw new Error('too_many_cells');
  if(out.reduce((a,r)=>a+r.length,0)>MAX_CELLS)throw new Error('too_many_cells');
  return out;
}
function xml(s) {const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.querySelector('parsererror'))throw new Error('bad_excel');return doc;}
function nodes(parent,tag){return [...parent.getElementsByTagName(tag)];}
function colIndex(letters){let n=0;for(const ch of letters){n=n*26+ch.charCodeAt(0)-64;}return n-1;}
function cellValue(cell,strings) {
 const type=cell.getAttribute('t');
 if(type==='inlineStr')return nodes(cell,'t').map(t=>t.textContent).join('');
 const raw=nodes(cell,'v')[0]?.textContent??'';
 if(type==='s')return strings[Number(raw)]??'';
 if(type==='b')return raw==='1'?'TRUE':'FALSE';
 if(type==='str'||type==='e')return raw;
 if(raw==='')return '';
 const n=Number(raw);return Number.isFinite(n)?n:raw;
}
export async function loadWorkbook(file) {
 if(!file||file.size>MAX_FILE)throw new Error('file_too_large');
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(['csv','tsv','txt'].includes(ext)) {
   const bytes=await file.arrayBuffer();let decoded;
   try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
   catch{decoded=new TextDecoder('shift_jis',{fatal:true}).decode(bytes)}
   const rows=parseDelimited(decoded,ext==='tsv'?'\t':undefined);
   return {sheets:[{name:file.name,rows}]};
 }
 if(ext!=='xlsx')throw new Error('unsupported_file');
 if(!globalThis.JSZip)throw new Error('excel_library_missing');
 const zip=await globalThis.JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false}).catch(()=>{throw new Error('bad_excel')});
 const entries=Object.values(zip.files);
 let expanded=0;
 for(const e of entries){
   if(e.dir)continue;
   const size=e._data?.uncompressedSize;
   if(!Number.isFinite(size)||size>MAX_UNCOMPRESSED||size<0)throw new Error('file_too_large');
   expanded+=size;
   if(expanded>MAX_UNCOMPRESSED||entries.length>1200)throw new Error('file_too_large');
 }
 const read=async path=>{const f=zip.file(path);return f?await f.async('string'):null;};
 const book=await read('xl/workbook.xml'),relations=await read('xl/_rels/workbook.xml.rels');
 if(!book||!relations)throw new Error('bad_excel');
 const wb=xml(book),rels=xml(relations);
 const relMap=new Map(nodes(rels,'Relationship').map(e=>[e.getAttribute('Id'),e.getAttribute('Target')]));
 const shared=await read('xl/sharedStrings.xml');
 const strings=shared?nodes(xml(shared),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
 const sheets=[];
 for(const s of nodes(wb,'sheet').slice(0,12)) {
   const name=s.getAttribute('name')||'Sheet',rel=s.getAttribute('r:id');
   let target=relMap.get(rel);if(!target)continue;
   target=target.replace(/^\//,'').replace(/^\.\//,'');
   if(!target.startsWith('xl/'))target='xl/'+target;
   const parts=[];for(const p of target.split('/')){if(p==='..')parts.pop();else if(p!=='.')parts.push(p);}target=parts.join('/');
   const str=await read(target);if(!str)continue;
   const doc=xml(str),rows=[],rowElements=nodes(doc,'row');
   if(rowElements.length>MAX_ROWS)throw new Error('too_many_rows');
   let count=0;
   for(const row of rowElements){
     const idx=Number(row.getAttribute('r'))-1;
     if(!Number.isInteger(idx)||idx<0||idx>=MAX_ROWS)throw new Error('too_many_rows');
     const arr=[];
     for(const c of nodes(row,'c')){
       const ref=c.getAttribute('r'),match=ref?.match(/^([A-Z]+)\d+$/);
       if(!match)continue;
       const ci=colIndex(match[1]);
       if(ci>=MAX_COLS)throw new Error('too_many_cells');
       arr[ci]=cellValue(c,strings);count++;if(count>MAX_CELLS)throw new Error('too_many_cells');
     }
     rows[idx]=arr;
   }
   sheets.push({name,rows:rows.map(r=>r||[])});
 }
 if(!sheets.length)throw new Error('bad_excel');
 return {sheets};
}
const DATE = /^(date|day|time|timestamp|日付|年月日|日時|期間|日|週|月|period)$/i;
const ITEM = /^(sku|product|item|series|metric|indicator|商品|品目|指標|系列|製品|品番|商品名)$/i;
function label(v,fallback){const s=String(v??'').trim();return (s&&s.length<=85?s:fallback);}
function validDemand(v){const n=numberOrNull(v);return n!==null&&n>=0&&n<=1e9?n:null;}
function candidate(values,name,axis,index){
 const present=values.filter(v=>v!==''&&v!==null&&v!==undefined);
 if(present.length===0)return null;
 const nums=values.map(validDemand);const count=nums.filter(n=>n!==null).length;
 if(count<3||count/present.length<.75)return null;
 // Reject gaps inside a series instead of silently compressing time.
 if(nums.some((n,i)=>n===null && values[i]!=='' && values[i]!==null && values[i]!==undefined)) return null;
 const first=nums.findIndex(n=>n!==null),last=nums.findLastIndex(n=>n!==null);
 if(nums.slice(first,last+1).some(n=>n===null))return null;
 return {key:`${axis}:${index}`,name,values:nums.slice(first,last+1),axis,index,length:count,start:first,end:last};
}
export function inspectTable(raw){
 const rows=raw.filter(r=>Array.isArray(r)&&r.some(v=>v!==''&&v!==null&&v!==undefined));
 const cols=Math.min(MAX_COLS,Math.max(0,...rows.map(r=>r.length)));
 if(!rows.length||!cols)throw new Error('empty_sheet');
 const columns=[],rowSeries=[];
 const firstLabel=String(rows[0]?.[0]??'').trim();
 for(let j=0;j<cols;j++){
   if(j===0&&(DATE.test(firstLabel)||ITEM.test(firstLabel)))continue;
   const data=rows.slice(1).map(r=>r?.[j]??'');
   const c=candidate(data,label(rows[0]?.[j],`Column ${j+1}`),'column',j);
   if(c)columns.push(c);
 }
 // Nonheader-only numeric vertical single column without a header.
 if(!columns.length&&cols===1){const c=candidate(rows.map(r=>r[0]),'Demand','column',0);if(c)columns.push(c);}
 for(let i=1;i<rows.length;i++){
   const c=candidate((rows[i]||[]).slice(1),label(rows[i]?.[0],`Row ${i+1}`),'row',i);
   if(c)rowSeries.push(c);
 }
 if(!rowSeries.length&&rows.length===1){const c=candidate(rows[0],'Demand','row',0);if(c)rowSeries.push(c);}
 // Prefer the orientation with longer per-item histories; tie favors fewer items.
 const metric=arr=>arr.length ? (arr.reduce((a,c)=>a+c.length,0)/arr.length) * Math.min(1,arr.length/2+0.5) : 0;
 const axis=metric(columns)>=metric(rowSeries)?'column':'row';
 return {rows,columns:cols,orientation:axis,series:{column:columns,row:rowSeries}, detected:{column:columns.length,row:rowSeries.length},preview:rows.slice(0,7).map(r=>Array.from({length:Math.min(cols,7)},(_,j)=>r[j]??''))};
}
export function selectedSeries(inspection,orientation,keys,split=true){
 const available=inspection.series[orientation]||[];
 const chosen=available.filter(v=>keys.includes(v.key));
 if(!chosen.length)throw new Error('select_series');
 if(split||chosen.length===1)return chosen.map(s=>({...s,values:[...s.values]}));
 const len=chosen[0].values.length;
 if(!chosen.every(s=>s.values.length===len && s.start===chosen[0].start && s.end===chosen[0].end))throw new Error('cannot_sum');
 return [{key:'aggregate',name:'Total demand',axis:orientation,index:-1,length:len,values:Array.from({length:len},(_,i)=>chosen.reduce((a,s)=>a+s.values[i],0))}];
}
export function toCSV(rows){
 const quote=v=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
}
export function downloadText(filename,text,mime='text/csv;charset=utf-8'){
 const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
