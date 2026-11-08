import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subscriptionMutationFromEvent} from '../server/subscription-store.js';

test('subscription webhook snapshot extracts durable billing state',()=>{
 const m=subscriptionMutationFromEvent({
  type:'customer.subscription.updated',
  data:{object:{id:'sub_123',customer:'cus_123',status:'active',livemode:false,cancel_at_period_end:true,current_period_end:1900000000,items:{data:[{price:{id:'price_123'}}]}}}
 });
 assert.deepEqual(m,{subscription:'sub_123',customer:'cus_123',status:'active',price:'price_123',currentPeriodEnd:1900000000,cancelAtPeriodEnd:true,livemode:false});
});

test('checkout completion creates pending subscription sync record',()=>{
 const m=subscriptionMutationFromEvent({type:'checkout.session.completed',data:{object:{mode:'subscription',subscription:'sub_abc',customer:'cus_abc',livemode:false}}});
 assert.equal(m.status,'checkout_complete_pending_sync');
 assert.equal(m.subscription,'sub_abc');assert.equal(m.customer,'cus_abc');
});

test('irrelevant Stripe events do not mutate subscription state',()=>{
 assert.equal(subscriptionMutationFromEvent({type:'payment_intent.succeeded',data:{object:{id:'pi_1'}}}),null);
});

test('public legal pages and SEO separation exist',()=>{
 const terms=readFileSync(new URL('../public/legal/terms/index.html',import.meta.url),'utf8');
 const privacy=readFileSync(new URL('../public/legal/privacy/index.html',import.meta.url),'utf8');
 const commerce=readFileSync(new URL('../public/legal/commerce/index.html',import.meta.url),'utf8');
 const billing=readFileSync(new URL('../public/legal/billing/index.html',import.meta.url),'utf8');
 const pro=readFileSync(new URL('../public/pro/index.html',import.meta.url),'utf8');
 const robots=readFileSync(new URL('../public/robots.txt',import.meta.url),'utf8');
 for(const html of [terms,privacy,commerce,billing])assert.match(html,/DemandScope/);
 assert.match(commerce,/本番販売開始前に掲載/);
 assert.match(pro,/noindex,nofollow/);
 assert.match(pro,/自動更新/);
 assert.match(robots,/Disallow: \/pro\//);
});

test('commercial migration contains idempotent Stripe event and subscription tables',()=>{
 const sql=readFileSync(new URL('../migrations/0001_commercial_core.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS stripe_events/);
 assert.match(sql,/event_id TEXT PRIMARY KEY/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS subscriptions/);
 assert.match(sql,/stripe_subscription_id TEXT PRIMARY KEY/);
});
