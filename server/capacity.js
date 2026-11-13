export const DEMANDSCOPE_PRO_CAPACITY=25;
const RESERVATION_TTL_SECONDS=30*60;
const CLAIM_TTL_SECONDS=24*60*60;

function nowSeconds(now){return Number.isInteger(now)?now:Math.floor(Date.now()/1000)}
function changes(result){const raw=result?.meta?.changes??result?.changes;return raw===undefined||raw===null?null:Number(raw)||0}
function validMember(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(id)}

export async function ensureCapacityTable(db){
  if(!db?.prepare)throw new Error('capacity_db_not_bound');
  await db.prepare(`CREATE TABLE IF NOT EXISTS capacity_reservations (
    reservation_id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    product_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_capacity_product ON capacity_reservations(product_key,expires_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_capacity_member ON capacity_reservations(member_id,product_key)').run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_capacity_member_product_unique ON capacity_reservations(member_id,product_key)').run();
}
async function cleanupExpired(db,now){await db.prepare('DELETE FROM capacity_reservations WHERE expires_at<=?').bind(now).run()}

export async function demandScopeCapacity(db,{priceId,now}={}){
  const ts=nowSeconds(now);
  await ensureCapacityTable(db);await cleanupExpired(db,ts);
  const active=await db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE livemode=1 AND price_id=? AND status IN ('active','trialing')")
    .bind(priceId||'').first();
  const reserved=await db.prepare("SELECT COUNT(*) AS n FROM capacity_reservations WHERE product_key='demand-scope-pro' AND expires_at>?").bind(ts).first();
  const activeCount=Number(active?.n)||0,reservedCount=Number(reserved?.n)||0;
  return {limit:DEMANDSCOPE_PRO_CAPACITY,active:activeCount,reserved:reservedCount,used:activeCount+reservedCount,remaining:Math.max(0,DEMANDSCOPE_PRO_CAPACITY-activeCount-reservedCount),sold_out:activeCount+reservedCount>=DEMANDSCOPE_PRO_CAPACITY};
}

export async function reserveDemandScopeCapacity(db,{memberId,priceId,now}){
  const ts=nowSeconds(now);
  if(!validMember(memberId))throw new Error('invalid_capacity_member');
  await ensureCapacityTable(db);await cleanupExpired(db,ts);
  const existing=await db.prepare("SELECT stripe_subscription_id FROM subscriptions WHERE member_id=? AND livemode=1 AND price_id=? AND status IN ('active','trialing') LIMIT 1")
    .bind(memberId,priceId||'').first();
  if(existing?.stripe_subscription_id)return {ok:false,reason:'already_subscribed',snapshot:await demandScopeCapacity(db,{priceId,now:ts})};
  const prior=await db.prepare("SELECT reservation_id,expires_at FROM capacity_reservations WHERE member_id=? AND product_key='demand-scope-pro' AND expires_at>? LIMIT 1")
    .bind(memberId,ts).first();
  if(prior?.reservation_id)return {ok:true,reservationId:prior.reservation_id,expiresAt:Number(prior.expires_at)||ts+RESERVATION_TTL_SECONDS,reused:true,snapshot:await demandScopeCapacity(db,{priceId,now:ts})};
  const reservationId='cap_'+crypto.randomUUID(),expiresAt=ts+RESERVATION_TTL_SECONDS;
  const result=await db.prepare(`INSERT OR IGNORE INTO capacity_reservations(reservation_id,member_id,product_key,status,expires_at)
    SELECT ?,?,'demand-scope-pro','pending',?
    WHERE (
      (SELECT COUNT(*) FROM subscriptions WHERE livemode=1 AND price_id=? AND status IN ('active','trialing')) +
      (SELECT COUNT(*) FROM capacity_reservations WHERE product_key='demand-scope-pro' AND expires_at>?)
    ) < ?`)
    .bind(reservationId,memberId,expiresAt,priceId||'',ts,DEMANDSCOPE_PRO_CAPACITY).run();
  if(changes(result)===0){
    const raced=await db.prepare("SELECT reservation_id,expires_at FROM capacity_reservations WHERE member_id=? AND product_key='demand-scope-pro' AND expires_at>? LIMIT 1")
      .bind(memberId,ts).first();
    if(raced?.reservation_id)return {ok:true,reservationId:raced.reservation_id,expiresAt:Number(raced.expires_at)||expiresAt,reused:true,snapshot:await demandScopeCapacity(db,{priceId,now:ts})};
    return {ok:false,reason:'capacity_full',snapshot:await demandScopeCapacity(db,{priceId,now:ts})};
  }
  return {ok:true,reservationId,expiresAt,reused:false,snapshot:await demandScopeCapacity(db,{priceId,now:ts})};
}

export async function releaseDemandScopeReservation(db,reservationId){
  if(!db?.prepare||!/^cap_[0-9a-f-]{36}$/i.test(String(reservationId||'')))return;
  await db.prepare('DELETE FROM capacity_reservations WHERE reservation_id=?').bind(reservationId).run();
}
export async function claimDemandScopeReservation(db,{reservationId,memberId,now}){
  if(!db?.prepare||!/^cap_[0-9a-f-]{36}$/i.test(String(reservationId||''))||!validMember(memberId))return;
  const ts=nowSeconds(now);
  await db.prepare("UPDATE capacity_reservations SET status='claimed',expires_at=? WHERE reservation_id=? AND member_id=? AND product_key='demand-scope-pro'")
    .bind(ts+CLAIM_TTL_SECONDS,reservationId,memberId).run();
}
export async function releaseDemandScopeMemberReservations(db,memberId){
  if(!db?.prepare||!validMember(memberId))return;
  await db.prepare("DELETE FROM capacity_reservations WHERE member_id=? AND product_key='demand-scope-pro'").bind(memberId).run();
}
