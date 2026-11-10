import {json,validOrigin} from '../../../server/stripe.js';
import {createMagicLink,normalizeEmail,magicLinkConfig} from '../../../server/magic-link.js';

export async function onRequestPost({request,env}){
 const cfg=magicLinkConfig(env);
 if(!cfg.enabled)return json({ok:false,available:false,message:'別端末ログインは現在準備中です。'},503);
 if(!cfg.configured)return json({ok:false,available:false,message:'メール認証の設定が未完了です。'},503);
 if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 let input={};try{input=await request.json()}catch{}
 const email=normalizeEmail(input?.email);
 if(!email)return json({error:'メールアドレスを正しく入力してください。'},400);
 await createMagicLink(env,email,request);
 // Never reveal whether a Stripe customer/subscription exists for this email.
 return json({ok:true,available:true,message:'有効なDemandScope Pro契約が確認できる場合、このメールアドレスへ10分間有効なログインリンクを送信します。'},202);
}
