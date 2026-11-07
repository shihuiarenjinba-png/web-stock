import {json,clearCookie,isConfigured,validOrigin,origin} from '../../server/stripe.js';
export function onRequestPost({request,env}){if(!isConfigured(env)||!validOrigin(request,env))return json({error:'アクセス元を確認できません。'},403);return json({ok:true},200,{'Set-Cookie':clearCookie(origin(env).startsWith('https:'))})}
