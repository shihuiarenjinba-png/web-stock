import {json,entitlement,isConfigured} from '../../server/stripe.js';
export async function onRequestGet({request,env}){if(!isConfigured(env))return json({active:false,configured:false});try{const data=await entitlement(request,env);return json({active:!!data,configured:true,status:data?.status||null})}catch{return json({active:false,configured:true,error:'Stripeとの接続を確認できませんでした。'},503)}}
