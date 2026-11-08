import {json,verifyWebhook} from '../../server/stripe.js';
import {persistStripeEvent} from '../../server/subscription-store.js';

export async function onRequestPost({request,env}){
 const payload=await request.text();
 if(payload.length>1024*1024)return json({error:'Payload too large'},413);
 const verified=await verifyWebhook(payload,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET);
 if(!verified)return json({error:'Invalid webhook signature'},400);
 let event;try{event=JSON.parse(payload)}catch{return json({error:'Invalid payload'},400)}
 if(typeof event?.id!=='string'||!event.id.startsWith('evt_')||typeof event?.type!=='string')return json({error:'Invalid Stripe event'},400);
 if(!env.DB)return json({error:'Subscription database is unavailable. Webhook not acknowledged so Stripe can retry.'},503);
 try{
  const result=await persistStripeEvent(env.DB,event);
  return json({received:true,duplicate:result.duplicate,subscription_updated:!!result.mutation});
 }catch{
  return json({error:'Webhook persistence failed. Stripe should retry.'},503);
 }
}
