import {entitlement as stripeEntitlement,verifiedSubscription,stripe} from './stripe.js';
import {authenticatedMember} from './google-auth.js';

async function memberEntitlement(request,env){
 const member=await authenticatedMember(request,env);
 if(!member)return null;
 if(env?.DB?.prepare){
   const rows=await env.DB.prepare("SELECT stripe_subscription_id,stripe_customer_id FROM subscriptions WHERE member_id=? AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 5").bind(member.id).all();
   for(const row of rows?.results||[]){
     try{
       const sub=await verifiedSubscription(env,row.stripe_subscription_id,row.stripe_customer_id||member.stripe_customer_id||null);
       if(sub)return {customer:row.stripe_customer_id||member.stripe_customer_id,subscription:row.stripe_subscription_id,status:sub.status,source:'google',member_id:member.id};
     }catch{}
   }
 }
 if(member.stripe_customer_id){
   try{
     const list=await stripe(env,'/subscriptions?customer='+encodeURIComponent(member.stripe_customer_id)+'&status=all&limit=20');
     for(const candidate of list?.data||[]){
       if(!['active','trialing'].includes(candidate?.status)||candidate?.metadata?.app!=='demand-scope-pro')continue;
       const sub=await verifiedSubscription(env,candidate.id,member.stripe_customer_id);
       if(sub)return {customer:member.stripe_customer_id,subscription:candidate.id,status:sub.status,source:'google',member_id:member.id};
     }
   }catch{}
 }
 return null;
}

export async function resolveEntitlement(request,env){
 const browser=await stripeEntitlement(request,env);
 if(browser)return {...browser,source:'browser'};
 return memberEntitlement(request,env);
}
