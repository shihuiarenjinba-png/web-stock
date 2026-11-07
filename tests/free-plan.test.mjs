import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
