import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDelimited,inspectTable,selectedSeries,toCSV} from '../public/assets/importer.js';
test('CSV quoting and TSV',()=>{
 assert.deepEqual(parseDelimited('Date,A,B\n"2026-01-01",12,14\n2026-01-02,17,19'),[['Date','A','B'],['2026-01-01','12','14'],['2026-01-02','17','19']]);
 assert.deepEqual(parseDelimited('Date\tX\n1\t4','\t'),[['Date','X'],['1','4']]);
 assert.deepEqual(parseDelimited('sku,value\n"A,B","2,000"'),[['sku','value'],['A,B','2,000']]);
 assert.throws(()=>parseDelimited('"x,2\n'),/unclosed_quote/);
});
test('wide 3-product table detects columns and skips date key',()=>{
 const rows=[['Date','SKU-A','SKU-B','SKU-C'],...Array.from({length:26},(_,i)=>['2026-01-'+String(i+1).padStart(2,'0'),10+i,14+i,21+i])];
 const r=inspectTable(rows);
 assert.equal(r.orientation,'column');assert.equal(r.detected.column,3);
 assert.deepEqual(r.series.column.map(s=>s.name),['SKU-A','SKU-B','SKU-C']);
 const picked=selectedSeries(r,'column',['column:1','column:2'],true);
 assert.equal(picked.length,2);assert.equal(picked[0].values.length,26);
 assert.equal(selectedSeries(r,'column',['column:1','column:2'],false)[0].values[0],24);
});
test('transposed table detects item rows and extracts 20 periods',()=>{
 const rows=[['SKU',...Array.from({length:20},(_,i)=>`Day ${i+1}`)],['A',...Array.from({length:20},(_,i)=>i+8)],['B',...Array.from({length:20},(_,i)=>i+18)]];
 const r=inspectTable(rows);assert.equal(r.orientation,'row');assert.equal(r.detected.row,2);
 assert.equal(selectedSeries(r,'row',['row:2'])[0].values.length,20);
});
test('unequal aligned periods cannot be aggregated',()=>{
 const r=inspectTable([['Day','A','B'],[1,10,''],[2,11,25],[3,12,26],[4,13,27],[5,14,28]]);
 assert.throws(()=>selectedSeries(r,'column',['column:1','column:2'],false),/cannot_sum/);
});
test('CSV export resists spreadsheet formula injection',()=>{
 const csv=toCSV([['name','result'],['=1+2',42],['-HACK',3]]);
 assert.ok(csv.includes("\"'=1+2\""));assert.ok(csv.includes("\"'-HACK\""));assert.ok(csv.includes('"42"'));
});
