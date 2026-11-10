import {json} from '../../../server/stripe.js';
import {magicLinkConfig} from '../../../server/magic-link.js';
export async function onRequestGet({env}){
 const cfg=magicLinkConfig(env);
 return json({available:cfg.configured,enabled:cfg.enabled,sender_domain:cfg.configured?cfg.sender_domain:null,ttl_minutes:10,cross_device:true});
}
