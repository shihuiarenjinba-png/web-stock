import {formatNumber} from './logic.js';
export function drawHistogram(canvas,r,locale='ja'){const ctx=canvas.getContext('2d');if(!ctx)return;const ratio=Math.min(window.devicePixelRatio||1,2),w=canvas.clientWidth||550,h=canvas.clientHeight||215;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
 const left=37,right=w-11,top=16,bottom=h-34,pad=right-left,plotH=bottom-top;
 const vals=r.sums,min=Math.max(0,Math.min(vals[0],r.inventory??vals[0],r.reorderPoint)*.95),max=Math.max(vals.at(-1),r.inventory??0,r.reorderPoint)*1.05||1;
 const bins=29, step=(max-min)/bins, counts=Array(bins).fill(0);for(const v of vals){counts[Math.min(bins-1,Math.max(0,Math.floor((v-min)/step)))]++;}const maxCount=Math.max(...counts)||1;
 ctx.strokeStyle='#2a4056';ctx.lineWidth=1;ctx.font='10px system-ui';ctx.fillStyle='#7890a7';ctx.textAlign='right';for(let i=0;i<=3;i++){let y=bottom-(i/3)*plotH;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(String(Math.round(maxCount*i/3)),left-7,y+3)}
 const bw=pad/bins;counts.forEach((v,i)=>{let bh=(v/maxCount)*plotH;ctx.fillStyle='#47c9bd';ctx.globalAlpha=.3+.5*(v/maxCount);ctx.fillRect(left+i*bw+1,bottom-bh,Math.max(.9,bw-2),bh)});ctx.globalAlpha=1;
 const mark=(value,color,label)=>{let x=left+(value-min)/(max-min)*pad;ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.textAlign=x>right-45?'right':'left';ctx.fillText(label,x+(x>right-45?-3:4),top-5)};
 mark(r.reorderPoint,'#f2bd78',locale==='en'?'ROP':'発注点');if(r.inventory!==null)mark(r.inventory,'#8caeff',locale==='en'?'Stock':'在庫');ctx.fillStyle='#849bb4';ctx.textAlign='center';ctx.font='10px system-ui';for(let i=0;i<=4;i++){let x=left+(i/4)*pad;ctx.fillText(formatNumber(min+(i/4)*(max-min),0),x,bottom+18)}
}
