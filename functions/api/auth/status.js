import {json} from '../../../server/stripe.js';
import {googleConfiguration,DEMANDSCOPE_GOOGLE_CLIENT_ID} from '../../../server/google-auth.js';

export async function onRequestGet({env}){
 const cfg=googleConfiguration(env);
 return json({
  provider:'google',
  configured:cfg.configured,
  issues:cfg.issues,
  client_id:DEMANDSCOPE_GOOGLE_CLIENT_ID,
  scopes:['openid','email','profile'],
  redirect_path:'/api/auth/google/callback'
 });
}
