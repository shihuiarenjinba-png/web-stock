import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subscriptionMutationFromEvent,checkoutAcceptanceFromEvent} from '../server/subscription-store.js';

test('subscription webhook snapshot extracts durable billing state',()=>{
 const m=subscriptionMutationFromEvent({
  type:'customer.subscription.updated',
  data:{object:{id:'sub_123',customer:'cus_123',status:'active',livemode:false,cancel_at_period_end:true,current_period_end:1900000000,items:{data:[{price:{id:'price_123'}}]}}}
 });
 assert.deepEqual(m,{subscription:'sub_123',customer:'cus_123',memberId:null,status:'active',price:'price_123',currentPeriodEnd:1900000000,cancelAtPeriodEnd:true,livemode:false});
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


test('checkout completion captures legal consent evidence for D1',()=>{
 const a=checkoutAcceptanceFromEvent({type:'checkout.session.completed',data:{object:{id:'cs_test_1',mode:'subscription',customer:'cus_1',subscription:'sub_1',livemode:false,metadata:{legal_version:'2026-11-08',legal_accepted_at:'1794190000'}}}});
 assert.deepEqual(a,{session:'cs_test_1',customer:'cus_1',subscription:'sub_1',memberId:null,legalVersion:'2026-11-08',acceptedAt:1794190000,livemode:false});
});
test('checkout consent without legal metadata is not persisted as evidence',()=>{
 assert.equal(checkoutAcceptanceFromEvent({type:'checkout.session.completed',data:{object:{id:'cs_test_1',mode:'subscription',customer:'cus_1',subscription:'sub_1',metadata:{}}}}),null);
});
test('checkout acceptance migration exists',()=>{
 const sql=readFileSync(new URL('../migrations/0002_checkout_acceptance.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS checkout_acceptances/);assert.match(sql,/legal_version TEXT NOT NULL/);
});


test('Stripe webhook metadata links authenticated member to subscription and consent',()=>{
 const event={type:'checkout.session.completed',data:{object:{id:'cs_test_member',mode:'subscription',customer:'cus_member',subscription:'sub_member',livemode:false,metadata:{member_id:'member_12345678',legal_version:'2026-11-08',legal_accepted_at:'1794191111'}}}};
 const s=subscriptionMutationFromEvent(event),a=checkoutAcceptanceFromEvent(event);
 assert.equal(s.memberId,'member_12345678');assert.equal(a.memberId,'member_12345678');
});
test('member-link D1 migration is present',()=>{
 const sql=readFileSync(new URL('../migrations/0003_member_stripe_link.sql',import.meta.url),'utf8');
 assert.match(sql,/checkout_acceptances ADD COLUMN member_id/);assert.match(sql,/idx_legal_acceptance_unique/);
});
