import {json,isConfigured,configurationMissing,stripe,StripeApiError} from '../../server/stripe.js';

export async function onRequestGet({env}){
 const missing=configurationMissing(env);
 if(missing.length)return json({configured:false,reachable:false,missing,mode:'test'});
 const key_type=env.STRIPE_SECRET_KEY?.startsWith('rk_test_')?'restricted_test':env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'secret_test':'unknown';
 try{
   await stripe(env,'/checkout/sessions?limit=1');
   return json({configured:true,reachable:true,key_type,checkout_read:true,mode:'test'});
 }catch(e){
   if(e instanceof StripeApiError)return json({
     configured:true,reachable:false,key_type,checkout_read:false,mode:'test',
     stripe_status:e.status,stripe_type:e.type,stripe_code:e.code,detail:e.message,request_id:e.requestId,
     hint:e.status===403?'Restricted key is missing permission to read Checkout Sessions. Grant the minimum required Stripe permission.':e.status===401?'The Stripe test key is invalid or revoked.':'Stripe API returned an error.'
   },200);
   return json({configured:true,reachable:false,key_type,checkout_read:false,mode:'test',detail:'Unexpected Stripe connectivity error.'},200)
 }
}
