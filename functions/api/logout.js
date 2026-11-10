import {json,clearCookie,isConfigured,validOrigin,origin} from '../../server/stripe.js';
import {clearIdentityCookie} from '../../server/google-auth.js';

export function onRequestPost({request,env}){
 if(!isConfigured(env)||!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);
 const secure=origin(env,request).startsWith('https:');
 const headers=new Headers();
 headers.append('Set-Cookie',clearCookie(secure));
 headers.append('Set-Cookie',clearIdentityCookie(request,env));
 return json({ok:true},200,headers);
}
