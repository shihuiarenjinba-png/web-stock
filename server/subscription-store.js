function id(value,prefix){return typeof value==='string'&&value.startsWith(prefix)?value:null}
function firstPrice(sub){const item=sub?.items?.data?.[0];return id(item?.price?.id,'price_')}
function periodEnd(sub){const candidates=[sub?.current_period_end,sub?.items?.data?.[0]?.current_period_end];for(const v of candidates)if(Number.isInteger(v)&&v>0)return v;return null}

export function subscriptionMutationFromEvent(event){
 const type=event?.type,obj=event?.data?.object||{};
 if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(type)){
  const subscription=id(obj.id,'sub_'),customer=id(obj.customer,'cus_');if(!subscription||!customer)return null;
  return {subscription,customer,status:String(obj.status||'unknown'),price:firstPrice(obj),currentPeriodEnd:periodEnd(obj),cancelAtPeriodEnd:obj.cancel_at_period_end===true,livemode:obj.livemode===true};
 }
 if(type==='checkout.session.completed'&&obj.mode==='subscription'){
  const subscription=id(obj.subscription,'sub_'),customer=id(obj.customer,'cus_');if(!subscription||!customer)return null;
  return {subscription,customer,status:'checkout_complete_pending_sync',price:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,livemode:obj.livemode===true};
 }
 return null;
}

export async function persistStripeEvent(db,event){
 if(!db?.prepare)throw new Error('D1 DB binding is missing');
 if(!id(event?.id,'evt_')||typeof event?.type!=='string')throw new Error('Invalid Stripe event');
 const existing=await db.prepare('SELECT processed_at FROM stripe_events WHERE event_id = ?').bind(event.id).first();
 if(existing?.processed_at)return {duplicate:true,mutation:null};
 await db.prepare('INSERT OR IGNORE INTO stripe_events(event_id,event_type,stripe_created,livemode) VALUES(?,?,?,?)')
  .bind(event.id,event.type,Number.isInteger(event.created)?event.created:null,event.livemode===true?1:0).run();
 const mutation=subscriptionMutationFromEvent(event);
 try{
  if(mutation){
   await db.prepare(`INSERT INTO subscriptions(stripe_subscription_id,stripe_customer_id,status,price_id,current_period_end,cancel_at_period_end,livemode,updated_at)
VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
ON CONFLICT(stripe_subscription_id) DO UPDATE SET
stripe_customer_id=excluded.stripe_customer_id,status=excluded.status,price_id=COALESCE(excluded.price_id,subscriptions.price_id),
current_period_end=COALESCE(excluded.current_period_end,subscriptions.current_period_end),
cancel_at_period_end=excluded.cancel_at_period_end,livemode=excluded.livemode,updated_at=CURRENT_TIMESTAMP`)
    .bind(mutation.subscription,mutation.customer,mutation.status,mutation.price,mutation.currentPeriodEnd,mutation.cancelAtPeriodEnd?1:0,mutation.livemode?1:0).run();
  }
  await db.prepare('UPDATE stripe_events SET processed_at=CURRENT_TIMESTAMP,last_error=NULL WHERE event_id=?').bind(event.id).run();
  return {duplicate:false,mutation};
 }catch(e){
  const message=String(e?.message||e).slice(0,500);
  try{await db.prepare('UPDATE stripe_events SET last_error=? WHERE event_id=?').bind(message,event.id).run()}catch{}
  throw e;
 }
}
