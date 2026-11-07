import {json,verifyWebhook} from '../../server/stripe.js';
// This pilot has no subscription database. Entitlement is verified live with Stripe on every check.
// The signed webhook receiver is included for future processing and monitoring.
export async function onRequestPost({request,env}){const payload=await request.text();if(payload.length>1024*1024)return json({error:'Payload too large'},413);const verified=await verifyWebhook(payload,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET);if(!verified)return json({error:'Invalid webhook signature'},400);let event;try{event=JSON.parse(payload)}catch{return json({error:'Invalid payload'},400)};if(!event.type)return json({error:'Missing event type'},400);return json({received:true})}
