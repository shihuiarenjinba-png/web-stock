import {json,validOrigin,origin} from '../../../server/stripe.js';
import {findActiveDemandScopeSubscription,normalizeEmail} from '../../../server/subscription-lookup.js';
import {authMailGatewayConfig,requestGatewayMagicLink} from '../../../server/auth-mail-gateway.js';

const genericMessage='有効なDemandScope Pro契約が確認できる場合、購入時メールアドレスへ10分間有効な本人確認リンクを送信します。';
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export async function onRequestPost({request,env}){
 const cfg=authMailGatewayConfig(env);
 if(!cfg.configured)return json({ok:false,available:false,message:'共通メール認証基盤の設定が未完了です。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let input={};try{input=await request.json()}catch{}
 const email=normalizeEmail(input?.email);
 if(!email)return json({error:'メールアドレスを正しく入力してください。'},400);

 const state=b64url(crypto.getRandomValues(new Uint8Array(32)));
 const secure=origin(env,request).startsWith('https:');
 const stateCookie=`demand_magic_state=${state}; Path=/api/magic-link/callback; Max-Age=900; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;

 try{
  const access=await findActiveDemandScopeSubscription(env,email);
  if(access)await requestGatewayMagicLink(env,email,state);
 }catch{
  // Keep the same public response so an email address cannot be probed for membership.
 }
 return json({ok:true,available:true,message:genericMessage},202,{'Set-Cookie':stateCookie});
}
