import {configuration,headers,fail,guardWrite,requestBody,authenticated,upstream,setSession,clearSession,uuid} from '../lib/security.js';
import {validateState} from '../lib/validate-state.js';

export default async function handler(req,res) {
  headers(res);
  try {
    const action=String(req.query?.action || 'session'), config=configuration();
    if (req.method==='GET' && action==='session' && !config) return res.status(200).json({configured:false,authenticated:false});
    if (!config) throw fail(503,'Cloud is not configured. Complete SETUP.md; local features remain available.');
    if (req.headers['sec-fetch-site']==='cross-site') throw fail(403,'Cross-site requests are not accepted.');
    if (!['GET','HEAD'].includes(req.method)) guardWrite(req,config);
    const body=['POST','PUT','PATCH'].includes(req.method)?requestBody(req):{};
    if (action==='login' && req.method==='POST') {
      if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length<1||body.password.length>1024) throw fail(400,'Enter your email and password.');
      let session;
      try { session=await upstream(config,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:body.email.trim(),password:body.password}}); }
      catch(e) { if(e.status===429)throw e; throw fail(401,'Sign-in failed. Check your account details.'); }
      if(session.user?.id!==config.owner)throw fail(403,'Sign-in failed. This is a private single-owner workspace.');
      // RLS allow-list must also be present. Do not trust only the configured UUID.
      const allowed=await upstream(config,'/rest/v1/vault_allowed_users?select=user_id&limit=1',{token:session.access_token});
      if(!allowed?.some(row=>row.user_id===config.owner))throw fail(403,'Add your user to the database allow-list before signing in.');
      setSession(res,session,config);return res.status(200).json({configured:true,authenticated:true,user:{id:session.user.id,email:session.user.email}});
    }
    if(action==='logout' && req.method==='POST'){
      try{const {token}=await authenticated(req,res,config);await upstream(config,'/auth/v1/logout?scope=local',{token,method:'POST'});}catch{}
      clearSession(res);return res.status(200).json({ok:true});
    }
    let auth;
    try { auth=await authenticated(req,res,config); }
    catch(error){if(action==='session'&&req.method==='GET'&&error.status===401)return res.status(200).json({configured:true,authenticated:false});throw error;}
    const rpc=(name,data={})=>upstream(config,'/rest/v1/rpc/'+name,{token:auth.token,method:'POST',body:data});
    if(action==='session' && req.method==='GET')return res.status(200).json({configured:true,authenticated:true,user:{id:auth.user.id,email:auth.user.email}});
    if(action==='workspace' && req.method==='GET'){
      const [rows,status]=await Promise.all([upstream(config,'/rest/v1/vault_workspaces?select=data,revision,timezone,updated_at&limit=1',{token:auth.token}),rpc('vault_status')]);
      return res.status(200).json({workspace:rows?.[0]||null,status});
    }
    if(action==='workspace' && req.method==='PUT') {
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!uuid(body.mutationId))throw fail(400,'Invalid workspace revision or request identifier.');
      if(typeof body.timezone!=='string'||body.timezone.length>80)throw fail(400,'Choose a valid time zone.');
      try {new Intl.DateTimeFormat('en',{timeZone:body.timezone});}catch{throw fail(400,'Choose a valid time zone.');}
      let data;try{data=validateState(body.data);}catch(error){throw fail(400,error.message);}
      if(data.demo)throw fail(400,'Sample data is not uploaded. Restore your own records or start a fresh workspace first.');
      const saved=await rpc('vault_save',{p_data:data,p_expected:body.expectedRevision,p_mutation:body.mutationId,p_timezone:body.timezone,p_replace:body.replace===true});
      return res.status(200).json(saved);
    }
    if(action==='backups' && req.method==='GET'){
      const rows=await upstream(config,'/rest/v1/vault_backups?select=id,kind,backup_day,revision,created_at,source_saved_at,cutoff_at,timezone&order=created_at.desc&limit=150',{token:auth.token});
      return res.status(200).json({backups:rows||[]});
    }
    if(action==='backups' && req.method==='POST')return res.status(200).json(await rpc('vault_make_backup'));
    if(action==='backup' && req.method==='GET'){
      const id=String(req.query?.id||'');if(!uuid(id))throw fail(400,'Invalid backup identifier.');
      const rows=await upstream(config,'/rest/v1/vault_backups?id=eq.'+id+'&select=*&limit=1',{token:auth.token});
      if(!rows?.[0])throw fail(404,'Backup not found.');return res.status(200).json({backup:rows[0]});
    }
    if(action==='restore' && req.method==='POST'){
      if(!uuid(body.backupId)||!uuid(body.mutationId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)throw fail(400,'Invalid restore request.');
      return res.status(200).json(await rpc('vault_restore',{p_backup:body.backupId,p_expected:body.expectedRevision,p_mutation:body.mutationId}));
    }
    throw fail(405,'This action or method is not supported.');
  } catch(error) { return res.status(error.status||500).json({error:error.status?error.message:'The cloud service could not finish this request. Your local records are unchanged.'}); }
}
