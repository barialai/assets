import crypto from 'node:crypto';

export const MAX_BYTES = 3 * 1024 * 1024;
const COOKIE = '__Host-vault-session';
export function configuration() {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, VAULT_OWNER_ID: owner, VAULT_SESSION_SECRET: secret, APP_ORIGIN: origin } = process.env;
  if (!url || !key || !owner || !secret || !origin || !key.startsWith('sb_publishable_')) return null;
  if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(url) || !/^[0-9a-f]{64}$/i.test(secret) || !/^[0-9a-f-]{36}$/i.test(owner)) return null;
  try { if (new URL(origin).origin !== origin || !origin.startsWith('https://')) return null; } catch { return null; }
  return { url: url.replace(/\/$/, ''), key, owner, secret, origin };
}
export function headers(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
export function fail(status, message) { const error = new Error(message); error.status = status; return error; }
export function guardWrite(req, config) {
  if (req.headers.origin !== config.origin || req.headers['x-vault-request'] !== '1') throw fail(403, 'Request origin was rejected. Use your configured production website.');
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'Send application/json.');
}
export function requestBody(req) {
  const raw = req.body;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
  if (Buffer.byteLength(text) > MAX_BYTES) throw fail(413, 'Cloud workspace limit is 3 MB. Download a local backup before reducing large images or records.');
  try { const body = JSON.parse(text); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; }
  catch { throw fail(400, 'Invalid JSON request.'); }
}
export function sealSession(session, secret) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  const data = Buffer.from(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at || Math.floor(Date.now()/1000) + session.expires_in, userId: session.user?.id || session.userId }));
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openSession(req, secret) {
  try {
    const value = String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if (!value || value.length > 7000) return null;
    const data=Buffer.from(value,'base64url');
    const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(secret,'hex'),data.subarray(0,12));
    decipher.setAuthTag(data.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString());
  } catch { return null; }
}
export function setSession(res, session, config) {
  const cookie = sealSession(session, config.secret);
  if (cookie.length > 3800) throw fail(500, 'Session is too large. Remove oversized authentication metadata.');
  res.setHeader('Set-Cookie', `${COOKIE}=${cookie}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`);
}
export function clearSession(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`); }
export async function upstream(config, path, { token, method='GET', body }={}) {
  const response = await fetch(config.url+path, { method, headers: { apikey:config.key, ...(token?{Authorization:'Bearer '+token}:{}), 'Content-Type':'application/json' }, ...(body===undefined?{}:{body:JSON.stringify(body)}), signal:AbortSignal.timeout(18000) });
  const text = await response.text(); let data; try { data = text?JSON.parse(text):null; } catch { data=null; }
  if (!response.ok) {
    if (String(data?.message || '').includes('VAULT_CONFLICT')) throw fail(409,'Another device has a newer workspace. Review both copies before continuing.');
    if (String(data?.message || '').includes('VAULT_NOT_ALLOWED')) throw fail(403,'This account is not allowed to access this workspace.');
    if (response.status===401 || response.status===403) throw fail(401,'Please sign in again.');
    if (response.status===429) throw fail(429,'Too many requests. Please wait a little before trying again.');
    if (String(data?.message || '').includes('VAULT_INVALID')) throw fail(400,'The database rejected invalid workspace data.');
    throw fail(502,'The private database request failed. Check the schema, project status and API configuration. Your local records are unchanged.');
  }
  return data;
}
export async function authenticated(req,res,config) {
  let session = openSession(req,config.secret);
  if (!session?.access_token || !session?.refresh_token || session.userId!==config.owner) throw fail(401,'Sign in to your private workspace.');
  if (Number(session.expires_at) < Date.now()/1000 + 90) {
    try { const fresh=await upstream(config,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}); session={...fresh,userId:fresh.user?.id}; if (session.userId!==config.owner) throw fail(403,'Not allowed.'); setSession(res,session,config); }
    catch(error) { if(error.status===401 || error.status===403) clearSession(res); throw error; }
  }
  const user=await upstream(config,'/auth/v1/user',{token:session.access_token});
  if(user?.id!==config.owner) throw fail(403,'This account is not allowed.');
  return {token:session.access_token,user};
}
export const uuid = x => typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
