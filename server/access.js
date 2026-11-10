import {entitlement as stripeEntitlement} from './stripe.js';

export async function resolveEntitlement(request,env){
 return stripeEntitlement(request,env);
}
