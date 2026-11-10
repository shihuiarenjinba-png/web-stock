import {stripe,verifiedSubscription} from './stripe.js';

export function normalizeEmail(value){
 const email=String(value||'').trim().toLowerCase();
 return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}

export async function findActiveDemandScopeSubscription(env,email){
 const normalized=normalizeEmail(email);if(!normalized)return null;
 const customers=await stripe(env,`/customers?email=${encodeURIComponent(normalized)}&limit=10`);
 for(const customer of customers?.data||[]){
  if(!/^cus_[A-Za-z0-9]+$/.test(customer?.id))continue;
  const subs=await stripe(env,`/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=20`);
  for(const candidate of subs?.data||[]){
   if(!['active','trialing'].includes(candidate?.status)||candidate?.metadata?.app!=='demand-scope-pro')continue;
   const verified=await verifiedSubscription(env,candidate.id,customer.id);
   if(verified)return {customer:customer.id,subscription:candidate.id,status:verified.status};
  }
 }
 return null;
}
