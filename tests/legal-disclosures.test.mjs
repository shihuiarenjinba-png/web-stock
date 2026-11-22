import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

function read(path){return readFileSync(new URL('../'+path,import.meta.url),'utf8')}

test('legal pages distinguish browser-local analysis from server-side auth and billing',()=>{
  const privacy=read('public/legal/privacy/index.html');
  const terms=read('public/legal/terms/index.html');
  assert.match(privacy,/ブラウザ内/);
  assert.match(privacy,/技術ログ/);
  assert.match(privacy,/Stripe/);
  assert.match(terms,/サーバーへ集中保存しない/);
  assert.match(terms,/法令上負うべき責任を一律に免除/);
});

test('legal pages do not use blanket no-liability language',()=>{
  const all=[
    read('public/legal/privacy/index.html'),
    read('public/legal/terms/index.html'),
    read('public/legal/billing/index.html'),
    read('public/legal/commerce/index.html')
  ].join('\n');
  assert.doesNotMatch(all,/いかなる場合も一切責任を負いません/);
  assert.doesNotMatch(all,/一切の責任を負いません/);
});

test('commerce and billing disclose recurring price and switching limitations',()=>{
  const commerce=read('public/legal/commerce/index.html');
  const billing=read('public/legal/billing/index.html');
  assert.match(commerce,/1,580円\/月/);
  assert.match(commerce,/自動更新/);
  assert.match(commerce,/プラン変更/);
  assert.match(billing,/重複契約/);
  assert.match(billing,/分析データと決済データの分離/);
});
