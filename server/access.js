import {entitlement as stripeEntitlement,verifiedSubscription,stripe} from './stripe.js';
import {authenticatedMember} from './google-auth.js';

function aggregatePlan(capabilities,plans=[]){
 const inventory=capabilities.includes('inventory');
 const markdown=capabilities.includes('markdown');
 const markdown10=capabilities.includes('markdown10');
 if(inventory&&markdown10)return 'combined10';
 if(inventory&&markdown)return plans.includes('bundle')?'bundle':'combined';
 if(markdown10)return 'markdown10';
 if(markdown)return 'markdown';
 return inventory?'inventory':null;
}

async function memberEntitlement(request,env){
 const member=await authenticatedMember(request,env);
 if(!member)return null;
 const matches=[];
 if(env?.DB?.prepare){
   const rows=await env.DB.prepare("SELECT stripe_subscription_id,stripe_customer_id FROM subscriptions WHERE member_id=? AND status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 10").bind(member.id).all();
   for(const row of rows?.results||[]){
     try{
       const sub=await verifiedSubscription(env,row.stripe_subscription_id,row.stripe_customer_id||member.stripe_customer_id||null);
       if(sub)matches.push({customer:row.stripe_customer_id||member.stripe_customer_id,subscription:row.stripe_subscription_id,status:sub.status,plan:sub.demandScopePlan,capabilities:sub.demandScopeCapabilities});
     }catch{}
   }
 }
 if(matches.length===0&&member.stripe_customer_id){
   try{
     const list=await stripe(env,'/subscriptions?customer='+encodeURIComponent(member.stripe_customer_id)+'&status=all&limit=20');
     for(const candidate of list?.data||[]){
       if(!['active','trialing'].includes(candidate?.status)||candidate?.metadata?.app!=='demand-scope-pro')continue;
       const sub=await verifiedSubscription(env,candidate.id,member.stripe_customer_id);
       if(sub)matches.push({customer:member.stripe_customer_id,subscription:candidate.id,status:sub.status,plan:sub.demandScopePlan,capabilities:sub.demandScopeCapabilities});
     }
   }catch{}
 }
 if(!matches.length)return null;
 const capabilities=[...new Set(matches.flatMap(x=>Array.isArray(x.capabilities)?x.capabilities:[]))];
 const plan=aggregatePlan(capabilities,matches.map(x=>x.plan));
 return {customer:matches[0].customer,subscription:matches[0].subscription,subscriptions:matches.map(x=>x.subscription),status:matches[0].status,source:'google',member_id:member.id,plan,capabilities};
}
export async function resolveEntitlement(request,env){
 const [browser,member]=await Promise.all([stripeEntitlement(request,env),memberEntitlement(request,env)]);
 if(browser&&member){
  const capabilities=[...new Set([...(browser.capabilities||[]),...(member.capabilities||[])])];
  const plan=aggregatePlan(capabilities,[browser.plan,member.plan]);
  return {...member,...browser,source:'browser+google',plan,capabilities,subscriptions:[...new Set([...(member.subscriptions||[]),browser.subscription].filter(Boolean))]};
 }
 if(browser)return {...browser,source:'browser'};
 return member;
}
