import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/vault.js';
import {sealSession} from '../lib/security.js';
import {workspace,owner} from './fixtures.mjs';
let previousEnv,previousFetch,calls;
const secret=crypto.randomBytes(32).toString('hex'),origin='https://vault.example';
beforeEach(()=>{previousEnv={...process.env};previousFetch=globalThis.fetch;Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',VAULT_OWNER_ID:owner,VAULT_SESSION_SECRET:secret,APP_ORIGIN:origin});calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url,options});let result;
 if(url.endsWith('/auth/v1/user'))result={id:owner,email:'owner@example.test'};
 else if(url.includes('/token?'))result={access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:owner,email:'owner@example.test'}};
 else if(url.includes('/vault_allowed_users?'))result=[{user_id:owner}];
 else if(url.includes('/rpc/vault_save'))result={revision:2,updated_at:new Date().toISOString(),timezone:'UTC'};
 else result=[];
 return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});};});
afterEach(()=>{for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);globalThis.fetch=previousFetch;});
function response(){return {code:200,headers:{},data:null,setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(x){this.data=x;return this;}};}
function request(action,method='GET',body={},signed=false){return {query:{action},method,body,headers:{origin,'x-vault-request':'1','content-type':'application/json',...(signed?{cookie:'__Host-vault-session='+sealSession({access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:owner}},secret)}:{})}};}
test('No config produces honest local-only state',async()=>{delete process.env.SUPABASE_URL;const res=response();await handler(request('session'),res);assert.equal(res.code,200);assert.deepEqual(res.data,{configured:false,authenticated:false});assert.equal(calls.length,0);});
test('Workspace endpoint rejects unsigned reads and is never cached',async()=>{const res=response();await handler(request('workspace'),res);assert.equal(res.code,401);assert.match(res.headers['Cache-Control'],/no-store/);});
test('Foreign-origin login is rejected before any auth request',async()=>{const req=request('login','POST',{email:'owner@example.test',password:'test'});req.headers.origin='https://evil.example';const res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(calls.length,0);});
test('Login verifies owner allow-list and returns no tokens to JavaScript',async()=>{const res=response();await handler(request('login','POST',{email:'owner@example.test',password:'test'}),res);assert.equal(res.code,200);assert.ok(res.headers['Set-Cookie']);assert.ok(!JSON.stringify(res.data).includes('token'));assert.equal(calls.length,2);});
test('An authenticated non-owner is rejected',async()=>{globalThis.fetch=async()=>new Response(JSON.stringify({id:'22222222-2222-4222-8222-222222222222'}),{status:200});const res=response();await handler(request('workspace','GET',{},true),res);assert.equal(res.code,403);});
test('Valid workspace writes use the user JWT and a validated RPC',async()=>{const res=response();await handler(request('workspace','PUT',{data:workspace(),expectedRevision:1,mutationId:crypto.randomUUID(),timezone:'Asia/Dubai'},true),res);assert.equal(res.code,200);const rpc=calls.find(x=>x.url.includes('/rpc/vault_save'));assert.ok(rpc);assert.equal(rpc.options.headers.Authorization,'Bearer test-access');assert.equal(JSON.parse(rpc.options.body).p_data.version,2);});
test('Demo records and invalid revision IDs cannot be uploaded',async()=>{const data=workspace();data.demo=true;let res=response();await handler(request('workspace','PUT',{data,expectedRevision:1,mutationId:crypto.randomUUID(),timezone:'UTC'},true),res);assert.equal(res.code,400);res=response();await handler(request('workspace','PUT',{data:workspace(),expectedRevision:-1,mutationId:'bad',timezone:'UTC'},true),res);assert.equal(res.code,400);});
test('A database conflict is returned as HTTP 409 without replacing data',async()=>{const fetchBefore=globalThis.fetch;globalThis.fetch=async(url,options)=>url.includes('/rpc/vault_save')?new Response(JSON.stringify({message:'VAULT_CONFLICT'}),{status:400}):fetchBefore(url,options);const res=response();await handler(request('workspace','PUT',{data:workspace(),expectedRevision:1,mutationId:crypto.randomUUID(),timezone:'UTC'},true),res);assert.equal(res.code,409);});
test('Backup lookup rejects malformed IDs before querying financial data',async()=>{const req=request('backup','GET',{},true);req.query.id='../';const res=response();await handler(req,res);assert.equal(res.code,400);assert.equal(calls.length,1);});
