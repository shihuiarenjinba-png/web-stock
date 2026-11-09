import {json,isConfigured,configurationMissing,configurationDiagnostics,stripe,StripeApiError,billingMode,activeStripeKey} from '../../server/stripe.js';

export async function onRequestGet({env}){
 const mode=billingMode(env),missing=configurationMissing(env);
 if(missing.length)return json({configured:false,reachable:false,missing,issues:configurationDiagnostics(env),mode});
 const key=activeStripeKey(env);
 const key_type=key.startsWith('rk_live_')?'restricted_live':key.startsWith('sk_live_')?'secret_live':key.startsWith('rk_test_')?'restricted_test':key.startsWith('sk_test_')?'secret_test':'unknown';
 try{
   await stripe(env,'/checkout/sessions?limit=1');
   return json({configured:true,reachable:true,key_type,checkout_read:true,mode});
 }catch(e){
   if(e instanceof StripeApiError)return json({
     configured:true,reachable:false,key_type,checkout_read:false,mode,
     stripe_status:e.status,stripe_type:e.type,stripe_code:e.code,detail:e.message,request_id:e.requestId,
     hint:e.status===403?'Restricted key is missing permission to read Checkout Sessions. Grant the minimum required Stripe permission.':e.status===401?(mode==='live'?'The Stripe live key is invalid or revoked.':'The Stripe test key is invalid or revoked.'):'Stripe API returned an error.'
   },200);
   return json({configured:true,reachable:false,key_type,checkout_read:false,mode,detail:'Unexpected Stripe connectivity error.'},200)
 }
}
