import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/assets/app.js',import.meta.url),'utf8');
const i18n=readFileSync(new URL('../public/assets/i18n.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../public/assets/style.css',import.meta.url),'utf8');
test('free spreadsheet selection explains stock versus demand in Japanese and English',()=>{
 assert.match(index,/class="help stock-explanation"/);
 assert.match(index,/現在庫2個として欠品確率を計算/);
 assert.match(i18n,/on-hand field is the quantity currently available/);
 assert.match(i18n,/It is not past demand or the number of selected series/);
});
test('each stock field has a visible per-series caption and accessible name',()=>{
 assert.match(app,/series-stock-caption/);
 assert.match(app,/On-hand \(units\)/);
 assert.match(app,/現在庫（個）/);
 assert.match(app,/on-hand inventory in units/);
 assert.match(style,/\.series-stock-cell/);
});
