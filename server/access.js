import {entitlement as legacyEntitlement,verifiedSubscription} from './stripe.js';
import {authenticatedMember} from './auth.js';

export async function resolveEntitlement(request,env){
 if(env?.AUTH_REQUIRED!=='true')return legacyEntitlement(request,env);
 const member=await authenticatedMember(request,env);if(!member||!env?.DB?.prepare)return null;
 const row=await env.DB.prepare("SELECT stripe_subscription_id,stripe_customer_id,status FROM subscriptions WHERE member_id=? AND livemode=0 AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 1").bind(member.id).first();
 if(!row)return null;
 const sub=await verifiedSubscription(env,row.stripe_subscription_id,row.stripe_customer_id);if(!sub)return null;
 return {customer:row.stripe_customer_id,subscription:row.stripe_subscription_id,status:sub.status,member};
}
