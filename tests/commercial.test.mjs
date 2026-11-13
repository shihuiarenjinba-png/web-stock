import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subscriptionMutationFromEvent,checkoutAcceptanceFromEvent} from '../server/subscription-store.js';
import {DEMANDSCOPE_PRO_CAPACITY} from '../server/capacity.js';

test('subscription webhook snapshot extracts durable billing state',()=>{
 const m=subscriptionMutationFromEvent({
  type:'customer.subscription.updated',
  data:{object:{id:'sub_123',customer:'cus_123',status:'active',livemode:false,cancel_at_period_end:true,current_period_end:1900000000,items:{data:[{price:{id:'price_123'}}]}}}
 });
 assert.deepEqual(m,{subscription:'sub_123',customer:'cus_123',memberId:null,status:'active',price:'price_123',currentPeriodEnd:1900000000,cancelAtPeriodEnd:true,livemode:false});
});

test('checkout completion does not overwrite subscription lifecycle state',()=>{
 const m=subscriptionMutationFromEvent({type:'checkout.session.completed',data:{object:{mode:'subscription',subscription:'sub_abc',customer:'cus_abc',livemode:false}}});
 assert.equal(m,null);
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
 assert.match(commerce,/980円\/月/);assert.match(commerce,/請求があり次第遅滞なく/);assert.match(billing,/日割返金は行いません/);
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
 const a=checkoutAcceptanceFromEvent({type:'checkout.session.completed',data:{object:{id:'cs_test_1',mode:'subscription',customer:'cus_1',subscription:'sub_1',livemode:false,metadata:{legal_version:'2026-11-10',legal_accepted_at:'1794190000'}}}});
 assert.deepEqual(a,{session:'cs_test_1',customer:'cus_1',subscription:'sub_1',memberId:null,legalVersion:'2026-11-10',acceptedAt:1794190000,livemode:false});
});
test('checkout consent without legal metadata is not persisted as evidence',()=>{
 assert.equal(checkoutAcceptanceFromEvent({type:'checkout.session.completed',data:{object:{id:'cs_test_1',mode:'subscription',customer:'cus_1',subscription:'sub_1',metadata:{}}}}),null);
});
test('checkout acceptance migration exists',()=>{
 const sql=readFileSync(new URL('../migrations/0002_checkout_acceptance.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS checkout_acceptances/);assert.match(sql,/legal_version TEXT NOT NULL/);
});


test('Stripe checkout metadata links authenticated member to durable consent without mutating subscription lifecycle state',()=>{
 const event={type:'checkout.session.completed',data:{object:{id:'cs_test_member',mode:'subscription',customer:'cus_member',subscription:'sub_member',livemode:false,metadata:{member_id:'member_12345678',legal_version:'2026-11-10',legal_accepted_at:'1794191111'}}}};
 const s=subscriptionMutationFromEvent(event),a=checkoutAcceptanceFromEvent(event);
 assert.equal(s,null);assert.equal(a.memberId,'member_12345678');assert.equal(a.subscription,'sub_member');
});
test('member-link D1 migration is present',()=>{
 const sql=readFileSync(new URL('../migrations/0003_member_stripe_link.sql',import.meta.url),'utf8');
 assert.match(sql,/checkout_acceptances ADD COLUMN member_id/);assert.match(sql,/idx_legal_acceptance_unique/);
});


test('launch capacity is capped at 25 paid Pro seats',()=>{
 assert.equal(DEMANDSCOPE_PRO_CAPACITY,25);
 const sql=readFileSync(new URL('../migrations/0004_launch_capacity.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS capacity_reservations/);
 assert.match(sql,/expires_at INTEGER NOT NULL/);
});

test('capacity reservation is unique per member and product',()=>{
 const sql=readFileSync(new URL('../migrations/0005_capacity_reservation_dedupe.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS idx_capacity_member_product_unique/);
 assert.match(sql,/member_id,product_key/);
 const source=readFileSync(new URL('../server/capacity.js',import.meta.url),'utf8');
 assert.match(source,/INSERT OR IGNORE INTO capacity_reservations/);
 assert.match(source,/SELECT reservation_id,expires_at FROM capacity_reservations WHERE member_id=/);
});

test('checkout completion preserves capacity reservation evidence when present',()=>{
 const a=checkoutAcceptanceFromEvent({type:'checkout.session.completed',data:{object:{
  id:'cs_live_capacity',mode:'subscription',customer:'cus_capacity',subscription:'sub_capacity',livemode:true,
  metadata:{member_id:'member_12345678',legal_version:'2026-11-10',legal_accepted_at:'1794192222',capacity_reservation_id:'cap_12345678-1234-1234-1234-123456789abc'}
 }}});
 assert.equal(a.reservationId,'cap_12345678-1234-1234-1234-123456789abc');
});
