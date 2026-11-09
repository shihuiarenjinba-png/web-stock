import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FREE_MAX_FILE_BYTES,FREE_MAX_PERIODS,FREE_MAX_SERIES,freeFileIssue,freeSeriesIssue,freeManualIssue} from '../public/assets/plan-limits.js';
const get = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=get('public/index.html'), app=get('public/assets/app.js'), style=get('public/assets/style.css'), pro=get('public/pro/index.html');
test('Free retains max-two import and basic output only',()=>{
 assert.match(html,/分析する系列（無料版は最大2）/);
 assert.match(app,/if\(selected.length>2\)/);
 assert.match(html,/id="downloadFree"/);
 assert.doesNotMatch(html,/id="downloadPdf"|id="downloadTxt"|id="copy"/);
 assert.doesNotMatch(app,/printRiskReport|downloadPdf|downloadTxt/);
 assert.match(app,/demandscope-free-summary\.csv/);
 assert.doesNotMatch(app,/\['P50'|'P90'|'P95'|'P99'/);
});
test('Free advanced analytics hidden, Pro retains detailed PDF',()=>{
 assert.match(style,/\.result-panel \.two-col/);
 assert.match(style,/\.free-hidden-controls/);
 assert.match(html,/free-lite-note/);
 assert.match(html,/Proで詳細分析を見る/);
 assert.match(pro,/id="proPdf"/);
});
test('Free uses fixed baseline and service level defaults',()=>{
 assert.match(app,/method:'sma',window:7/);
 assert.match(app,/service:95/);
 assert.match(html,/サービスレベル95%固定/);
});


test('Free data limits preserve Pro value for business-sized files',()=>{
 assert.equal(FREE_MAX_FILE_BYTES,500*1024);
 assert.equal(FREE_MAX_PERIODS,100);
 assert.equal(FREE_MAX_SERIES,2);
 assert.equal(freeFileIssue({size:500*1024}),null);
 assert.equal(freeFileIssue({size:500*1024+1}),'file_size');
 assert.equal(freeSeriesIssue([{values:Array(100).fill(1)},{values:Array(100).fill(2)}]),null);
 assert.equal(freeSeriesIssue([{values:Array(101).fill(1)}]),'period_count');
 assert.equal(freeSeriesIssue([{values:[1]},{values:[2]},{values:[3]}]),'series_count');
 assert.equal(freeManualIssue(Array(101).fill(1)),'period_count');
 assert.match(html,/500KB/);
 assert.match(html,/100期/);
});
