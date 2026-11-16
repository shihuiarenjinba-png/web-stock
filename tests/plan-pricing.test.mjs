import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMANDSCOPE_PLANS,
  LIVE_INVENTORY_PRICE_ID,
  LIVE_MARKDOWN_PRICE_ID,
  LIVE_BUNDLE_PRICE_ID,
  planDefinition,
  planForPriceId,
  capabilitiesForPriceId,
  validateLivePriceObject
} from '../server/stripe.js';

const liveEnv={LIVE_BILLING_ENABLED:'true'};

test('three live plans have stable prices and capabilities',()=>{
  assert.equal(DEMANDSCOPE_PLANS.inventory.amount,980);
  assert.equal(DEMANDSCOPE_PLANS.markdown.amount,980);
  assert.equal(DEMANDSCOPE_PLANS.bundle.amount,1800);
  assert.deepEqual(DEMANDSCOPE_PLANS.inventory.capabilities,['inventory']);
  assert.deepEqual(DEMANDSCOPE_PLANS.markdown.capabilities,['markdown']);
  assert.deepEqual(DEMANDSCOPE_PLANS.bundle.capabilities,['inventory','markdown']);
});

test('price ids map to the intended plans',()=>{
  assert.equal(planForPriceId(liveEnv,LIVE_INVENTORY_PRICE_ID),'inventory');
  assert.equal(planForPriceId(liveEnv,LIVE_MARKDOWN_PRICE_ID),'markdown');
  assert.equal(planForPriceId(liveEnv,LIVE_BUNDLE_PRICE_ID),'bundle');
  assert.deepEqual(capabilitiesForPriceId(liveEnv,LIVE_BUNDLE_PRICE_ID),['inventory','markdown']);
});

test('live price validation rejects wrong amount or capability',()=>{
  const product={active:true,metadata:{app:'demand-scope-pro'}};
  const good={livemode:true,active:true,currency:'jpy',unit_amount:1800,recurring:{interval:'month',interval_count:1},metadata:{capability:'bundle'},product};
  assert.equal(validateLivePriceObject(good,{expectedAmount:1800,expectedCapability:'bundle'}).ok,true);
  assert.equal(validateLivePriceObject({...good,unit_amount:980},{expectedAmount:1800,expectedCapability:'bundle'}).reason,'amount');
  assert.equal(validateLivePriceObject({...good,metadata:{capability:'inventory'}},{expectedAmount:1800,expectedCapability:'bundle'}).reason,'price_metadata');
});

test('unknown plan is rejected by planDefinition',()=>{
  assert.equal(planDefinition('unknown'),null);
});
