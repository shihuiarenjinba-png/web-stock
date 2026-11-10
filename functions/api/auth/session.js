import {json} from '../../../server/stripe.js';
import {googleAuthStatus} from '../../../server/google-auth.js';
import {resolveEntitlement} from '../../../server/access.js';

export async function onRequestGet({request,env}){
 const identity=await googleAuthStatus(request,env);
 let entitlement=null;
 try{entitlement=identity.authenticated?await resolveEntitlement(request,env):null}catch{}
 return json({
   ...identity,
   entitlement:{active:!!entitlement,status:entitlement?.status||null,source:entitlement?.source||null}
 });
}
