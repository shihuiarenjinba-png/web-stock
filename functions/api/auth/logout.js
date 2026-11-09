import {json,validOrigin} from '../../../server/stripe.js';
import {authConfigured,clearAuthCookie} from '../../../server/auth.js';
export async function onRequestPost({request,env}){if(!authConfigured(env))return json({ok:true});if(!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);return json({ok:true},200,{'Set-Cookie':clearAuthCookie(request,env)})}
