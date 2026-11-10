import {json} from '../../../server/stripe.js';
import {authMailGatewayConfig,gatewayHealth} from '../../../server/auth-mail-gateway.js';

export async function onRequestGet({env}){
 const cfg=authMailGatewayConfig(env);
 if(!cfg.configured)return json({available:false,enabled:false,provider:'auth-mail-gateway',ttl_minutes:10,cross_device:true});
 const health=await gatewayHealth(env);
 return json({
  available:health.ready===true,
  enabled:health.ready===true,
  provider:'auth-mail-gateway',
  gateway_reachable:health.reachable===true,
  sender_domain:health.ready?health.sender_domain:null,
  ttl_minutes:10,
  cross_device:true
 });
}
