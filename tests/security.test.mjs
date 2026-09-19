import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {sealSession,openSession,setSession,clearSession,guardWrite,requestBody,uuid} from '../lib/security.js';
import {validateState} from '../lib/validate-state.js';
import {workspace,owner} from './fixtures.mjs';
const secret=crypto.randomBytes(32).toString('hex');
const session={access_token:'test-access',refresh_token:'test-refresh',expires_at:2000000000,user:{id:owner}};
function reqCookie(c){return {headers:{cookie:'__Host-vault-session='+c}};}
test('Session cookie round trip preserves tokens without plaintext exposure',()=>{
 const sealed=sealSession(session,secret);assert.ok(!sealed.includes('test-access'));const opened=openSession(reqCookie(sealed),secret);assert.equal(opened.userId,owner);assert.equal(opened.refresh_token,'test-refresh');
});
test('Tampered and wrong-key cookies fail closed',()=>{
 const cookie=Buffer.from(sealSession(session,secret),'base64url');cookie[30]^=7;assert.equal(openSession(reqCookie(cookie.toString('base64url')),secret),null);assert.equal(openSession(reqCookie(sealSession(session,secret)),crypto.randomBytes(32).toString('hex')),null);
});
test('Cookies are Secure, HttpOnly, SameSite Strict and host-only',()=>{
 let cookie='';const res={setHeader:(k,v)=>{cookie=v;}};setSession(res,session,{secret});for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));assert.ok(!cookie.includes('Domain='));clearSession(res);assert.ok(cookie.includes('Max-Age=0'));
});
test('Writes reject a foreign origin and missing custom header',()=>{
 const config={origin:'https://vault.example'};assert.throws(()=>guardWrite({headers:{origin:'https://other.example'}},config),/rejected/);assert.throws(()=>guardWrite({headers:{origin:config.origin,'content-type':'application/json'}},config),/rejected/);guardWrite({headers:{origin:config.origin,'x-vault-request':'1','content-type':'application/json'}},config);
});
test('Request parsing rejects invalid JSON, array roots and oversized payloads',()=>{
 assert.throws(()=>requestBody({body:'{'}),/Invalid/);assert.throws(()=>requestBody({body:[]}),/Invalid/);assert.throws(()=>requestBody({body:{text:'x'.repeat(3*1024*1024)}}),/3 MB/);assert.deepEqual(requestBody({body:{x:1}}),{x:1});
});
test('UUIDs for idempotency cannot be arbitrary strings',()=>{assert.equal(uuid(owner),true);assert.equal(uuid('../secret'),false);});
test('The v2 ledger round trip retains records and badge',()=>{const s=workspace(),v=validateState(s);assert.deepEqual(v,s);assert.equal(v.profile.badge,true);});
test('Legacy v1 files migrate without inventing loan records',()=>{const s=workspace();s.version=1;delete s.loans;delete s.loanPayments;const v=validateState(s);assert.equal(v.version,2);assert.deepEqual(v.loans,[]);});
test('Duplicate assets and unknown currencies are rejected',()=>{const s=workspace();s.assets.push({...s.assets[0]});assert.throws(()=>validateState(s),/duplicate/);const t=workspace();t.assets[0].currency='BAD';assert.throws(()=>validateState(t),/invalid/);});
test('Unsafe image sources are not persisted as executable URLs',()=>{const s=workspace();s.profile.photo='javascript:alert(1)';s.assets[0].logo='https://tracking.example/a.png';const v=validateState(s);assert.equal(v.profile.photo,'');assert.equal(v.assets[0].logo,'');});
test('Invalid dates, negative balances and orphaned transfers are rejected',()=>{
 const entry={id:'entry-1',assetId:'cash-1',kind:'expense',amount:1,fx:1,date:'2026-02-30'};let s=workspace();s.entries.push(entry);assert.throws(()=>validateState(s),/invalid/);s=workspace();s.entries.push({...entry,date:'2026-09-01',amount:1001});assert.throws(()=>validateState(s),/negative/);s=workspace();s.entries.push({...entry,date:'2026-09-01',kind:'transfer_out',groupId:'group-1'});assert.throws(()=>validateState(s),/incomplete/);
});
test('Loan repayment above outstanding principal is rejected',()=>{const s=workspace();s.loans.push({id:'loan-1',direction:'borrowed',title:'Test loan',person:'Example',currency:'USDT',principal:100,openingOutstanding:50,startDate:'2026-01-01',dueDate:'',notes:'',openingEntryId:'',createdAt:'2026-01-01T12:00:00Z'});s.loanPayments.push({id:'payment-1',loanId:'loan-1',date:'2026-09-01',principal:51,interest:0,fx:1,accountId:'',entryId:'',note:'',previousDueDate:'',nextDueDate:'',createdAt:'2026-09-01T12:00:00Z'});assert.throws(()=>validateState(s),/exceed/);});
