import {origin} from '../../../server/stripe.js';

export async function onRequestGet({request}){
 const url=new URL('/pro/?magic=invalid',origin({},request));
 return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
