
'use strict';
/* Assets v6. Local-first ledger with an optional authenticated cloud backend. */
(() => {
const STORAGE_KEY = 'vault.personal.assets.v1';
const VERSION = 2;
const CLOUD_META_KEY = 'vault.cloud.link.v1';
const cloud = {configured:false,signedIn:false,linked:false,user:null,owner:'',revision:0,dirty:false,generation:0,busy:false,applying:false,error:'',reconcile:null,remote:null,health:{},backups:[],backupsLoaded:false,lastSync:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',timer:null,pendingMutation:null,replaceNext:false,installPrompt:null};
const CATEGORY = {
  cash:{label:'Everyday cash / bank / wallet',short:'Cash & bank',icon:'wallet',color:'#D7E1EC'},
  forex:{label:'Forex account',short:'Forex',icon:'chart',color:'#5DD62C'},
  crypto:{label:'Crypto holding',short:'Crypto',icon:'coin',color:'#FFFFFF'},
  stocks:{label:'Stocks / ETFs',short:'Stocks',icon:'chart',color:'#AFC0D1'},
  property:{label:'Property / physical asset',short:'Property',icon:'grid',color:'#849AB0'},
  other:{label:'Other investment',short:'Other',icon:'folder',color:'#5C6C7E'},
  prop:{label:'Prop / demo account',short:'Prop / demo',icon:'shield',color:'#718293'}
};
const KIND = {
  income:{label:'Money in',icon:'download',sign:1}, expense:{label:'Money out',icon:'upload',sign:-1},
  loan_received:{label:'Loan received',icon:'download',sign:1}, loan_advanced:{label:'Money lent',icon:'upload',sign:-1},
  loan_paid:{label:'Loan repayment paid',icon:'upload',sign:-1}, loan_collected:{label:'Loan repayment received',icon:'download',sign:1},
  profit:{label:'Profit',icon:'arrow-up',sign:1}, loss:{label:'Loss',icon:'arrow-down',sign:-1},
  deposit:{label:'Deposit',icon:'download',sign:1}, withdrawal:{label:'Withdrawal',icon:'upload',sign:-1},
  transfer_in:{label:'Transfer in',icon:'transfer',sign:1},transfer_out:{label:'Transfer out',icon:'transfer',sign:-1},
  valuation:{label:'Value update',icon:'edit',sign:1},basis:{label:'Capital update',icon:'edit',sign:1}
};
const $ = (selector,root=document) => root.querySelector(selector);
const $$ = (selector,root=document) => Array.from(root.querySelectorAll(selector));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const uid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateObj = str => new Date(str+'T12:00:00');
const shiftDate = (n,base=new Date()) => {const d=new Date(base);d.setDate(d.getDate()+n);return localDate(d);};
const round = n => Math.round((n+Number.EPSILON)*1e8)/1e8;
const dateLabel = (date,options={month:'short',day:'numeric'}) => dateObj(date).toLocaleDateString('en-US',options);
const today = () => localDate();
let storageOk = true, corruptRaw = '', persistenceBlocked = false, modalDraft = null, pendingExternal = null;
let ui = {page:['overview','cash','loans','tracker','activity','settings','backup','quick','cloud'].includes(location.hash.slice(1))?location.hash.slice(1):'overview',assetFilter:'all',assetQuery:'',period:'30D',openMenu:null,trackerAccount:'',trackerDate:'',month:new Date(new Date().getFullYear(),new Date().getMonth(),1),activityAccount:'',activityKind:'all',activityQuery:'',activityPage:1,cashMonth:today().slice(0,7),cashAccount:'',loanFilter:'all',loanQuery:'',chartPoints:[]};
function blankState() {return {version:VERSION,demo:false,profile:{name:'My workspace',subtitle:'Personal portfolio',photo:'',badge:true},settings:{displayCurrency:'USDT',hideBalances:false,rates:{USDT:1,USD:1},lastBackup:null},assets:[],entries:[],loans:[],loanPayments:[],snapshots:[{date:today(),value:0}],updatedAt:new Date().toISOString()};}
function sampleState() {
  const s=blankState();s.demo=true;
  const rows=[
    ['demo_cash','Binance','cash','Everyday wallet',5000,5000,'',null,null],
    ['demo_ic','IC Markets','forex','Trading account',5500,6420,'IC',null,null],
    ['demo_ex','Exness','forex','Trading account',2500,2365,'EX',null,null],
    ['demo_btc','Bitcoin','crypto','Binance',7500,8750,'BTC',.125,70000],
    ['demo_eth','Ethereum','crypto','Binance',4500,4875,'ETH',1.5,3250],
    ['demo_savings','Local bank','cash','Daily essentials',3000,3000,'SV',null,null]
  ];
  s.assets=rows.map(r=>({id:r[0],name:r[1],category:r[2],platform:r[3],currency:'USDT',openingCapital:r[4],openingValue:r[5],symbol:r[6],units:r[7],unitPrice:r[8],logo:'',notes:'Illustrative sample data. Replace with your own values.',included:true,createdAt:new Date().toISOString(),startDate:shiftDate(-60)}));
  const logs=[[-11,'demo_ic','profit',140,'London session'],[-10,'demo_ex','profit',75,'Gold scalp'],[-9,'demo_ic','loss',95,'Risk limit respected'],[-7,'demo_ex','profit',160,'XAUUSD trade'],[-6,'demo_ic','profit',225,'Trend continuation'],[-5,'demo_ex','loss',110,'Stopped out'],[-4,'demo_ic','profit',200,'New York session'],[-3,'demo_ic','loss',80,'Closed early'],[-2,'demo_ex','profit',100,'Gold intraday'],[-1,'demo_ic','profit',120,'Session closed'],[0,'demo_ic','profit',180,'Gold - London session'],[0,'demo_ex','loss',235,'Daily trading result']];
  s.entries=logs.map((r,i)=>({id:'demo_entry_'+i,assetId:r[1],kind:r[2],amount:r[3],note:r[4],date:shiftDate(r[0]),createdAt:new Date(Date.now()-(12-i)*60000).toISOString(),fx:1,groupId:''}));
  for(const a of s.assets) a.openingValue=round(a.openingValue-s.entries.filter(e=>e.assetId===a.id).reduce((t,e)=>t+effect(e).value,0));
  const curve=[27320,27620,27550,27900,27690,27640,27880,27810,28280,28110,28260,28710,28660,28560,28860,28950,28820,28790,29300,29220,29590,29460,29490,29790,30000,29940,29780,30170,30220,30440];
  s.loans=[{id:'demo_borrowed',direction:'borrowed',title:'Personal loan',person:'Example lender',currency:'USDT',principal:2000,openingOutstanding:1200,startDate:shiftDate(-50),dueDate:shiftDate(7),notes:'Illustrative existing loan. No cash movement is recorded.',openingEntryId:'',createdAt:new Date().toISOString()},{id:'demo_lent',direction:'lent',title:'Money lent',person:'Example friend',currency:'USDT',principal:600,openingOutstanding:400,startDate:shiftDate(-25),dueDate:shiftDate(12),notes:'Illustrative money owed to you.',openingEntryId:'',createdAt:new Date().toISOString()}];
  s.snapshots=curve.map((v,i)=>({date:shiftDate(i-29),value:v}));
  return s;
}
function effect(e) {
  if(e.kind==='basis') return {value:0,capital:e.amount};
  if(e.kind==='valuation') return {value:e.amount,capital:0};
  const value=KIND[e.kind].sign*e.amount;
  return {value,capital:['deposit','withdrawal','transfer_in','transfer_out'].includes(e.kind)?value:0};
}
function validDate(d){if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const x=dateObj(d);return Number.isFinite(x.getTime())&&localDate(x)===d;}
function validNumber(x,min=-1e13,max=1e13){return typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;}
function safeImage(x){return typeof x==='string'&&x.length<750000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x)?x:'';}
function validateState(input) {
  if(!input||![1,2].includes(input.version)||!Array.isArray(input.assets)||!Array.isArray(input.entries)||!Array.isArray(input.snapshots)||!input.settings||!input.profile) throw Error('This is not a supported Assets backup (version 1 or 2).');
  if(input.assets.length>500||input.entries.length>20000||input.snapshots.length>10000) throw Error('This backup is too large for this local dashboard.');
  const out=blankState(), rates=input.settings.rates, validId=x=>typeof x==='string'&&/^[-_A-Za-z0-9]{1,80}$/.test(x), text=(x,n)=>String(x||'').slice(0,n);
  if(!rates||typeof rates!=='object'||Array.isArray(rates))throw Error('The backup has no valid currency rates.');
  out.settings.rates={USDT:1};
  for(const [c,r] of Object.entries(rates)){if(!/^[A-Z][A-Z0-9]{1,9}$/.test(c)||!validNumber(r,1e-12,1e12))throw Error('Invalid currency conversion in backup.');if(c!=='USDT')out.settings.rates[c]=r;}
  out.settings.displayCurrency=Object.hasOwn(out.settings.rates,input.settings.displayCurrency)?input.settings.displayCurrency:'USDT';
  out.settings.hideBalances=Boolean(input.settings.hideBalances);out.settings.lastBackup=typeof input.settings.lastBackup==='string'?input.settings.lastBackup.slice(0,40):null;
  out.settings.dailyEmailEnabled=Boolean(input.settings.dailyEmailEnabled);out.settings.dailyEmailAddress=typeof input.settings.dailyEmailAddress==='string'?input.settings.dailyEmailAddress.trim().slice(0,254):'';
  out.profile={name:text(input.profile.name||'My portfolio',40),subtitle:text(input.profile.subtitle||'Personal portfolio',80),photo:safeImage(input.profile.photo),badge:Boolean(input.profile.badge),workspaceLabel:text(input.profile.workspaceLabel||'PRIVATE WORKSPACE',32),showDate:input.profile.showDate!==false,showWorkspaceLabel:input.profile.showWorkspaceLabel!==false};
  out.demo=Boolean(input.demo);out.updatedAt=text(input.updatedAt||new Date().toISOString(),40);
  const ids=new Set(),entryIds=new Set(),loanIds=new Set(),paymentIds=new Set();
  for(const a of input.assets){
    if(!a||!validId(a.id)||ids.has(a.id)||!Object.hasOwn(CATEGORY,a.category)||!Object.hasOwn(out.settings.rates,a.currency)||!validNumber(a.openingCapital,0)||!validNumber(a.openingValue,0))throw Error('An asset has invalid or duplicate data.');
    ids.add(a.id);out.assets.push({id:a.id,name:text(a.name||'Unnamed asset',60),category:a.category,platform:text(a.platform,60),currency:a.currency,openingCapital:a.openingCapital,openingValue:a.openingValue,logo:safeImage(a.logo),symbol:text(a.symbol,15),units:validNumber(a.units,0)?a.units:null,unitPrice:validNumber(a.unitPrice,0)?a.unitPrice:null,notes:text(a.notes,600),included:a.included!==false,createdAt:text(a.createdAt||new Date().toISOString(),40),startDate:validDate(a.startDate)?a.startDate:today()});
  }
  for(const e of input.entries){
    if(!e||!validId(e.id)||entryIds.has(e.id)||!ids.has(e.assetId)||!Object.hasOwn(KIND,e.kind)||!validDate(e.date)||!validNumber(e.amount,['valuation','basis'].includes(e.kind)?-1e13:0)||!validNumber(e.fx,1e-12,1e12))throw Error('A ledger entry is invalid or refers to a missing account.');
    if(e.loanId&&!validId(e.loanId)||e.paymentId&&!validId(e.paymentId))throw Error('A linked loan entry has an invalid reference.');
    entryIds.add(e.id);out.entries.push({id:e.id,assetId:e.assetId,kind:e.kind,amount:e.amount,note:text(e.note,300),date:e.date,createdAt:text(e.createdAt||e.date+'T12:00:00Z',40),fx:e.fx,groupId:e.kind.startsWith('transfer_')&&validId(e.groupId)?e.groupId:'',cashCategory:text(e.cashCategory,60),counterparty:text(e.counterparty,80),loanId:e.loanId||'',paymentId:e.paymentId||''});
  }
  const groups=new Map();
  for(const e of out.entries)if(e.kind.startsWith('transfer_')){if(!e.groupId)throw Error('A transfer is missing its linked entry.');if(!groups.has(e.groupId))groups.set(e.groupId,[]);groups.get(e.groupId).push(e);}
  for(const g of groups.values())if(g.length!==2||new Set(g.map(e=>e.kind)).size!==2||g[0].assetId===g[1].assetId)throw Error('An internal transfer is incomplete.');
  const loans=input.version===1?[]:input.loans, payments=input.version===1?[]:input.loanPayments;
  if(!Array.isArray(loans)||!Array.isArray(payments)||loans.length>1000||payments.length>10000)throw Error('Loan records are missing or too large.');
  for(const l of loans){
    if(!l||!validId(l.id)||loanIds.has(l.id)||!['borrowed','lent'].includes(l.direction)||!Object.hasOwn(out.settings.rates,l.currency)||!validNumber(l.principal,1e-8)||!validNumber(l.openingOutstanding,0,l.principal)||!validDate(l.startDate)||(l.dueDate&&!validDate(l.dueDate)))throw Error('A loan has invalid or duplicate data.');
    if(l.openingEntryId&&!validId(l.openingEntryId))throw Error('Invalid linked loan entry.');
    loanIds.add(l.id);out.loans.push({id:l.id,direction:l.direction,title:text(l.title||'Loan',60),person:text(l.person||'Contact',80),currency:l.currency,principal:l.principal,openingOutstanding:l.openingOutstanding,startDate:l.startDate,dueDate:l.dueDate||'',notes:text(l.notes,600),openingEntryId:l.openingEntryId||'',createdAt:text(l.createdAt||new Date().toISOString(),40)});
  }
  for(const p of payments){
    if(!p||!validId(p.id)||paymentIds.has(p.id)||!loanIds.has(p.loanId)||!validDate(p.date)||!validNumber(p.principal,0)||!validNumber(p.interest,0)||(p.principal+p.interest)<1e-8||!validNumber(p.fx,1e-12,1e12)||(p.entryId&&!entryIds.has(p.entryId))||(p.accountId&&!ids.has(p.accountId))||(p.previousDueDate&&!validDate(p.previousDueDate))||(p.nextDueDate&&!validDate(p.nextDueDate)))throw Error('A loan repayment has invalid or missing data.');
    paymentIds.add(p.id);out.loanPayments.push({id:p.id,loanId:p.loanId,date:p.date,principal:p.principal,interest:p.interest,fx:p.fx,accountId:p.accountId||'',entryId:p.entryId||'',note:text(p.note,300),previousDueDate:p.previousDueDate||'',nextDueDate:p.nextDueDate||'',createdAt:text(p.createdAt||new Date().toISOString(),40)});
  }
  for(const l of out.loans){
    const paid=out.loanPayments.filter(p=>p.loanId===l.id).reduce((s,p)=>s+p.principal,0);
    if(paid>l.openingOutstanding+1e-7)throw Error('Repayments exceed a loan\'s recorded principal.');
    if(l.openingEntryId){const e=out.entries.find(x=>x.id===l.openingEntryId);if(!e||e.loanId!==l.id||e.paymentId||e.kind!==(l.direction==='borrowed'?'loan_received':'loan_advanced'))throw Error('A loan cash movement is incomplete.');}
  }
  for(const p of out.loanPayments){
    if(Boolean(p.entryId)!==Boolean(p.accountId))throw Error('A loan repayment is missing its linked cash account.');
    if(p.entryId){const e=out.entries.find(x=>x.id===p.entryId),l=out.loans.find(x=>x.id===p.loanId);if(e.assetId!==p.accountId||e.loanId!==l.id||e.paymentId!==p.id||e.kind!==(l.direction==='borrowed'?'loan_paid':'loan_collected'))throw Error('A repayment cash movement is incomplete.');}
  }
  for(const e of out.entries){
    if(e.kind.startsWith('loan_')){const l=out.loans.find(x=>x.id===e.loanId),a=out.assets.find(x=>x.id===e.assetId);if(!l||a.category!=='cash')throw Error('A loan movement must refer to an existing cash account and loan.');if(e.paymentId){if(!out.loanPayments.some(p=>p.id===e.paymentId&&p.entryId===e.id))throw Error('Orphaned repayment entry.');}else if(l.openingEntryId!==e.id)throw Error('Orphaned loan disbursement.');}
    else if(e.loanId||e.paymentId)throw Error('An unrelated entry has a loan reference.');
  }
  const snapMap=new Map();for(const p of input.snapshots){if(!p||!validDate(p.date)||!validNumber(p.value))throw Error('Invalid value-history data.');snapMap.set(p.date,{date:p.date,value:p.value});}out.snapshots=[...snapMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  for(const a of out.assets){const value=a.openingValue+out.entries.filter(e=>e.assetId===a.id).reduce((s,e)=>s+effect(e).value,0);if(!validNumber(round(value),-1e-7))throw Error('An account has a negative or invalid balance.');}
  return out;
}
let state;
try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){try{state=validateState(JSON.parse(raw));}catch(err){corruptRaw=raw;persistenceBlocked=true;storageOk=false;state=blankState();}}else{state=sampleState();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}}
catch(err){state=state||sampleState();storageOk=false;}
function rate(c){return state.settings.rates[c]||1;}
function assetById(id){return state.assets.find(a=>a.id===id);}
function entriesFor(id){return state.entries.filter(e=>e.assetId===id);}
function metrics(a) {
  let value=a.openingValue,net=a.openingCapital,gross=a.openingCapital,opening=a.openingCapital,external=a.openingCapital;
  for(const e of state.entries){if(e.assetId!==a.id)continue;const d=effect(e);value+=d.value;net+=d.capital;if(['deposit','transfer_in','basis'].includes(e.kind))gross+=d.capital;if(['deposit','basis'].includes(e.kind))external+=d.capital;if(e.kind==='basis')opening+=e.amount;}
  const pnl=a.category==='cash'?0:round(value-net);
  return {value:round(value),net:round(net),gross:round(gross),opening:round(opening),external:round(external),pnl,roi:a.category!=='cash'&&gross>1e-8?pnl/gross*100:null,usdt:round(value*rate(a.currency))};
}
function totals(){
  let value=0,net=0,gross=0,external=0,pnl=0,cash=0,investments=0;
  const included=state.assets.filter(a=>a.included);
  for(const a of included){const m=metrics(a),r=rate(a.currency);value+=m.usdt;if(a.category==='cash'){cash+=m.usdt;continue;}investments+=m.usdt;net+=m.net*r;gross+=m.gross*r;external+=m.external*r;pnl+=m.pnl*r;}
  let owedToYou=0,youOwe=0;
  for(const l of state.loans){const v=loanRemaining(l)*rate(l.currency);if(l.direction==='lent')owedToYou+=v;else youOwe+=v;}
  return {value:round(value),net:round(net),gross:round(gross),external:round(external),pnl:round(pnl),roi:gross>1e-8?pnl/gross*100:null,count:included.length,cash:round(cash),investments:round(investments),owedToYou:round(owedToYou),youOwe:round(youOwe),netWorth:round(value+owedToYou-youOwe)};
}
function currencySymbol(c){return ({USDT:'$',USD:'$',EUR:'\u20ac',GBP:'\u00a3',INR:'\u20b9',JPY:'\u00a5'})[c]||c+' ';}
function numeric(n,digits=2){return new Intl.NumberFormat('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);}
function moneyNative(n,c,opts={}){if(state.settings.hideBalances&&!opts.reveal)return '\u2022\u2022\u2022\u2022';const sign=n<0?'-':opts.signed&&n>0?'+':'';return sign+currencySymbol(c)+numeric(Math.abs(n),opts.digits??2);}
function money(n,opts={}){const c=opts.currency||state.settings.displayCurrency;return moneyNative(n/rate(c),c,opts);}
function shortMoney(n,c=state.settings.displayCurrency){if(state.settings.hideBalances)return '\u2022\u2022\u2022';const v=n/rate(c),av=Math.abs(v),scale=av>=1e9?1e9:av>=1e6?1e6:av>=1e3?1e3:1,suffix=scale===1e9?'B':scale===1e6?'M':scale===1e3?'K':'';return(v<0?'-':'')+currencySymbol(c)+numeric(av/scale,scale===1?0:1)+suffix;}
function pct(n,{signed=true}={}){if(state.settings.hideBalances)return '\u2022\u2022';if(n===null||!Number.isFinite(n))return '\u2014';return(n>0&&signed?'+':'')+numeric(n,2)+'%';}
function tone(n){return n>0.000001?'positive':n<-.000001?'negative':'neutral';}
function avatar(size=''){return `<span class="avatar ${size}">${state.profile.photo?`<img src="${state.profile.photo}" alt="Profile photo">`:esc(state.profile.name.trim().slice(0,1).toUpperCase()||'N')}</span>`;}
function badge(){return `<span class="badge" title="Personal profile badge - not external identity verification" aria-label="Personal profile badge"><img src="tickmark.png" alt="" width="25" height="25"></span>`;}
function assetLogo(a,small=false){const cls=['cash','forex','crypto'].includes(a.category)?a.category:'other';let content=icon(CATEGORY[a.category].icon);if(a.logo)content=`<img src="${a.logo}" alt="${esc(a.name)} logo">`;else if(a.symbol==='BTC')content='\u20bf';else if(a.symbol==='ETH')content='<svg viewBox="0 0 24 32" width="15" height="23" aria-hidden="true"><path d="m12 0 11 18-11 6L1 18Z" fill="#d6d6d6"/><path d="m12 0 11 18-11-5Z" fill="#9a9a9a"/><path d="m1 20 11 12 11-12-11 6Z" fill="#a8a8a8"/></svg>';else if(a.symbol)content=esc(a.symbol.slice(0,2));return `<span class="asset-logo ${cls} ${small?'small':''}">${content}</span>`;}
function totalSnapshot(){const item={date:today(),value:totals().value};const i=state.snapshots.findIndex(p=>p.date===item.date);if(i>=0)state.snapshots[i]=item;else state.snapshots.push(item);state.snapshots.sort((a,b)=>a.date.localeCompare(b.date));}
function persist(){state.updatedAt=new Date().toISOString();if(persistenceBlocked){storageOk=false;return false;}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageOk=true;cloudLocalChanged();return true;}catch(err){storageOk=false;return false;}}
function toast(message,error=false){const t=document.createElement('div');t.className='toast'+(error?' error':'');t.innerHTML=icon(error?'info':'check')+`<span>${esc(message)}</span>`;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),error?8500:4500);}
function commit(message,{snapshot=true}={}){if(snapshot)totalSnapshot();const saved=persist();render();if(message)toast(message+(saved?'':' Changes are not saved in this browser. Export a backup now.'),!saved);}
function saveHeader(){const el=$('#save-status');el.classList.toggle('error',!storageOk);el.innerHTML=`<span></span> ${storageOk?'Saved on this device':'Not saved - export a backup'}`;el.title=storageOk?'Local copy saved in this browser. Check Cloud sync for server status, and keep an independent JSON backup.':'Browser storage is blocked, full, or unreadable. Your latest changes exist only in this tab.';}
function optionsCurrencies(selected){return Object.keys(state.settings.rates).map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('');}
function render(){
  const pages={overview:'Overview',cash:'Everyday money',loans:'Loans',tracker:'Daily tracker',activity:'Activity log',settings:'Settings',backup:'Backups',quick:'Quick Update',cloud:'Cloud & daily backups'};
  $('#breadcrumb-current').textContent=pages[ui.page];saveHeader();
  $('#display-currency').innerHTML=optionsCurrencies(state.settings.displayCurrency);
  $('#sidebar-profile').innerHTML=`${avatar('small')}<span><strong>${esc(state.profile.name)}</strong><small>Personal account</small></span>${icon('chevron')}`;
  $$('.nav-item[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===ui.page);el.setAttribute('aria-current',el.dataset.page===ui.page?'page':'false');});
  const main=$('#main');main.innerHTML=(ui.page==='overview'?overview():ui.page==='cash'?cashPage():ui.page==='loans'?loansPage():ui.page==='tracker'?trackerPage():ui.page==='activity'?activityPage():ui.page==='backup'?backupPage():ui.page==='quick'?quickPage():ui.page==='cloud'?cloudPage():settingsPage());
  if(ui.page==='overview')drawPortfolioChart();
  bindSearchInputs();enhanceUI(main);updateMobileNav();paintCloudStatus();
}
function setPage(page){
  if(!['overview','cash','loans','tracker','activity','settings','backup','quick','cloud'].includes(page))return;
  if($('#modal').open)closeModal();
  ui.page=page;ui.openMenu=null;location.hash=page;closeNav();render();window.scrollTo({top:0,behavior:'instant'});
}
function demoBanner(){return state.demo?`<div class="demo-banner"><div>${icon('info')}<span><strong>Demo workspace.</strong> Sample balances, not your real assets.</span></div><button data-action="start-fresh">Start fresh ${icon('arrow-right')}</button></div>${ui.page==='overview'?`<div class="backup-entry-banner"><div>${icon('folder')}<div><strong>Already have a workspace?</strong><p>Restore your backup to continue where you left off.</p></div></div><button class="btn btn-secondary btn-small" data-action="import">${icon('upload')}Restore backup</button></div>`:''}`:'';}
function overview(){
  const t=totals(),curr=state.settings.displayCurrency,daily=dayPnl(today());
  return `${demoBanner()}${!storageOk?`<div class="inline-note warning" style="margin-bottom:18px">${icon('info')}<span>${persistenceBlocked?'Saved data could not be read and has not been overwritten. Open Settings to export a recovery copy.':'Browser saving is unavailable. Export your data before closing this tab.'}</span></div>`:''}
  <section class="profile-header"><button class="profile-identity profile-identity-button" data-action="profile" aria-label="Customize profile">${avatar()}<div><div class="profile-name">${esc(state.profile.name)} ${state.profile.badge?badge():''}</div><div class="profile-subtitle"><span>${esc(state.profile.subtitle)}</span>${state.profile.showWorkspaceLabel?`<span class="private-tag">${esc(state.profile.workspaceLabel||'PRIVATE WORKSPACE')}</span>`:''}</div><span class="profile-edit-hint">${icon('edit')}Tap profile to customize</span></div></button><div class="profile-actions">${state.profile.showDate?`<span class="date-label">${icon('calendar')}${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>`:''}</div></section>
  <section class="hero" aria-label="Estimated total asset value"><div class="hero-info"><div class="hero-label">Estimated total value <button class="icon-button" data-action="toggle-balances" aria-label="${state.settings.hideBalances?'Show':'Hide'} balances">${icon(state.settings.hideBalances?'eye-off':'eye')}</button></div><div class="hero-total"><span class="number">${money(t.value,{currency:'USDT'})}</span><span class="unit">USDT</span></div><div class="hero-sub"><span>Cash + investments. Loan balances shown separately below.</span></div>${curr!=='USDT'?`<div class="hero-sub">&asymp; ${money(t.value)} ${esc(curr)}</div>`:''}<div class="hero-metrics"><div><div class="metric-label">Investment P&amp;L</div><div class="metric-value ${tone(t.pnl)}">${money(t.pnl,{signed:true,currency:'USDT'})}</div></div><div><div class="metric-label">Today's trading P&amp;L</div><div class="metric-value ${tone(daily)}">${money(daily,{signed:true,currency:'USDT'})}</div></div><div><div class="metric-label">Tracked accounts</div><div class="metric-value">${t.count}<span style="font-size:9px;color:var(--faint);margin-left:5px">included</span></div></div></div></div><div class="hero-chart"><div class="chart-topline"><span>Total asset value / USDT</span><div class="period-selector" aria-label="Value history period">${['7D','30D','90D','ALL'].map(p=>`<button data-action="period" data-period="${p}" class="${ui.period===p?'active':''}">${p}</button>`).join('')}</div></div><div class="line-chart-wrap" id="portfolio-chart"></div><div class="chart-foot"><span>${state.demo?'Illustrative sample history':'Saved asset valuations; loan balances excluded'}</span><span>Updated ${dateLabel(today())}</span></div></div></section>
  <section class="wealth-strip wealth-overview" aria-label="Cash and loan balances"><article class="wealth-item net"><div class="wealth-kicker"><span>Net worth</span><span class="wealth-badge">TOTAL</span></div><strong>${money(t.netWorth,{currency:'USDT'})}<small>USDT</small></strong><p>Assets + money owed to you &minus; loans you owe</p></article><article class="wealth-item"><div class="wealth-kicker"><span>Everyday cash</span>${icon('wallet')}</div><strong>${money(t.cash)}</strong><button class="wealth-link" data-page="cash">Cash &amp; bank accounts ${icon('arrow-right')}</button></article><article class="wealth-item"><div class="wealth-kicker"><span>Owed to you</span>${icon('arrow-down')}</div><strong>${money(t.owedToYou)}</strong><button class="wealth-link" data-action="loans-filter" data-filter="lent">Money you lent ${icon('arrow-right')}</button></article><article class="wealth-item"><div class="wealth-kicker"><span>You owe</span>${icon('arrow-up')}</div><strong>${money(t.youOwe)}</strong><button class="wealth-link" data-action="loans-filter" data-filter="borrowed">Loans to repay ${icon('arrow-right')}</button></article></section>
  <section aria-labelledby="assets-heading"><div class="section-heading"><div><div class="section-title"><h2 id="assets-heading">Your accounts &amp; assets</h2><span class="section-count">${state.assets.length}</span></div><p class="section-caption">Everyday money stays separate from investment returns.</p></div><div class="section-actions"><button class="btn btn-secondary" data-action="entry">${icon('plus')}<span class="hide-mobile">Log </span>P&amp;L</button><button class="btn btn-primary" data-action="add-asset">${icon('plus')}Add account</button></div></div><div class="asset-toolbar"><div class="tabs" aria-label="Asset category">${[['all','All accounts'],['cash','Cash & bank'],['forex','Forex'],['crypto','Crypto'],['other','Other']].map(([v,l])=>`<button class="tab ${ui.assetFilter===v?'active':''}" data-action="asset-filter" data-filter="${v}">${l}</button>`).join('')}</div><label class="search-field">${icon('search')}<input id="asset-search" type="search" placeholder="Search accounts..." value="${esc(ui.assetQuery)}" aria-label="Search accounts"></label></div><div class="asset-grid" id="asset-grid">${assetCards()}</div></section>
  <section class="analytics-grid" aria-label="Investment performance and allocation"><div class="panel"><div class="panel-heading"><div><h3>Investment performance</h3><p>Cash, everyday spending and loans are excluded</p></div><button class="icon-button" data-action="returns-help" aria-label="How investment returns are calculated">${icon('info')}</button></div>${returnsChart()}</div><div class="panel"><div class="panel-heading"><div><h3>Asset allocation</h3><p>Cash and investments, before loan balances</p></div><span class="small-tag">BY VALUE</span></div>${allocationChart()}</div></section>
  ${loanOverview()}
  <section class="panel daily-panel" aria-label="Recent daily profit and loss"><div class="panel-heading"><div><div class="panel-title-line"><h3>Daily profit tracker</h3><span class="small-tag">${dateLabel(today())}</span></div><p>Investment results only. No everyday spending counted as losses.</p></div><div class="section-actions"><div class="daily-summary">Today <strong class="${tone(daily)}">${money(daily,{signed:true})}</strong></div><button class="btn btn-secondary btn-small" data-action="entry">${icon('plus')}Add result</button></div></div>${ledgerTable(pnlEntries().sort(sortEntries).slice(0,4),{compact:true})}<div class="table-footer"><span>Deposits, transfers and loan payments are not trading profit.</span><button class="text-link" data-page="tracker">View tracker ${icon('arrow-right')}</button></div></section>`;
}
function assetCards(){
  let items=state.assets.filter(a=>(ui.page!=='cash'||a.category==='cash'&&(!ui.cashAccount||a.id===ui.cashAccount))&&(ui.page==='cash'||ui.assetFilter==='all'||(ui.assetFilter==='other'?!['cash','forex','crypto'].includes(a.category):a.category===ui.assetFilter))&&(!ui.assetQuery||(a.name+' '+a.platform+' '+a.symbol).toLowerCase().includes(ui.assetQuery.toLowerCase())));
  items=[...items].sort((a,b)=>(a.category==='cash'?-1:0)-(b.category==='cash'?-1:0));
  if(!items.length&&state.assets.length)return `<div class="empty-state">${icon('search')}<h3>No matching accounts</h3><p>Try a different name or category.</p><button class="btn btn-secondary btn-small" data-action="add-asset">${icon('plus')}Add account</button></div>`;
  return items.map(a=>assetCard(a)).join('')+(!items.length?`<button class="empty-card" data-action="add-asset"><span>${icon('wallet')}</span><strong>Add your cash or bank account</strong><small>One available balance. No investment fields.</small></button><button class="empty-card" data-action="add-asset" data-category="forex"><span>${icon('plus')}</span><strong>Add an investment account</strong><small>Forex, crypto, stocks &amp; more</small></button>`:'');
}
function returnsChart(){const all=state.assets.filter(a=>a.included&&a.category!=='cash').map(a=>({a,m:metrics(a)})).sort((x,y)=>(y.m.roi??-Infinity)-(x.m.roi??-Infinity));if(!all.length)return `<div class="range-empty">Add an investment to compare its return.<br>Cash accounts are not shown in this chart.</div>`;let maxPos=Math.max(5,...all.map(x=>x.m.roi??0)),maxNeg=Math.max(5,...all.map(x=>-(x.m.roi??0)));const unitScale=Math.max(maxPos/60,maxNeg/40);maxPos=unitScale*60;maxNeg=unitScale*40;return `<div class="return-list">${all.map(({a,m})=>{let width=m.roi===null?0:m.roi>=0?Math.min(60,m.roi/maxPos*60):Math.min(40,-m.roi/maxNeg*40);return `<div class="return-row"><div class="return-identity" title="${esc(a.name)}">${assetLogo(a,true)}<span>${esc(a.name)}</span></div><div class="return-track" role="img" aria-label="${esc(a.name)} return ${esc(pct(m.roi))}"><span class="return-bar ${m.roi<0?'loss':''}" style="left:${m.roi<0?40-width:40}%;width:${width}%"></span></div><span class="return-val ${tone(m.pnl)}">${pct(m.roi)}</span></div>`;}).join('')}</div><div class="return-axis"><span></span><div><span>${pct(-maxNeg,{signed:false})}</span><span class="zero">0%</span><span>${pct(maxPos)}</span></div><span></span></div>`;}
function allocationChart(){const groups=new Map();for(const a of state.assets.filter(a=>a.included)){const v=Math.max(0,metrics(a).usdt);groups.set(a.category,(groups.get(a.category)||0)+v);}const data=[...groups].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]),total=data.reduce((s,[,v])=>s+v,0),r=61,circ=2*Math.PI*r;let offset=0;const circles=data.map(([cat,v])=>{const pct=v/total,len=Math.max(0,pct*circ-(data.length>1?4:0)),svg=`<circle cx="78.5" cy="78.5" r="${r}" fill="none" stroke="${CATEGORY[cat].color}" stroke-width="17" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}"/>`;offset+=pct*circ;return svg;}).join('');const cash=state.assets.filter(a=>a.included&&a.category==='cash').reduce((t,a)=>t+metrics(a).usdt,0);return `<div class="allocation-body"><div class="donut-wrap"><svg viewBox="0 0 157 157" role="img" aria-label="Asset allocation by category"><circle cx="78.5" cy="78.5" r="61" fill="none" stroke="#262626" stroke-width="17"/>${circles}</svg><div class="donut-center"><strong>${state.assets.filter(a=>a.included).length}</strong><span>ASSETS TRACKED</span></div></div><div class="allocation-legend">${data.length?data.map(([cat,v])=>`<div class="legend-row"><span class="legend-dot" style="background:${CATEGORY[cat].color}"></span><span class="legend-name">${CATEGORY[cat].short}</span><strong>${state.settings.hideBalances?'\u2022\u2022':numeric(v/total*100,1)+'%'}</strong></div>`).join(''):'<span class="field-help">Your allocation appears when you add an asset.</span>'}</div></div><div class="allocation-foot"><span>Available cash & bank balance</span><strong>${money(cash)}</strong></div>`;}
function drawPortfolioChart(){const host=$('#portfolio-chart');if(!host)return;const minDate=ui.period==='ALL'?'0000-00-00':shiftDate(-(Number.parseInt(ui.period)-1));let data=state.snapshots.filter(p=>p.date>=minDate&&p.date<=today());if(!data.length){host.innerHTML='<div class="range-empty">No snapshots in this period yet.</div>';return;}
  const W=550,H=167,L=3,R=46,T=12,B=26,iw=W-L-R,ih=H-T-B;const vals=data.map(p=>p.value),rawmin=Math.min(...vals),rawmax=Math.max(...vals),padding=Math.max((rawmax-rawmin)*.18,rawmax*.012,1),min=Math.max(0,rawmin-padding),max=rawmax+padding,span=Math.max(max-min,1);const sx=i=>L+(data.length===1?iw*.8:i/(data.length-1)*iw),sy=v=>T+ih-(v-min)/span*ih;const points=data.map((p,i)=>({x:sx(i),y:sy(p.value),...p}));ui.chartPoints=points;let path=data.length===1?`M ${L} ${sy(vals[0])} L ${L+iw} ${sy(vals[0])}`:points.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');const area=path+` L ${data.length===1?L+iw:points.at(-1).x} ${T+ih} L ${L} ${T+ih} Z`,last=points.at(-1);
  const grid=[0,.5,1].map(v=>{const y=T+v*ih;return `<line x1="${L}" y1="${y}" x2="${L+iw}" y2="${y}" stroke="#373737" stroke-width=".7" stroke-dasharray="3 5" opacity=".65"/><text x="${W-1}" y="${y+3}" text-anchor="end" fill="#737373" font-size="8" font-family="sans-serif">${esc(shortMoney(max-v*span,'USDT'))}</text>`;}).join('');let labels=[];if(data.length===1)labels=[`<text x="${L+iw/2}" y="${H-3}" fill="#797979" font-size="8" text-anchor="middle">${dateLabel(data[0].date)} - history builds over time</text>`];else {const indexes=[...new Set([0,Math.floor((data.length-1)/3),Math.floor(2*(data.length-1)/3),data.length-1])];labels=indexes.map(i=>`<text x="${sx(i)}" y="${H-3}" fill="#757575" font-size="8" text-anchor="${i===0?'start':i===data.length-1?'end':'middle'}">${dateLabel(data[i].date)}</text>`);}
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Portfolio valuation history in USDT. ${data.length} saved daily snapshots."><defs><linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5DD62C" stop-opacity=".28"/><stop offset="100%" stop-color="#5DD62C" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#portfolio-fill)"/><path d="${path}" fill="none" stroke="#5DD62C" stroke-width="2.3" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last.x}" cy="${last.y}" r="5" fill="#5DD62C" opacity=".2"/><circle cx="${last.x}" cy="${last.y}" r="2.6" fill="#5DD62C"/>${labels.join('')}<line id="chart-hover-line" x1="0" y1="${T}" x2="0" y2="${T+ih}" stroke="#949494" stroke-width=".7" stroke-dasharray="3 3" visibility="hidden"/></svg><div class="chart-tooltip" id="chart-tooltip"></div>`;
  host.onpointermove=evt=>{const rect=host.getBoundingClientRect(),x=(evt.clientX-rect.left)/rect.width*W;let near=points.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,points[0]);const line=$('#chart-hover-line');line.setAttribute('x1',near.x);line.setAttribute('x2',near.x);line.setAttribute('visibility','visible');const tip=$('#chart-tooltip');tip.innerHTML=`<small>${dateLabel(near.date,{month:'short',day:'numeric',year:'numeric'})}</small>${esc(money(near.value,{currency:'USDT'}))} USDT`;tip.style.display='block';tip.style.left=Math.min(rect.width-70,Math.max(70,near.x/W*rect.width))+'px';tip.style.top=Math.max(34,near.y/H*rect.height)+'px';};host.onpointerleave=()=>{$('#chart-tooltip').style.display='none';$('#chart-hover-line').setAttribute('visibility','hidden');};
}
function sortEntries(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt);}
function pnlEntries(account=''){return state.entries.filter(e=>['profit','loss'].includes(e.kind)&&assetById(e.assetId)?.category!=='cash'&&(account?e.assetId===account:assetById(e.assetId)?.included));}
function pnlValue(e){return effect(e).value*e.fx;}
function dayPnl(date,account=''){return pnlEntries(account).filter(e=>e.date===date).reduce((s,e)=>s+pnlValue(e),0);}
function ledgerTable(entries,{compact=false,emptyMessage='No entries yet. Add a transaction or an investment result to start tracking.'}={}){if(!entries.length)return `<div class="empty-state">${icon('chart')}<h3>No activity yet</h3><p>${esc(emptyMessage)}</p><button class="btn btn-secondary btn-small" data-action="entry">${icon('plus')}Add an entry</button></div>`;return `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Account / asset</th><th>Type</th><th style="text-align:right">Amount <span style="font-size:7px">(${esc(state.settings.displayCurrency)})</span></th><th>Note</th><th><span class="screen-reader-only">Actions</span></th></tr></thead><tbody>${entries.map(e=>{const a=assetById(e.assetId);if(!a)return '';const amount=(e.kind==='basis'?e.amount:effect(e).value)*e.fx;const gain=['profit','loss'].includes(e.kind)&&a.category!=='cash';return `<tr><td class="no-wrap">${dateLabel(e.date)}<span style="display:block;color:#626262;font-size:8px;margin-top:4px">${e.date.slice(0,4)}</span></td><td><div class="table-account">${assetLogo(a,true)}<span><strong>${esc(a.name)}</strong><small>${a.included?esc(CATEGORY[a.category].short):'Excluded from net worth'}${a.currency!==state.settings.displayCurrency?' / '+esc(a.currency):''}</small></span></div></td><td><span class="type-pill ${e.kind==='loss'?'loss':gain?'':'neutral'}">${esc(entryLabel(e))}</span></td><td class="amount-cell ${gain||e.kind==='valuation'?tone(amount):''}" style="text-align:right" title="${esc(moneyNative(e.kind==='basis'?e.amount:effect(e).value,a.currency))} ${esc(a.currency)}; conversion saved when entered">${money(amount,{signed:true})}</td><td class="note-cell" title="${esc(e.note)}">${esc([e.cashCategory,e.counterparty,e.note].filter(Boolean).join(' / ')||'\u2014')}</td><td><button class="icon-button" data-action="delete-entry" data-id="${e.id}" aria-label="Delete ${esc(entryLabel(e))} on ${dateLabel(e.date)}">${icon('trash')}</button></td></tr>`;}).join('')}</tbody></table></div>`;}
function accountOptions(selected,includeAll=true,exclude=''){return (includeAll?'<option value="">Included accounts</option>':'')+state.assets.filter(a=>a.id!==exclude).map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)}${a.included?'':' (excluded)'} - ${esc(a.currency)}</option>`).join('');}
function trackerPage(){const monthPrefix=`${ui.month.getFullYear()}-${String(ui.month.getMonth()+1).padStart(2,'0')}`,entries=pnlEntries(ui.trackerAccount),thisMonth=entries.filter(e=>e.date.startsWith(monthPrefix)),todayNet=entries.filter(e=>e.date===today()).reduce((s,e)=>s+pnlValue(e),0),monthNet=thisMonth.reduce((s,e)=>s+pnlValue(e),0);let dayMap=new Map();for(const e of thisMonth)dayMap.set(e.date,(dayMap.get(e.date)||0)+pnlValue(e));const wins=[...dayMap.values()].filter(v=>v>0).length,losses=[...dayMap.values()].filter(v=>v<0).length,best=dayMap.size?Math.max(...dayMap.values()):0;const filtered=entries.filter(e=>!ui.trackerDate||e.date===ui.trackerDate).sort(sortEntries);
return `${demoBanner()}<div class="page-heading"><div><h1>Daily profit tracker</h1><p>Small entries. A clearer picture of your progress.</p></div><button class="btn btn-primary" data-action="entry" ${ui.trackerAccount?`data-id="${ui.trackerAccount}"`:''}>${icon('plus')}Add entry</button></div><div class="filter-row"><select class="input" id="tracker-account" aria-label="Filter daily tracker by account">${investmentOptions(ui.trackerAccount)}</select><span class="field-help">${ui.trackerAccount&&!assetById(ui.trackerAccount)?.included?'This account is tracked but excluded from net worth.':'Investments only. Everyday spending, loans and transfers are excluded.'}</span></div><div class="stat-grid"><div class="stat-card"><span>Today's net P&amp;L</span><strong class="${tone(todayNet)}">${money(todayNet,{signed:true})}</strong><small>${dateLabel(today(),{month:'long',day:'numeric'})}</small></div><div class="stat-card"><span>Selected month</span><strong class="${tone(monthNet)}">${money(monthNet,{signed:true})}</strong><small>${ui.month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</small></div><div class="stat-card"><span>Profitable days</span><strong>${wins}<span style="font-size:13px;color:#797979"> / ${dayMap.size}</span></strong><small>${losses} losing ${losses===1?'day':'days'} in this month</small></div><div class="stat-card"><span>Best day this month</span><strong class="${tone(best)}">${money(best,{signed:true})}</strong><small>${dayMap.size?'Based on your logged entries':'No results recorded yet'}</small></div></div><div class="tracker-grid"><section class="panel"><div class="panel-heading"><div><h3>P&amp;L calendar</h3><p>Click a day to see its entries</p></div><div class="calendar-controls"><button class="icon-button previous" data-action="month" data-delta="-1" aria-label="Previous month">${icon('chevron')}</button><span class="calendar-title">${ui.month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span><button class="icon-button" data-action="month" data-delta="1" aria-label="Next month">${icon('chevron')}</button></div></div>${calendarMarkup(dayMap)}<div class="calendar-key"><span><i></i>Profit</span><span><i class="loss"></i>Loss</span><span>Recorded days only</span></div></section><section class="panel monthly-insight"><div class="insight-label">Your monthly result</div><div class="insight-total ${tone(monthNet)}">${money(monthNet,{signed:true})}</div><div class="insight-sub">${thisMonth.length} ${thisMonth.length===1?'entry':'entries'} across ${dayMap.size} ${dayMap.size===1?'day':'days'}.<br>Keep the record. See the bigger picture.</div><div class="insight-rows"><div class="insight-row"><span>Gross profit</span><strong class="positive">${money(thisMonth.filter(e=>e.kind==='profit').reduce((s,e)=>s+pnlValue(e),0),{signed:true})}</strong></div><div class="insight-row"><span>Gross loss</span><strong class="negative">${money(thisMonth.filter(e=>e.kind==='loss').reduce((s,e)=>s+pnlValue(e),0),{signed:true})}</strong></div><div class="insight-row"><span>Profitable-day rate</span><strong>${dayMap.size?pct(wins/dayMap.size*100,{signed:false}):'\u2014'}</strong></div><div class="insight-row"><span>Average recorded day</span><strong>${money(dayMap.size?monthNet/dayMap.size:0,{signed:true})}</strong></div></div></section></div><section class="panel daily-panel"><div class="panel-heading"><div><h3>${ui.trackerDate?'Entries for '+dateLabel(ui.trackerDate):'Your P&L entries'}</h3><p>${ui.trackerDate?'One day at a time.':'Most recent first. All recorded dates.'}</p></div><div class="section-actions">${ui.trackerDate?'<button class="btn btn-secondary btn-small" data-action="clear-day">Clear date filter</button>':''}<button class="btn btn-secondary btn-small" data-action="export-csv">${icon('download')}Export CSV</button></div></div>${ledgerTable(filtered.slice(0,100))}${filtered.length>100?'<div class="table-footer"><span>Showing the latest 100. Use a day filter or export the full ledger.</span></div>':''}</section>`;
}
function calendarMarkup(dayMap){const y=ui.month.getFullYear(),m=ui.month.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();let cells=Array.from({length:offset},()=>'<span class="calendar-day empty"></span>').join('');for(let d=1;d<=days;d++){const date=localDate(new Date(y,m,d)),v=dayMap.get(date);cells+=`<button class="calendar-day ${date===today()?'today':''} ${date===ui.trackerDate?'selected':''} ${v>0?'profit':v<0?'loss':''}" data-action="calendar-day" data-date="${date}" aria-label="${dateLabel(date,{month:'long',day:'numeric',year:'numeric'})}${v!==undefined?', '+money(v,{signed:true}):', no entries'}"><span>${d}</span>${v!==undefined?`<strong class="${tone(v)}">${shortMoney(v)}</strong>`:''}</button>`;}return `<div class="calendar-grid">${['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('')}${cells}</div>`;}
function activityFiltered(){return state.entries.filter(e=>{
  const a=assetById(e.assetId),kind=ui.activityKind;
  const match=kind==='all'||kind==='pnl'&&a?.category!=='cash'&&['profit','loss'].includes(e.kind)||kind==='capital'&&['income','expense','deposit','withdrawal','transfer_in','transfer_out'].includes(e.kind)||kind==='loans'&&e.kind.startsWith('loan_')||kind==='updates'&&['valuation','basis'].includes(e.kind);
  return (!ui.activityAccount||e.assetId===ui.activityAccount)&&match&&(!ui.activityQuery||(e.note+' '+a?.name+' '+entryLabel(e)+' '+(e.cashCategory||'')+' '+(e.counterparty||'')).toLowerCase().includes(ui.activityQuery.toLowerCase()));
}).sort(sortEntries);}
function activityContents(){const rows=activityFiltered(),per=15,pages=Math.max(1,Math.ceil(rows.length/per));ui.activityPage=Math.min(pages,ui.activityPage);return ledgerTable(rows.slice((ui.activityPage-1)*per,ui.activityPage*per),{emptyMessage:'Your money in, spending, transfers, loan movements and investment results will appear here.'})+`<div class="table-footer"><span>${rows.length} ledger ${rows.length===1?'entry':'entries'}</span><div class="pagination"><button class="btn btn-ghost btn-small" data-action="activity-page" data-delta="-1" ${ui.activityPage===1?'disabled':''}>Previous</button><span>${ui.activityPage} / ${pages}</span><button class="btn btn-ghost btn-small" data-action="activity-page" data-delta="1" ${ui.activityPage===pages?'disabled':''}>Next</button></div></div>`;}
function activityPage(){return `${demoBanner()}<div class="page-heading"><div><h1>Activity log</h1><p>A complete record of changes to your accounts.</p></div><div class="section-actions"><button class="btn btn-secondary" data-action="export-csv">${icon('download')}Export CSV</button><button class="btn btn-primary" data-action="entry">${icon('plus')}Add entry</button></div></div><section class="panel"><div class="filter-row"><select class="input" id="activity-account" aria-label="Filter activity by account"><option value="">All accounts</option>${accountOptions(ui.activityAccount,false)}</select><select class="input" id="activity-kind" aria-label="Filter activity by type">${[['all','All activity'],['pnl','Profits & losses'],['capital','Cash movements'],['loans','Loan movements'],['updates','Value / capital updates']].map(([k,v])=>`<option value="${k}" ${k===ui.activityKind?'selected':''}>${v}</option>`).join('')}</select><label class="search-field">${icon('search')}<input type="search" id="activity-search" placeholder="Search notes or accounts..." value="${esc(ui.activityQuery)}" aria-label="Search activity"></label></div><div id="activity-content">${activityContents()}</div></section><div class="inline-note" style="margin:18px 0 25px">${icon('info')}<span>Deleting an entry reverses its effect on the balance and capital. A transfer's two linked entries are always removed together. Entry amounts use the exchange rate saved when they were recorded.</span></div>`;}
function settingsPage(){return `<div class="page-heading"><div><h1>Your workspace, your way.</h1><p>Profile, currencies and a safe copy of your records.</p></div></div><div class="settings-grid"><div class="settings-stack"><section class="panel settings-panel"><h3>Profile &amp; appearance</h3><p>Make this personal. Your profile is saved here and included when you connect cloud sync.</p><div class="settings-profile">${avatar('large')}<div><strong>${esc(state.profile.name)}${state.profile.badge?badge():''}</strong><p>${esc(state.profile.subtitle)}</p><button class="btn btn-secondary btn-small" data-action="profile">${icon('edit')}Edit profile</button></div></div><div class="toggle-row"><div><strong>Show profile badge</strong><p>A personal display badge only. It does not represent identity or financial verification.</p></div><label class="toggle"><input id="setting-badge" type="checkbox" ${state.profile.badge?'checked':''} aria-label="Show profile badge"><span class="toggle-track"></span></label></div><div class="toggle-row"><div><strong>Hide balances</strong><p>Conceal amounts on the dashboard. Forms and backups still contain your real values.</p></div><label class="toggle"><input id="setting-hide" type="checkbox" ${state.settings.hideBalances?'checked':''} aria-label="Hide balances"><span class="toggle-track"></span></label></div><div class="field" style="border-top:1px solid #303030;padding-top:18px"><label for="setting-display">Display currency</label><select id="setting-display" class="input">${optionsCurrencies(state.settings.displayCurrency)}</select><p class="field-help">Cards and reports use this currency. Your headline total always remains in USDT.</p></div></section><section class="panel settings-panel" id="backup-section"><h3>Backup &amp; restore</h3><p>Keep a complete copy of your workspace and continue on another device.</p><div class="inline-note">${icon('shield')}<span>JSON backups include your accounts, loans, repayments, photos and settings. Keep these unencrypted files private.</span></div><div class="settings-actions"><button class="btn btn-primary" data-action="open-backup">${icon('folder')}Open backup center</button><button class="btn btn-secondary" data-action="import">${icon('upload')}Restore backup</button></div><p class="field-help" style="margin-top:17px">Last backup prepared: ${state.settings.lastBackup?esc(formatStamp(state.settings.lastBackup)):'Not yet'}</p></section></div><div class="settings-stack"><section class="panel settings-panel"><h3>Currency conversions</h3><p>Set how much <strong>1 unit</strong> of a currency is worth in USDT. These rates are manual, not live.</p><form id="rates-form"><div class="rate-row"><div><strong>USDT</strong><small>Base currency</small></div><input class="input" value="1" disabled aria-label="USDT base exchange rate"><span></span></div>${Object.entries(state.settings.rates).filter(([c])=>c!=='USDT').map(([c,r])=>`<div class="rate-row"><div><strong>${esc(c)}</strong><small>1 ${esc(c)} = ${esc(r)} USDT</small></div><input class="input" type="number" min="0.000000000001" max="1000000000000" step="any" required value="${r}" data-rate="${esc(c)}" aria-label="USDT value of one ${esc(c)}"><button type="button" class="icon-button" data-action="delete-currency" data-currency="${esc(c)}" aria-label="Remove ${esc(c)}">${icon('trash')}</button></div>`).join('')}<div class="settings-actions"><button class="btn btn-primary btn-small" type="submit">${icon('check')}Save rates</button><button class="btn btn-secondary btn-small" type="button" data-action="add-currency">${icon('plus')}Add currency</button></div></form><p class="field-help" style="margin-top:16px">The initial USD rate assumes 1 USD = 1 USDT for convenience. It is not a live quote or a guaranteed peg. Replace it with your chosen valuation rate.</p></section><section class="panel settings-panel"><h3>How your totals work</h3><div class="about-copy"><p><strong>Total value</strong> is the current value of every included asset, converted into USDT.</p><p><strong>Investment profit / loss</strong> is investment value minus net contributions. Cash accounts, everyday income, spending and loan movements are excluded.</p><p><strong>Net worth</strong> = included cash and investments + outstanding money owed to you - outstanding loans you owe. Loans use recorded principal, not expected interest or a guarantee of recovery.</p><p><strong>Cash accounts</strong> show available money, not investment return. The money-in/out report excludes transfers, balance corrections and loan movements.</p><p><strong>Percentage return</strong> is gain divided by contributed capital. It is a simple accounting return, not a time-weighted or tax calculation.</p><p><strong>Prop and demo balances</strong> are excluded by default. They are not automatically your personal assets. Track real, received payouts separately.</p><p><strong>Charts</strong> use saved valuations and manually logged results. No market data, exchange connection or background price updating is included.</p></div></section><section class="panel settings-panel"><h3>Workspace data</h3><p>${state.assets.length} assets &middot; ${state.entries.length} ledger entries &middot; ${state.loans.length} loans &middot; ${state.snapshots.length} valuation snapshots</p><div class="settings-actions"><button class="btn btn-secondary btn-small" data-action="load-demo">Load sample data</button><button class="btn btn-danger btn-small" data-action="start-fresh">${icon('trash')}Clear workspace</button></div></section></div></div>`;}
function bindSearchInputs(){const l=$('#loan-search');if(l)l.addEventListener('input',e=>{ui.loanQuery=e.target.value;$('#loan-list').innerHTML=loanCards();});const s=$('#asset-search');if(s)s.addEventListener('input',e=>{ui.assetQuery=e.target.value;ui.openMenu=null;$('#asset-grid').innerHTML=assetCards();});const a=$('#activity-search');if(a)a.addEventListener('input',e=>{ui.activityQuery=e.target.value;ui.activityPage=1;$('#activity-content').innerHTML=activityContents();});}
function modalHeader(title,description=''){return `<div class="modal-header"><div><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>`;}
function showModal(html,narrow=false){
  closeDatePicker(false);
  const dialog=$('#modal');dialog.classList.toggle('narrow',narrow);
  $('#modal-content').innerHTML=html;dialog.classList.toggle('form-modal',Boolean($('#modal-content form')));
  enhanceUI($('#modal-content'));document.body.classList.add('modal-open');
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}
function closeModal(){closeDatePicker(false);const d=$('#modal');if(d.open)d.close();modalDraft=null;if(!$('#date-picker')?.open)document.body.classList.remove('modal-open');}
function formError(message){const box=$('#form-error');if(box){box.textContent=message;box.scrollIntoView({block:'nearest'});}else toast(message,true);}
function confirmAction(title,body,button,fn,danger=true){modalDraft={type:'confirm',run:fn};showModal(`${modalHeader(title)}<div class="modal-body"><div class="about-copy" style="margin-top:-6px">${body}</div></div><div class="modal-footer"><button class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-action="confirm">${button}</button></div>`,true);}
function openAsset(id='',category='cash'){
  const a=assetById(id);if(id&&!a)return;const m=a?metrics(a):null;
  modalDraft={type:'asset',id:id||'',logo:a?.logo||'',includedTouched:false};ui.openMenu=null;
  const curr=a?.currency||'USDT',cat=a?.category||(CATEGORY[category]?category:'cash'),locked=Boolean(a&&entriesFor(id).length);
  showModal(`${modalHeader(a?'Edit your asset':'Add an asset',a?'Update the details or value. Existing daily entries stay in your history.':'Keep everyday money separate from investment performance.')}<form id="asset-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="form-grid"><div class="upload-row full"><span id="asset-logo-preview">${assetLogo(a||{category:cat,name:'New asset',symbol:'',logo:''})}</span><div><strong>Brand / account logo</strong><p>Optional. JPG, PNG or WebP. Automatically resized.</p><div class="upload-actions"><input type="file" class="image-input" id="asset-logo-file" accept="image/png,image/jpeg,image/webp" aria-label="Upload brand logo"><button type="button" class="text-link" data-action="remove-logo">Remove</button></div></div></div><div class="field"><label for="asset-name">Asset / account name <span class="field-label-hint">Required</span></label><input class="input" id="asset-name" name="name" maxlength="60" required placeholder="e.g. My cash, IC Markets, Bitcoin" value="${esc(a?.name||'')}"></div><div class="field"><label for="asset-category">Asset type</label><select class="input" id="asset-category" name="category">${Object.entries(CATEGORY).map(([k,v])=>`<option value="${k}" ${k===cat?'selected':''}>${v.label}</option>`).join('')}</select></div><div class="field"><label for="asset-platform">Brand / broker / platform <span class="field-label-hint">Optional</span></label><input class="input" id="asset-platform" name="platform" maxlength="60" placeholder="e.g. Binance, Exness, Savings" value="${esc(a?.platform||'')}"></div><div class="field"><label for="asset-currency">Account currency</label><select class="input" id="asset-currency" name="currency" ${locked?'disabled':''}>${optionsCurrencies(curr)}${!locked?'<option value="__custom__">+ Add another currency</option>':''}</select><p class="field-help">${locked?'Currency is locked after the first ledger entry.':'Your balance is converted into USDT using your saved rate.'}</p></div><div class="full hidden" id="custom-currency-fields"><div class="form-grid"><div class="field"><label for="custom-code">Currency code</label><input class="input" id="custom-code" name="customCode" placeholder="e.g. EUR, AED, INR" maxlength="10" pattern="[A-Za-z][A-Za-z0-9]{1,9}"></div><div class="field"><label for="custom-rate">1 unit is worth how many USDT?</label><input class="input" id="custom-rate" name="customRate" type="number" min="0.000000000001" max="1000000000000" step="any" placeholder="Enter your conversion rate"></div></div><p class="field-help" style="margin-top:9px">Use your own rate. No current or suggested exchange rate is supplied.</p></div><div class="form-divider"></div><div class="form-section-label"><span id="asset-money-heading">YOUR BALANCE</span></div><div class="field" id="investment-field"><label for="asset-investment">${a?'Opening investment':'Actual / initial investment'} <span class="field-label-hint form-currency">${esc(curr)}</span></label><input class="input" id="asset-investment" name="investment" type="number" min="0" max="10000000000000" step="any" required placeholder="0.00" value="${a?m.opening:''}"><p class="field-help">${a?'Opening capital only. Deposits already logged are added separately.':'How much of your money you put into this asset. Do not use this field for everyday money.'}</p></div><div class="field" id="current-balance-field"><label for="asset-current"><span id="asset-current-label">Current value / balance</span> <span class="field-label-hint form-currency">${esc(curr)}</span></label><input class="input" id="asset-current" name="current" type="number" min="0" max="10000000000000" step="any" required placeholder="0.00" value="${a?m.value:''}"><p class="field-help" id="asset-balance-help">What it is worth, or how much is left, right now.</p></div><div class="full inline-note" id="asset-mode-note">${icon('info')}<span>New profit / loss entries will be <strong>added to this balance</strong>. Do not enter a result again if it is already included in your current value.</span></div><details class="full quantity-details" ${cat==='crypto'?'open':''}><summary>Optional: quantity &amp; unit price <span>For crypto, shares or physical assets</span></summary><div class="form-grid" style="margin-top:17px"><div class="field"><label for="asset-symbol">Symbol / short label</label><input class="input" id="asset-symbol" name="symbol" maxlength="15" placeholder="e.g. BTC, ETH, XAU" value="${esc(a?.symbol||'')}"></div><div class="field"><label for="asset-units">Quantity</label><input class="input" id="asset-units" name="units" type="number" min="0" max="10000000000000" step="any" placeholder="e.g. 0.125" value="${a?.units??''}"></div><div class="field"><label for="asset-unit-price">Current price per unit <span class="field-label-hint form-currency">${esc(curr)}</span></label><input class="input" id="asset-unit-price" name="unitPrice" type="number" min="0" max="10000000000000" step="any" placeholder="Enter a price" value="${a?.unitPrice??''}"></div><div class="field" style="justify-content:flex-end"><button type="button" class="btn btn-secondary" data-action="calculate-value">Use quantity &times; price</button></div><p class="field-help full">Calculation aid only. This button fills the current value above; it does not connect to a market feed or continuously recalculate your balance.</p></div></details><div class="field full"><label for="asset-notes">Notes <span class="field-label-hint">Optional</span></label><textarea class="input" id="asset-notes" name="notes" maxlength="600" placeholder="Account label, strategy, target or anything useful...">${esc(a?.notes||'')}</textarea></div><div class="full"><label class="checkbox-line"><input type="checkbox" id="asset-included" name="included" ${a?a.included?'checked':'':cat!=='prop'?'checked':''}><span>Include this asset in my total net worth</span></label><p class="field-help" style="margin:7px 0 0 23px">Keep prop / demo balances excluded unless the value really represents your own money.</p></div></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check')}${a?'Save changes':'Add asset'}</button></div></form>`);
  syncAssetMode();
}
function readAssetForm(){
  const f=$('#asset-form');if(!f)return null;
  const data=new FormData(f),old=modalDraft.id?assetById(modalDraft.id):null,category=String(data.get('category')),current=Number(data.get('current'));
  const opening=category==='cash'?(old?metrics(old).opening:current):Number(data.get('investment'));
  return {name:String(data.get('name')||'').trim(),category,platform:String(data.get('platform')||'').trim(),currency:old&&entriesFor(old.id).length?old.currency:String(data.get('currency')),opening,current,symbol:String(data.get('symbol')||'').trim().toUpperCase(),units:data.get('units')===''?null:Number(data.get('units')),unitPrice:data.get('unitPrice')===''?null:Number(data.get('unitPrice')),notes:String(data.get('notes')||'').trim(),included:$('#asset-included').checked,customCode:String(data.get('customCode')||'').trim().toUpperCase(),customRate:Number(data.get('customRate'))};
}
function saveAsset(){if(modalDraft?.type!=='asset')return;const d=readAssetForm();if(!d||!d.name)return formError('Give this asset a name.');if(!Object.hasOwn(CATEGORY,d.category))return formError('Select a valid asset type.');if(!validNumber(d.opening,0)||!validNumber(d.current,0))return formError('Enter a valid, non-negative current balance and investment amount.');if((d.units!==null&&!validNumber(d.units,0))||(d.unitPrice!==null&&!validNumber(d.unitPrice,0)))return formError('Quantity and unit price must be non-negative numbers.');
  let newRate=null;if(d.currency==='__custom__'){if(!/^[A-Z][A-Z0-9]{1,9}$/.test(d.customCode))return formError('Enter a currency code such as EUR or AED.');if(!validNumber(d.customRate,1e-12,1e12))return formError('Enter a positive USDT conversion rate.');if(d.customCode==='USDT'&&d.customRate!==1)return formError('USDT is the base currency and its rate must stay 1.');if(Object.hasOwn(state.settings.rates,d.customCode)&&Math.abs(state.settings.rates[d.customCode]-d.customRate)>1e-12)return formError('This currency already exists with a different rate. Choose it in the menu, or change its rate in Settings.');d.currency=d.customCode;newRate=d.customRate;}else if(!Object.hasOwn(state.settings.rates,d.currency))return formError('Select a valid currency.');
  const a=modalDraft.id?assetById(modalDraft.id):null,logo=modalDraft.logo;if(a&&a.category==='cash'&&d.category!=='cash'&&state.entries.some(e=>e.assetId===a.id&&e.loanId))return formError('This cash account is linked to a loan. Keep its everyday-account type.');if(newRate!==null)state.settings.rates[d.currency]=newRate;
  const fields={name:d.name,category:d.category,platform:d.platform,currency:d.currency,symbol:d.symbol,units:d.units,unitPrice:d.unitPrice,notes:d.notes,included:d.included,logo};
  if(a){const m=metrics(a),hasEntries=entriesFor(a.id).length;if(a.currency!==d.currency&&!hasEntries){Object.assign(a,fields,{openingCapital:d.opening,openingValue:d.current});}else{Object.assign(a,fields);const valueDelta=round(d.current-m.value),basisDelta=round(d.opening-m.opening);if(Math.abs(valueDelta)>.00000001)appendEntry(a,'valuation',valueDelta,today(),d.category==='cash'?'Manual balance correction (not profit or spending)':'Manual current-value update');if(Math.abs(basisDelta)>.00000001)appendEntry(a,'basis',basisDelta,today(),'Opening investment corrected');}}
  else{state.assets.push({id:uid(),...fields,openingCapital:d.opening,openingValue:d.current,createdAt:new Date().toISOString(),startDate:today()});}
  closeModal();commit(a?'Asset updated.':'Asset added to your workspace.');
}
function appendEntry(asset,kind,amount,date,note='',groupId=''){const e={id:uid(),assetId:asset.id,kind,amount:round(amount),date,note,fx:rate(asset.currency),createdAt:new Date().toISOString(),groupId};state.entries.push(e);return e;}
function entryDraftFromForm(){const form=$('#entry-form');if(!form||modalDraft?.type!=='entry')return;modalDraft.assetId=$('#entry-account').value;modalDraft.destination=$('#entry-destination')?.value||modalDraft.destination||'';modalDraft.amount=$('#entry-amount').value;modalDraft.date=$('#entry-date').value;modalDraft.note=$('#entry-note').value;modalDraft.cashCategory=$('#entry-category')?.value||'';modalDraft.counterparty=$('#entry-counterparty')?.value||'';}
function openEntry(assetId='',kind='profit'){
  if(!state.assets.length){toast('Add your cash or investment account first.');openAsset('','cash');return;}
  const cashKind=['income','expense'].includes(kind);
  const selected=assetById(assetId)||(cashKind?state.assets.find(a=>a.category==='cash'):state.assets.find(a=>a.category==='forex')||state.assets.find(a=>a.category!=='cash'))||state.assets[0];
  if(!allowedEntryKinds(selected).includes(kind))kind=selected.category==='cash'?'income':'profit';
  modalDraft={type:'entry',kind,assetId:selected.id,destination:state.assets.find(a=>a.id!==selected.id)?.id||'',amount:'',date:ui.page==='tracker'?(ui.trackerDate||today()):today(),note:'',cashCategory:'',counterparty:''};
  renderEntryForm();
}
function renderEntryForm(){
  const d=modalDraft,a=assetById(d.assetId)||state.assets[0];d.assetId=a.id;const c=a.currency,transfer=d.kind==='transfer',cash=a.category==='cash';
  const defs=cash?[['income','Money in','download'],['expense','Money out','upload'],['transfer','Transfer','transfer']]:[['profit','Profit','arrow-up'],['loss','Loss','arrow-down'],['deposit','Deposit','download'],['withdrawal','Withdrawal','upload'],['transfer','Transfer','transfer']];
  const categories=cashCategories(d.kind);
  showModal(`${modalHeader(cash?'Move your everyday money':'Log an investment entry',cash?'Income, purchases, family support or transfers. None of these are trading P&L.':'Record a result or move capital. Your balance updates when you save.')}<form id="entry-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="field" style="margin-bottom:18px"><label for="entry-account">${transfer?'From account':'Account'}</label><select class="input" id="entry-account" name="account">${accountOptions(d.assetId,false)}</select></div><div class="entry-types ${cash?'cash-types':''}" aria-label="Entry type">${defs.map(([k,l,i])=>`<button type="button" class="entry-type ${k===d.kind?'active':''}" data-action="entry-kind" data-kind="${k}" ${k==='transfer'&&state.assets.length<2?'disabled title="Add a second account to transfer money"':''}>${icon(i)}${l}</button>`).join('')}</div><div class="form-grid">${transfer?`<div class="field full"><label for="entry-destination">To one of my own accounts</label><select class="input" id="entry-destination" name="destination">${accountOptions(d.destination,false,d.assetId)}</select><p class="field-help">Sending to family or a shop? Use Money out, not an internal transfer. Money to be repaid belongs in Loans.</p></div>`:''}<div class="field"><label for="entry-amount">Amount <span class="field-label-hint" id="entry-currency-label">${esc(c)}</span></label><input class="input" type="number" id="entry-amount" name="amount" min="0.00000001" max="10000000000000" step="any" required placeholder="e.g. 100.00" value="${esc(d.amount)}"></div><div class="field"><label for="entry-date">Date</label><input class="input" type="date" id="entry-date" name="date" required max="${today()}" value="${esc(d.date)}"></div>${cash&&!transfer?`<div class="field"><label for="entry-category">Category</label><select class="input" id="entry-category" name="cashCategory">${categories.map(x=>`<option ${d.cashCategory===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="entry-counterparty">${d.kind==='expense'?'Paid to / merchant':'Received from'} <span class="field-label-hint">Optional</span></label><input class="input" id="entry-counterparty" name="counterparty" maxlength="80" placeholder="e.g. Family, supermarket, client" value="${esc(d.counterparty)}"></div>`:''}<div class="field full"><label for="entry-note">Note <span class="field-label-hint">Optional</span></label><textarea class="input" id="entry-note" name="note" maxlength="300" placeholder="${cash?'What was this payment for?':'e.g. Gold trade, London session...'}">${esc(d.note)}</textarea></div></div><div id="entry-preview"></div><div class="inline-note" id="entry-explanation" style="margin-top:15px"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${icon('check')}Save ${transfer?'transfer':'entry'}</button></div></form>`);
  updateEntryPreview();
}
function updateEntryPreview(){
  if(modalDraft?.type!=='entry'||!$('#entry-form'))return;entryDraftFromForm();
  const d=modalDraft,a=assetById(d.assetId),m=metrics(a),amount=Number(d.amount)||0,negative=['expense','loss','withdrawal','transfer'].includes(d.kind),signed=negative?-amount:amount;
  $('#entry-currency-label').textContent=a.currency;
  const transfer=d.kind==='transfer',dest=transfer?assetById(d.destination):null,received=dest?round(amount*rate(a.currency)/rate(dest.currency)):0;
  let lines=`<div class="preview-line"><span>Current balance</span><strong>${moneyNative(m.value,a.currency,{reveal:true})} ${esc(a.currency)}</strong></div><div class="preview-line"><span>Balance after this entry</span><strong>${moneyNative(m.value+signed,a.currency,{reveal:true})} ${esc(a.currency)}</strong></div>`;
  if(dest)lines+=`<div class="preview-line"><span>${esc(dest.name)} receives</span><strong>${moneyNative(received,dest.currency,{reveal:true})} ${esc(dest.currency)}</strong></div>`;
  const totalDelta=(a.included?signed*rate(a.currency):0)+(dest?.included?received*rate(dest.currency):0);
  lines+=`<div class="preview-line"><span>Change to total assets</span><strong>${moneyNative(totalDelta,'USDT',{signed:true,reveal:true})} USDT</strong></div>`;
  $('#entry-preview').innerHTML=`<div class="entry-preview">${lines}</div>`;
  let explanation=transfer?'Only use this for your own tracked accounts. Both balances update together using your saved manual conversion rates. The transfer itself is not income, spending or trading profit.':a.category==='cash'?(d.kind==='expense'?'Shopping, bills, gifts and family support reduce available cash. They do not create an investment loss. Use Loans instead when someone must repay you.':'Salary, refunds, gifts or other new money increase available cash. They are not investment profit. Use Transfer for money from another account you track here.'):['deposit','withdrawal'].includes(d.kind)?'A capital movement, not trading profit. Use Transfer when the other side is another account already tracked here.':'Only log a trading result that is not already included in the saved current value.';
  if(transfer&&dest&&a.included!==dest.included)explanation+=' One account is excluded from totals, so your included total will change.';
  if(negative&&amount>m.value)explanation+=' The amount exceeds the available balance. It cannot be saved.';
  $('#entry-explanation').innerHTML=icon('info')+`<span>${esc(explanation)}</span>`;
}
function saveEntry(){
  if(modalDraft?.type!=='entry')return;entryDraftFromForm();const d=modalDraft,a=assetById(d.assetId),amount=round(Number(d.amount));
  if(!a)return formError('Select an existing account.');if(!allowedEntryKinds(a).includes(d.kind))return formError('This entry type does not apply to this account.');
  if(!validNumber(amount,1e-8))return formError('Enter an amount greater than zero.');if(!validDate(d.date)||d.date>today())return formError('Choose a valid date that is not in the future.');
  if(['expense','loss','withdrawal','transfer'].includes(d.kind)&&amount>metrics(a).value+1e-8)return formError('Not enough available money. Check the amount or correct the saved account balance first.');
  if(d.kind==='transfer'){
    const dest=assetById(d.destination);if(!dest||dest.id===a.id)return formError('Choose a different destination account.');
    const received=round(amount*rate(a.currency)/rate(dest.currency));if(!validNumber(received,1e-8)||!validNumber(metrics(dest).value+received,0))return formError('Check the amount and manual exchange rates.');
    const group=uid();appendEntry(a,'transfer_out',amount,d.date,d.note||'Transfer to '+dest.name,group);appendEntry(dest,'transfer_in',received,d.date,d.note||'Transfer from '+a.name,group);
  }else{
    if(!validNumber(metrics(a).value+KIND[d.kind].sign*amount,-1e-8))return formError('The resulting balance is invalid or too large.');
    const e=appendEntry(a,d.kind,amount,d.date,d.note);if(a.category==='cash'){e.cashCategory=d.cashCategory;e.counterparty=String(d.counterparty||'').trim().slice(0,80);}
  }
  const label=d.kind==='transfer'?'Transfer recorded. Both account balances updated.':`${KIND[d.kind].label} recorded. ${a.name}'s balance is updated.`;
  closeModal();commit(label);
}
function openProfile(){modalDraft={type:'profile',photo:state.profile.photo};showModal(`${modalHeader('Customize your profile','Your identity card across Assets. Changes sync with your workspace when cloud is connected.')}<form id="profile-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="profile-editor-card"><div id="profile-photo-preview">${avatar('large')}</div><div><strong>Profile photo</strong><p>Upload an image or take a new photo directly from your phone camera.</p><div class="profile-photo-actions"><label class="btn btn-secondary btn-small file-button">${icon('upload')}Choose photo<input class="visually-hidden-file" type="file" id="profile-photo-file" accept="image/png,image/jpeg,image/webp" aria-label="Choose profile photo"></label><label class="btn btn-secondary btn-small file-button">${icon('camera')}Take photo<input class="visually-hidden-file" type="file" id="profile-camera-file" accept="image/*" capture="user" aria-label="Take profile photo with camera"></label><button class="text-link" type="button" data-action="remove-photo">Remove</button></div></div></div><div class="form-grid profile-custom-grid"><div class="field"><label for="profile-name">Display name</label><input class="input" id="profile-name" name="name" maxlength="40" required value="${esc(state.profile.name)}" placeholder="Your name"></div><div class="field"><label for="profile-subtitle">Profile subtitle</label><input class="input" id="profile-subtitle" name="subtitle" maxlength="80" value="${esc(state.profile.subtitle)}" placeholder="Personal portfolio"></div><div class="field full"><label for="profile-workspace-label">Workspace label</label><input class="input" id="profile-workspace-label" maxlength="32" value="${esc(state.profile.workspaceLabel||'PRIVATE WORKSPACE')}" placeholder="PRIVATE WORKSPACE"></div><div class="full profile-option-grid"><label class="profile-option"><span><strong>Verified badge ${badge()}</strong><small>Show your personal gold badge beside your name.</small></span><input type="checkbox" id="profile-badge" ${state.profile.badge?'checked':''}></label><label class="profile-option"><span><strong>Workspace label</strong><small>Show the small label under your profile name.</small></span><input type="checkbox" id="profile-show-label" ${state.profile.showWorkspaceLabel!==false?'checked':''}></label><label class="profile-option"><span><strong>Dashboard date</strong><small>Show today's date beside your profile.</small></span><input type="checkbox" id="profile-show-date" ${state.profile.showDate!==false?'checked':''}></label></div></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check')}Save profile</button></div></form>`,true);}
async function resizeImage(file,size){if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP image.');if(file.size>8*1024*1024)throw Error('Choose an image smaller than 8 MB.');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('This image could not be read.'));r.readAsDataURL(file);});const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('This image could not be opened.'));img.src=src;});if(image.width*image.height>100000000)throw Error('This image is too large. Use a smaller image.');const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser could not prepare the image.');const edge=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-edge)/2,(image.height-edge)/2,edge,edge,0,0,size,size);return canvas.toDataURL('image/webp',.85);}
async function handleImageUpload(file,type){const draft=modalDraft;try{const image=await resizeImage(file,type==='profile'?256:128);if(modalDraft!==draft)return;if(type==='profile'){draft.photo=image;$('#profile-photo-preview').innerHTML=`<span class="avatar large"><img src="${image}" alt="New profile photo"></span>`;}else{draft.logo=image;$('#asset-logo-preview').innerHTML=`<span class="asset-logo"><img src="${image}" alt="New brand logo"></span>`;}}catch(err){formError(err.message);}}
function openCurrency(){modalDraft={type:'currency'};showModal(`${modalHeader('Add a currency','Define a manual conversion into your USDT base currency.')}<form id="currency-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="form-grid"><div class="field"><label for="currency-code">Currency code</label><input class="input" id="currency-code" name="code" maxlength="10" pattern="[A-Za-z][A-Za-z0-9]{1,9}" required placeholder="e.g. AED"></div><div class="field"><label for="currency-rate">1 unit = how many USDT?</label><input class="input" id="currency-rate" name="rate" type="number" min="0.000000000001" max="1000000000000" step="any" required placeholder="Your conversion rate"></div><div class="inline-note full">${icon('info')}<span>Enter your own valuation rate. No live conversion is fetched. Update this rate in Settings whenever you need to.</span></div></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('plus')}Add currency</button></div></form>`,true);}
function infoModal(title,body){modalDraft={type:'info'};showModal(`${modalHeader(title)}<div class="modal-body"><div class="about-copy">${body}</div></div><div class="modal-footer"><button class="btn btn-primary" data-action="close-modal">Got it</button></div>`,true);}
function startFresh(){confirmAction(state.demo?'Start with your own assets?':'Clear this workspace?',`<p>This removes <strong>${state.assets.length} assets, ${state.entries.length} entries, ${state.loans.length} loans, ${state.loanPayments.length} repayments and all value history</strong> from this browser. Your profile and currency settings will stay.</p><p>Export a backup first to keep a copy. This cannot be undone from inside the app.</p>`,state.demo?'Start fresh':'Clear workspace',()=>{const oldProfile=state.profile,oldSettings=state.settings;state=blankState();state.profile=oldProfile;state.settings={...oldSettings,lastBackup:null};persistenceBlocked=false;corruptRaw='';resetFilters();closeModal();commit('Workspace cleared. Start by adding your cash balance.');});}
function resetFilters(){ui.cashAccount='';ui.cashMonth=today().slice(0,7);ui.loanFilter='all';ui.loanQuery='';ui.assetFilter='all';ui.assetQuery='';ui.openMenu=null;ui.trackerAccount='';ui.trackerDate='';ui.activityAccount='';ui.activityKind='all';ui.activityQuery='';ui.activityPage=1;}
function deleteAsset(id){const a=assetById(id);if(!a)return;if(state.entries.some(e=>e.assetId===id&&e.loanId)){toast('This account has linked loan records. Reverse the linked loan payments or loan first, or keep this account for its history.',true);return;}const entries=entriesFor(id),groups=new Set(entries.filter(e=>e.groupId).map(e=>e.groupId)),related=state.entries.filter(e=>groups.has(e.groupId)&&e.assetId!==id);const wouldDelete=new Set([...entries,...related].map(e=>e.id));
  confirmAction('Delete '+esc(a.name)+'?',`<p>This deletes the asset and <strong>${entries.length} linked ledger ${entries.length===1?'entry':'entries'}</strong>.</p>${related.length?'<p>Linked transfers in other accounts will also be reversed so no half-transfers remain.</p>':''}<p>Your total net worth will be recalculated. Export a backup before deleting records you may need.</p>`,'Delete asset',()=>{for(const other of state.assets.filter(x=>x.id!==id)){const reverse=state.entries.filter(e=>e.assetId===other.id&&wouldDelete.has(e.id)).reduce((s,e)=>s+effect(e).value,0);if(metrics(other).value-reverse<-.00000001){closeModal();toast('A linked transfer cannot be reversed because '+other.name+' no longer has enough balance. Remove dependent withdrawals or losses first.',true);return;}}state.assets=state.assets.filter(x=>x.id!==id);state.entries=state.entries.filter(e=>!wouldDelete.has(e.id));resetFilters();closeModal();commit('Asset and linked entries deleted.');});
}
function deleteEntry(id){const e=state.entries.find(e=>e.id===id);if(!e)return;if(e.paymentId){reverseLoanPayment(e.paymentId);return;}if(e.loanId){deleteLoan(e.loanId);return;}const group=e.groupId?state.entries.filter(x=>x.groupId===e.groupId):[e],a=assetById(e.assetId);confirmAction(e.groupId?'Reverse this transfer?':'Delete this entry?',`<p>${e.groupId?'Both sides of this transfer will be reversed.':`The ${esc(KIND[e.kind].label.toLowerCase())} of <strong>${esc(moneyNative(e.amount,a.currency,{reveal:true}))} ${esc(a.currency)}</strong> for ${esc(a.name)} will be removed.`}</p><p>Account balances and investment totals are recalculated automatically.</p>`,'Delete & reverse',()=>{for(const asset of state.assets){const affected=group.filter(x=>x.assetId===asset.id);if(!affected.length)continue;const newBalance=metrics(asset).value-affected.reduce((s,x)=>s+effect(x).value,0);if(newBalance<-.00000001){closeModal();toast('Reversing this entry would make '+asset.name+' negative. Remove dependent withdrawals or losses first.',true);return;}}const ids=new Set(group.map(x=>x.id));state.entries=state.entries.filter(x=>!ids.has(x.id));closeModal();commit(e.groupId?'Transfer reversed. Both balances updated.':'Entry removed and balance restored.');});}
function downloadBlob(filename,text,mime='application/json'){const blob=new Blob([text],{type:mime+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function exportBackup(){
  try{
    const prepared=transferableState();
    downloadBlob(prepared.name,prepared.text);
    if(ui.page==='backup'||ui.page==='settings')render();else saveHeader();
    toast('Backup file prepared. Save it to Files or Downloads before leaving this device.'+(!storageOk?' Browser saving is unavailable, so keep this file.':''),!storageOk);
  }catch(err){toast(err.message,true);}
}
function csvCell(value){let str=String(value??'');if(/^[=+@\-\t\r]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';}
function exportCSV(){const headers=['Date','Account','Category','Included in net worth','Type','Currency','Amount (native)','Value change (native)','Capital change (native)','USDT rate at entry','Value change (USDT at entry)','Note','Entry ID','Transfer group','Everyday category','Person / merchant','Loan ID','Repayment ID'];const rows=[headers.map(csvCell).join(',')];for(const e of [...state.entries].sort(sortEntries)){const a=assetById(e.assetId),delta=effect(e);rows.push([e.date,a?.name||'',a?.category||'',a?.included?'Yes':'No',KIND[e.kind].label,a?.currency||'',e.amount,delta.value,delta.capital,e.fx,round(delta.value*e.fx),e.note,e.id,e.groupId,e.cashCategory||'',e.counterparty||'',e.loanId||'',e.paymentId||''].map((v,i)=>[6,7,8,9,10].includes(i)?String(v):csvCell(v)).join(','));}downloadBlob('assets-activity-'+today()+'.csv','\ufeff'+rows.join('\r\n'),'text/csv');toast('Activity CSV prepared.');}
async function importBackup(file){
  if(!file)return;
  if(file.size>12*1024*1024){toast('This backup is larger than 12 MB. Your current data is unchanged.',true);return;}
  const attempt=++importSequence;
  try{
    const raw=await file.text();if(attempt!==importSequence)return;
    const incoming=validateState(JSON.parse(raw.replace(/^\uFEFF/,'')));
    restorePreview(incoming,file.name,file.size);
  }catch(err){toast('Import stopped: '+err.message.slice(0,220)+' Your current data is unchanged.',true);}
}
function closeNav(){$('#sidebar').classList.remove('open');$('#sidebar-scrim').classList.remove('open');}
function handleAction(action,el){
  if(handleCloudQuickAction(action,el))return;
  if(handleUpgradeAction(action,el))return;
  if(handleMoneyAction(action,el))return;
  if(action==='open-nav'){$('#sidebar').classList.add('open');$('#sidebar-scrim').classList.add('open');return;}
  if(action==='close-nav'){closeNav();return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='confirm'){if(pendingExternal){closeModal();toast('The workspace changed in another tab. Review the updated data before trying again.',true);return;}const run=modalDraft?.run;if(run)run();return;}
  if(action==='profile'){openProfile();return;}
  if(action==='add-asset'){openAsset('',el.dataset.category||'cash');return;}
  if(action==='edit-asset'){openAsset(el.dataset.id);return;}
  if(action==='entry'){openEntry(el.dataset.id||'');return;}
  if(action==='asset-menu'){ui.openMenu=ui.openMenu===el.dataset.id?null:el.dataset.id;$('#asset-grid').innerHTML=assetCards();return;}
  if(action==='asset-filter'){ui.assetFilter=el.dataset.filter;ui.openMenu=null;render();return;}
  if(action==='period'){ui.period=el.dataset.period;$$('.period-selector button').forEach(b=>b.classList.toggle('active',b.dataset.period===ui.period));drawPortfolioChart();return;}
  if(action==='asset-history'){ui.activityAccount=el.dataset.id;ui.activityKind='all';ui.activityPage=1;setPage('activity');return;}
  if(action==='delete-asset'){deleteAsset(el.dataset.id);return;}
  if(action==='delete-entry'){deleteEntry(el.dataset.id);return;}
  if(action==='toggle-balances'){state.settings.hideBalances=!state.settings.hideBalances;commit('',{snapshot:false});return;}
  if(action==='start-fresh'){startFresh();return;}
  if(action==='load-demo'){confirmAction('Load sample data?','<p>This replaces your current assets and records with an illustrative demo. Your profile is kept.</p><p>Export a backup first to keep your existing data.</p>','Load sample data',()=>{const p=state.profile;state=sampleState();state.profile=p;resetFilters();persistenceBlocked=false;corruptRaw='';closeModal();commit('Sample workspace loaded. These are not your real balances.');});return;}
  if(action==='entry-kind'){entryDraftFromForm();modalDraft.kind=el.dataset.kind;if(modalDraft.kind==='transfer'&&modalDraft.destination===modalDraft.assetId)modalDraft.destination=state.assets.find(a=>a.id!==modalDraft.assetId)?.id||'';renderEntryForm();return;}
  if(action==='calculate-value'){const units=$('#asset-units'),price=$('#asset-unit-price');if(units.value===''||price.value==='')return formError('Enter a quantity and a unit price first.');const value=Number(units.value)*Number(price.value);if(!validNumber(value,0))return formError('The calculated value is too large or invalid.');$('#asset-current').value=round(value);$('#form-error').textContent='';toast('Current value filled from quantity x price.');return;}
  if(action==='remove-logo'){if(modalDraft?.type==='asset'){modalDraft.logo='';$('#asset-logo-file').value='';$('#asset-logo-preview').innerHTML=assetLogo({category:$('#asset-category').value,name:'Asset',symbol:$('#asset-symbol').value,logo:''});}return;}
  if(action==='remove-photo'){if(modalDraft?.type==='profile'){modalDraft.photo='';if($('#profile-photo-file'))$('#profile-photo-file').value='';if($('#profile-camera-file'))$('#profile-camera-file').value='';$('#profile-photo-preview').innerHTML=`<span class="avatar large">${esc(state.profile.name.slice(0,1).toUpperCase())}</span>`;}return;}
  if(action==='month'){ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()+Number(el.dataset.delta),1);ui.trackerDate='';render();return;}
  if(action==='calendar-day'){ui.trackerDate=ui.trackerDate===el.dataset.date?'':el.dataset.date;render();return;}
  if(action==='clear-day'){ui.trackerDate='';render();return;}
  if(action==='activity-page'){ui.activityPage+=Number(el.dataset.delta);$('#activity-content').innerHTML=activityContents();return;}
  if(action==='export'){exportBackup();return;}
  if(action==='export-csv'){exportCSV();return;}
  if(action==='import'){$('#import-file').click();return;}
  if(action==='open-backup'){setPage('backup');return;}
  if(action==='recovery'){downloadBlob('assets-recovery-'+today()+'.json',corruptRaw||'{}');return;}
  if(action==='add-currency'){openCurrency();return;}
  if(action==='delete-currency'){const c=el.dataset.currency;if(c==='USDT')return;if(state.assets.some(a=>a.currency===c)||state.loans.some(l=>l.currency===c)){toast('This currency is used by an account or loan and cannot be removed.',true);return;}confirmAction('Remove '+esc(c)+'?','<p>No accounts or loans use this currency. Its manual conversion rate will be removed.</p>','Remove currency',()=>{delete state.settings.rates[c];if(state.settings.displayCurrency===c)state.settings.displayCurrency='USDT';closeModal();commit('Currency removed.',{snapshot:false});});return;}
  if(action==='returns-help'){infoModal('Understanding your returns','<p><strong>Gain / loss = current value - net contributed capital.</strong> Withdrawals reduce net contributed capital, so withdrawing money is not treated as a loss.</p><p>For each asset, percentage return divides gain by opening capital plus later deposits and transfers in. The headline investment return excludes everyday cash accounts and divides investment gain by the sum of their contributed capital. Transfers between investments may count again in that denominator; this is not a time-weighted return.</p><p>Cash and excluded assets are left out of the comparison chart. A percentage is unavailable when contributed capital is zero.</p><p>Conversions use your saved manual rates. These are simple bookkeeping comparisons, not time-weighted, tax or audited performance calculations.</p>');return;}
  if(action==='help'){infoModal('A clear view of your assets','<p><strong>1. Start with your own data.</strong> Remove the labeled sample workspace, then add your cash, trading accounts and investments.</p><p><strong>2. Choose the right account type.</strong> For Binance cash and bank accounts, choose Everyday cash / bank / wallet and enter only the available balance. For investments, enter initial capital and current value.</p><p><strong>3. Keep it current.</strong> Use Money in / Money out for cash, Profit / Loss for investments and Transfer between your own tracked accounts. Use Loans to track borrowing, lending and principal repayments. Link a cash account only when that movement is not already included in its balance.</p><p><strong>4. Keep a backup.</strong> Keep an independent JSON copy through Backup &amp; restore. Cloud sync can also carry your workspace between devices after you configure the backend and sign in. To move a JSON copy, open the website on the other device, upload the file, review it and confirm. This is a manual transfer, not cloud sync. Restore replaces that browser\'s workspace. Clearing browser storage removes local records.</p><p>There are no live prices or exchange connections. This dashboard does not ask for credentials, bank details or crypto keys. The gold badge is decorative, not external verification.</p>');return;}
}
/* Everyday-money and loan bookkeeping. No live rates, automatic interest, or bank access. */
function cashCategories(kind){return kind==='income'?['Other income','Salary','Freelance / business','Gift received','Refund']:['Other spending','Shopping','Food & groceries','Family & friends','Rent & bills','Travel & transport','Health','Fees'];}
function allowedEntryKinds(a){return a?.category==='cash'?['income','expense','transfer']:['profit','loss','deposit','withdrawal','transfer'];}
function entryLabel(e){const a=assetById(e.assetId);if(a?.category==='cash'&&['profit','loss'].includes(e.kind))return e.kind==='profit'?'Money in (legacy)':'Money out (legacy)';if(a?.category==='cash'&&e.kind==='valuation')return 'Balance correction';return KIND[e.kind]?.label||'Entry';}
function investmentOptions(selected){return '<option value="">Included investments</option>'+state.assets.filter(a=>a.category!=='cash').map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)}${a.included?'':' (excluded)'} - ${esc(a.currency)}</option>`).join('');}
function syncAssetMode(){
  if(modalDraft?.type!=='asset'||!$('#asset-form'))return;
  const cash=$('#asset-category').value==='cash',old=assetById(modalDraft.id),zero=old&&metrics(old).value===0;
  $('#investment-field').classList.toggle('hidden',cash);$('#asset-investment').disabled=cash;$('#asset-investment').required=!cash;
  $('#current-balance-field').classList.toggle('full',cash);$('#asset-money-heading').textContent=cash?'AVAILABLE MONEY':'YOUR INVESTMENT';
  $('#asset-current-label').textContent=cash?'Available balance right now':'Current value / balance';
  $('#asset-balance-help').textContent=cash?'Enter the money you can use now. No opening investment or return percentage is needed.':'What this investment is worth, or how much is left, right now.';
  $('.quantity-details').classList.toggle('hidden',cash);
  $('#asset-mode-note').innerHTML=icon('info')+`<span>${cash?'Use Money in, Money out and Transfer for everyday use. Spending is not a trading loss. Editing this balance is a correction, not a recorded expense.'+(zero?' Your saved balance is currently zero. Enter the real available amount above if that is incorrect. We have not changed it automatically.':''):'New profit / loss entries are added to the saved current value. Do not log a result again if it is already included.'}</span>`;
}
function cashFlow(month=today().slice(0,7),account=''){
  const entries=state.entries.filter(e=>{const a=assetById(e.assetId);return a?.category==='cash'&&(account?a.id===account:a.included)&&e.date.startsWith(month);});
  let incoming=0,outgoing=0;const spending=new Map();
  for(const e of entries){const amount=e.amount*e.fx;if(['income','deposit','profit'].includes(e.kind))incoming+=amount;if(['expense','withdrawal','loss'].includes(e.kind)){outgoing+=amount;const cat=e.cashCategory||'Other spending';spending.set(cat,(spending.get(cat)||0)+amount);}}
  return {entries,incoming:round(incoming),outgoing:round(outgoing),net:round(incoming-outgoing),spending:[...spending].sort((a,b)=>b[1]-a[1])};
}
function assetCard(a){
  const m=metrics(a),cash=a.category==='cash',f=cash?cashFlow(today().slice(0,7),a.id):null;
  return `<article class="asset-card ${cash?'cash-card':''} ${!a.included?'excluded':''}" data-asset-id="${a.id}"><div class="asset-top">${assetLogo(a)}<div class="asset-identity"><div class="asset-name" title="${esc(a.name)}">${esc(a.name)}</div><div class="asset-meta">${esc(a.platform||CATEGORY[a.category].label)} ${cash?'':' &middot; '+esc(CATEGORY[a.category].short)}</div></div><button class="icon-button" data-action="asset-menu" data-id="${a.id}" aria-label="Options for ${esc(a.name)}" aria-expanded="${ui.openMenu===a.id}">${icon('more')}</button></div><div class="asset-total">${money(m.usdt)}<small>${esc(state.settings.displayCurrency)}</small></div>${cash?`<div class="cash-available">${icon('wallet')} Available for everyday use${a.currency!==state.settings.displayCurrency?`<span>${moneyNative(m.value,a.currency)} ${esc(a.currency)}</span>`:''}</div>`:`<div class="asset-gain"><span class="${tone(m.pnl)}">${money(m.pnl*rate(a.currency),{signed:true})}</span><span class="change-badge ${tone(m.pnl)}">${pct(m.roi)}</span><span class="asset-gain-label">all time</span></div>`}${!a.included?`<div class="asset-exclusion">${icon('info')}Excluded from totals</div>`:''}<div class="asset-divider"></div>${cash?`<div class="cash-mini-stats"><span>In this month<strong>${money(f.incoming)}</strong></span><span>Out this month<strong>${money(f.outgoing)}</strong></span></div><div class="cash-card-actions"><button class="asset-log-button" data-action="cash-entry" data-id="${a.id}" data-kind="income">${icon('plus')}Money in</button><button class="asset-log-button" data-action="cash-entry" data-id="${a.id}" data-kind="expense">${icon('arrow-up')}Spend</button><button class="asset-log-button" data-action="cash-entry" data-id="${a.id}" data-kind="transfer" ${state.assets.length<2?'disabled':''}>${icon('transfer')}Transfer</button></div>`:`<div class="asset-bottom"><span>Invested <strong>${money(m.gross*rate(a.currency))}</strong></span><button class="asset-log-button" data-action="entry" data-id="${a.id}">${icon('plus')} Log P&amp;L</button></div>`}${ui.openMenu===a.id?`<div class="asset-menu"><button data-action="edit-asset" data-id="${a.id}">${icon('edit')}${cash?'Balance / details':'Edit / update value'}</button><button data-action="${cash?'cash-entry':'entry'}" data-id="${a.id}">${icon('plus')}Add an entry</button><button data-action="asset-history" data-id="${a.id}">${icon('clock')}View history</button><button class="danger" data-action="delete-asset" data-id="${a.id}">${icon('trash')}Delete account</button></div>`:''}</article>`;
}
function cashPage(){
  const f=cashFlow(ui.cashMonth,ui.cashAccount),accounts=state.assets.filter(a=>a.category==='cash'),selected=assetById(ui.cashAccount),balance=selected?metrics(selected).usdt:totals().cash;
  const chosen=accounts.filter(a=>!ui.cashAccount||a.id===ui.cashAccount);
  return `${demoBanner()}<div class="page-heading"><div><div class="eyebrow">DAY-TO-DAY MONEY</div><h1>Life happens here.</h1><p>Your Binance cash, local bank and everyday wallet. Spending is not an investment loss.</p></div><button class="btn btn-primary" data-action="add-asset" data-category="cash">${icon('plus')}Add account</button></div><div class="filter-row"><select class="input" id="cash-account" aria-label="Everyday account filter"><option value="">All included cash accounts</option>${accounts.map(a=>`<option value="${a.id}" ${ui.cashAccount===a.id?'selected':''}>${esc(a.name)}${a.included?'':' (excluded)'}</option>`).join('')}</select><input class="input" id="cash-month" type="month" value="${esc(ui.cashMonth)}" aria-label="Cash flow month"><button class="btn btn-secondary" data-action="cash-entry" data-id="${selected?.id||accounts[0]?.id||''}" data-kind="income">${icon('download')}Money in</button><button class="btn btn-primary" data-action="cash-entry" data-id="${selected?.id||accounts[0]?.id||''}" data-kind="expense">${icon('upload')}Money out</button></div><div class="stat-grid"><div class="stat-card"><span>Available right now</span><strong>${money(balance)}</strong><small>Current balance, not a historical month-end balance</small></div><div class="stat-card"><span>Money in</span><strong class="positive">${money(f.incoming)}</strong><small>New money recorded in the selected month</small></div><div class="stat-card"><span>Money out</span><strong>${money(f.outgoing)}</strong><small>Spending, gifts and everyday payments</small></div><div class="stat-card"><span>Net everyday flow</span><strong>${money(f.net,{signed:true})}</strong><small>Money in minus money out. Not trading P&amp;L.</small></div></div><div class="inline-note cash-note">${icon('info')}<span>Monthly totals exclude internal transfers, loan movements and balance corrections. Loan interest is recorded with its loan payment, not in these everyday totals. Sending a gift? Use <strong>Money out &rarr; Family &amp; friends</strong>. Expecting repayment? Use <strong>Loans &rarr; I lent money</strong>.</span></div><div class="asset-grid" id="asset-grid">${chosen.map(a=>assetCard(a)).join('')||`<button class="empty-card" data-action="add-asset" data-category="cash"><span>${icon('wallet')}</span><strong>Add your first everyday account</strong><small>Binance cash, your bank or physical cash</small></button>`}</div><section class="panel cash-breakdown"><div class="panel-heading"><div><h3>Where your everyday money went</h3><p>Recorded spending categories for ${esc(ui.cashMonth)}</p></div><span class="small-tag">MONEY OUT</span></div>${f.spending.length?`<div class="spending-bars">${f.spending.map(([name,value])=>`<div class="spending-row"><span>${esc(name)}</span><div class="spending-track"><i style="width:${f.outgoing?value/f.outgoing*100:0}%"></i></div><strong>${money(value)}</strong></div>`).join('')}</div>`:'<div class="range-empty">Record a purchase, bill or family payment to see your spending categories.</div>'}</section><section class="panel daily-panel"><div class="panel-heading"><div><h3>All cash movements</h3><p>Includes transfers and linked loan movements. Latest 40 in the selected month.</p></div><button class="text-link" data-page="activity">All activity ${icon('arrow-right')}</button></div>${ledgerTable(f.entries.sort(sortEntries).slice(0,40),{emptyMessage:'No movements in this month. Use Money in or Money out to record your next transaction.'})}</section>`;
}
function loanById(id){return state.loans.find(l=>l.id===id);}
function paymentsFor(id){return state.loanPayments.filter(p=>p.loanId===id);}
function loanRemaining(l){return Math.max(0,round(l.openingOutstanding-paymentsFor(l.id).reduce((s,p)=>s+p.principal,0)));}
function loanStatus(l){if(loanRemaining(l)<1e-8)return {key:'settled',label:'Fully repaid'};if(!l.dueDate)return {key:'open',label:'No due date'};if(l.dueDate<today())return {key:'overdue',label:'Overdue'};if(l.dueDate===today())return {key:'due',label:'Due today'};return {key:'open',label:'Due '+dateLabel(l.dueDate)};}
function cashAccountOptions(selected){return state.assets.filter(a=>a.category==='cash'&&a.included).map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)} - ${esc(a.currency)}</option>`).join('');}
function loanOverview(){
  const open=state.loans.filter(l=>loanRemaining(l)>1e-8),due=[...open].sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,3);
  return `<section class="panel loan-overview"><div class="panel-heading"><div><h3>Loans &amp; money owed</h3><p>Keep borrowed money and money lent in view.</p></div><div class="section-actions"><button class="btn btn-secondary btn-small" data-page="loans">View loans</button><button class="btn btn-primary btn-small" data-action="add-loan">${icon('plus')}Add loan</button></div></div>${due.length?`<div class="loan-quick-list">${due.map(l=>`<button class="loan-quick-row" data-action="loan-history" data-id="${l.id}"><span class="loan-direction-icon">${icon(l.direction==='borrowed'?'arrow-up':'arrow-down')}</span><span><strong>${esc(l.person)}</strong><small>${l.direction==='borrowed'?'You owe':'Owed to you'} &middot; ${esc(l.title)}</small></span><span><strong>${money(loanRemaining(l)*rate(l.currency))}</strong><small class="${loanStatus(l).key==='overdue'?'due-label':''}">${esc(loanStatus(l).label)}</small></span>${icon('chevron')}</button>`).join('')}</div>`:'<div class="loan-empty-inline">No outstanding loans. Add existing borrowing or money someone owes you without changing your cash balance.</div>'}</section>`;
}
function loanCards(){
  const loans=state.loans.filter(l=>{const status=loanStatus(l);return (ui.loanFilter==='all'||ui.loanFilter===l.direction||ui.loanFilter===status.key)&&(!ui.loanQuery||(l.person+' '+l.title+' '+l.notes).toLowerCase().includes(ui.loanQuery.toLowerCase()));}).sort((a,b)=>{const aSettled=loanRemaining(a)<1e-8,bSettled=loanRemaining(b)<1e-8;return Number(aSettled)-Number(bSettled)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999');});
  if(!loans.length)return `<div class="empty-state">${icon('transfer')}<h3>${state.loans.length?'No matching loans':'A clear picture of what is owed'}</h3><p>Add money you borrowed or lent. Existing loans can be tracked without moving your cash again.</p><button class="btn btn-primary" data-action="add-loan">${icon('plus')}Add loan</button></div>`;
  return loans.map(l=>{const remaining=loanRemaining(l),paid=round(l.principal-remaining),progress=Math.max(0,Math.min(100,paid/l.principal*100)),status=loanStatus(l);return `<article class="loan-card ${status.key==='settled'?'settled':''}" data-loan-id="${l.id}"><div class="loan-card-top"><span class="loan-direction-icon">${icon(l.direction==='borrowed'?'arrow-up':'arrow-down')}</span><div><div class="loan-person">${esc(l.person)}</div><span class="loan-caption">${esc(l.title)}</span></div><span class="loan-type">${l.direction==='borrowed'?'I OWE':'OWED TO ME'}</span></div><div class="loan-value-label">Outstanding principal</div><div class="loan-value">${money(remaining*rate(l.currency))}<small>${esc(state.settings.displayCurrency)}</small></div>${l.currency!==state.settings.displayCurrency?`<div class="loan-native">${moneyNative(remaining,l.currency)} ${esc(l.currency)}</div>`:''}<div class="loan-progress" role="img" aria-label="${esc(pct(progress,{signed:false}))} of original principal repaid"><i style="width:${progress}%"></i></div><div class="loan-progress-label"><span>Repaid ${pct(progress,{signed:false})}</span><span>Original ${moneyNative(l.principal,l.currency)} ${esc(l.currency)}</span></div><div class="loan-due"><span class="status-pill ${status.key}">${status.key==='overdue'?icon('clock'):icon('calendar')}${esc(status.label)}</span><button class="text-link" data-action="loan-history" data-id="${l.id}">History ${icon('chevron')}</button></div><div class="loan-card-actions"><button class="btn btn-primary btn-small" data-action="repay-loan" data-id="${l.id}" ${remaining<1e-8?'disabled':''}>${icon(remaining<1e-8?'check':'plus')}${remaining<1e-8?'Repaid':l.direction==='borrowed'?'Record repayment':'Record received'}</button><button class="btn btn-secondary btn-small" data-action="edit-loan" data-id="${l.id}">${icon('edit')}Edit</button><button class="icon-button" data-action="delete-loan" data-id="${l.id}" aria-label="Delete loan with ${esc(l.person)}">${icon('trash')}</button></div></article>`;}).join('');
}
function loansPage(){
  const t=totals(),active=state.loans.filter(l=>loanRemaining(l)>1e-8),overdue=active.filter(l=>loanStatus(l).key==='overdue');
  return `${demoBanner()}<div class="page-heading"><div><div class="eyebrow">BORROWED. LENT. ACCOUNTED FOR.</div><h1>Nothing left untracked.</h1><p>What you owe, what comes back to you, and every repayment in between.</p></div><button class="btn btn-primary" data-action="add-loan">${icon('plus')}Add loan</button></div><div class="stat-grid"><div class="stat-card"><span>Loans I owe</span><strong>${money(t.youOwe)}</strong><small>${active.filter(l=>l.direction==='borrowed').length} outstanding borrowing records</small></div><div class="stat-card"><span>Money owed to me</span><strong class="positive">${money(t.owedToYou)}</strong><small>${active.filter(l=>l.direction==='lent').length} outstanding lending records</small></div><div class="stat-card"><span>Overdue records</span><strong>${overdue.length}</strong><small>${overdue.length?'Based on your manually entered next due dates':'No overdue principal records'}</small></div><div class="stat-card"><span>Fully repaid</span><strong>${state.loans.length-active.length}</strong><small>Original records and repayment history retained</small></div></div><div class="asset-toolbar"><div class="tabs" aria-label="Loan filters">${[['all','All loans'],['borrowed','I owe'],['lent','Owed to me'],['overdue','Overdue'],['settled','Repaid']].map(([k,label])=>`<button class="tab ${ui.loanFilter===k?'active':''}" data-action="loan-tab" data-filter="${k}">${label}</button>`).join('')}</div><label class="search-field">${icon('search')}<input id="loan-search" type="search" placeholder="Search loans..." value="${esc(ui.loanQuery)}" aria-label="Search loans"></label></div><div class="loan-grid" id="loan-list">${loanCards()}</div><div class="inline-note cash-note">${icon('info')}<span>Only unpaid principal is included in net worth. Interest or fees are recorded when paid, not accrued automatically. Due dates are manual; there are no background reminders. An existing loan does not move cash unless you explicitly link a new cash movement.</span></div><section class="panel daily-panel"><div class="panel-heading"><div><h3>Repayment history</h3><p>Principal and interest stay separate. Latest 50 repayments.</p></div><button class="btn btn-secondary btn-small" data-action="export-loans">${icon('download')}Export loans</button></div>${loanPaymentTable([...state.loanPayments].sort(sortEntries).slice(0,50))}</section>`;
}
function loanPaymentTable(payments){
  if(!payments.length)return '<div class="range-empty">No repayments recorded yet. Open a loan to record a payment.</div>';
  return `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Loan / person</th><th>Principal</th><th>Interest / fees</th><th>Cash account</th><th><span class="screen-reader-only">Reverse payment</span></th></tr></thead><tbody>${payments.map(p=>{const l=loanById(p.loanId);return `<tr><td class="no-wrap">${dateLabel(p.date)}<small class="table-sub">${p.date.slice(0,4)}</small></td><td><strong>${esc(l.person)}</strong><small class="table-sub">${l.direction==='borrowed'?'Payment made':'Payment received'} &middot; ${esc(l.title)}</small>${p.note?`<small class="table-sub">${esc(p.note)}</small>`:''}</td><td class="no-wrap">${moneyNative(p.principal,l.currency)} ${esc(l.currency)}</td><td class="no-wrap">${moneyNative(p.interest,l.currency)} ${esc(l.currency)}</td><td>${p.accountId?esc(assetById(p.accountId)?.name||'Account'):'History only'}<small class="table-sub">${p.accountId?'Balance was updated':'No cash movement'}</small></td><td><button class="icon-button" data-action="reverse-loan-payment" data-id="${p.id}" aria-label="Reverse repayment on ${esc(p.date)}">${icon('trash')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
}
function openLoan(id=''){
  const l=loanById(id);if(id&&!l)return;
  const locked=Boolean(l&&(l.openingEntryId||paymentsFor(id).length)),cash=state.assets.filter(a=>a.category==='cash'&&a.included),direction=l?.direction||'borrowed';
  modalDraft={type:'loan',id,direction,outstandingTouched:Boolean(l)};
  showModal(`${modalHeader(l?'Edit loan details':'Add a loan','Track borrowed money or money lent. Cash is only changed when you explicitly choose to move it.')}<form id="loan-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="direction-tabs"><button type="button" class="entry-type ${direction==='borrowed'?'active':''}" data-action="loan-direction" data-direction="borrowed" ${locked?'disabled':''}>${icon('arrow-down')}I borrowed money</button><button type="button" class="entry-type ${direction==='lent'?'active':''}" data-action="loan-direction" data-direction="lent" ${locked?'disabled':''}>${icon('arrow-up')}I lent money</button></div><div class="form-grid"><div class="field"><label for="loan-person" id="loan-person-label">${direction==='borrowed'?'Who do you owe?':'Who owes you?'}</label><input class="input" id="loan-person" maxlength="80" required value="${esc(l?.person||'')}" placeholder="Person, bank or company"></div><div class="field"><label for="loan-title">Loan label</label><input class="input" id="loan-title" maxlength="60" required value="${esc(l?.title||'')}" placeholder="e.g. Personal loan"></div><div class="field"><label for="loan-currency">Loan currency</label><select class="input" id="loan-currency" ${locked?'disabled':''}>${optionsCurrencies(l?.currency||'USDT')}</select><p class="field-help">Add currencies in Settings. Uses your saved manual rate.</p></div><div class="field"><label for="loan-start">Loan start date</label><input class="input" type="date" id="loan-start" required max="${today()}" value="${esc(l?.startDate||today())}" ${locked?'disabled':''}></div><div class="field"><label for="loan-principal">Original principal</label><input class="input" type="number" id="loan-principal" min="0.00000001" max="10000000000000" step="any" required placeholder="e.g. 1000" value="${l?.principal??''}" ${locked?'disabled':''}></div><div class="field"><label for="loan-outstanding">${l&&locked?'Principal when tracking started':'Principal still outstanding'}</label><input class="input" type="number" id="loan-outstanding" min="0" max="10000000000000" step="any" required placeholder="e.g. 600" value="${l?.openingOutstanding??''}" ${locked?'disabled':''}><p class="field-help">${locked?'Locked to preserve repayments. Record a payment to reduce what remains.':'For an existing loan, enter what remains unpaid today.'}</p></div><div class="field full"><label for="loan-due">Next due date <span class="field-label-hint">Optional</span></label><input class="input" id="loan-due" type="date" value="${esc(l?.dueDate||'')}"><p class="field-help">A manual tracking date, not an automatic repayment schedule.</p></div>${!l?`<div class="loan-link-box full"><label class="checkbox-line"><input type="checkbox" id="loan-move" ${cash.length?'':'disabled'}><span><strong>This is new money. Update a cash account now.</strong></span></label><p class="field-help">Leave this off for an existing loan or when your saved cash balance already includes this money.</p><div class="field hidden" id="loan-account-field"><label for="loan-account">Cash / bank account</label><select class="input" id="loan-account">${cashAccountOptions(cash[0]?.id)}</select></div>${cash.length?'':'<p class="field-help">Add an included everyday cash account first to link a new movement.</p>'}</div>`:`<div class="inline-note full">${icon('info')}<span>${locked?'Financial fields are locked because this loan has recorded movements. Reverse incorrect payments from History before replacing them. Details, notes and the next due date remain editable.':'Editing an existing loan never changes a cash account balance.'}</span></div>`}<div class="field full"><label for="loan-notes">Notes <span class="field-label-hint">Optional</span></label><textarea class="input" id="loan-notes" maxlength="600" placeholder="Terms, payment plan or anything to remember...">${esc(l?.notes||'')}</textarea></div></div><div id="loan-preview"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${icon('check')}${l?'Save changes':'Add loan'}</button></div></form>`);
  updateLoanPreview();
}
function updateLoanPreview(){
  if(modalDraft?.type!=='loan'||!$('#loan-form'))return;
  const move=Boolean($('#loan-move')?.checked);$('#loan-account-field')?.classList.toggle('hidden',!move);if($('#loan-account'))$('#loan-account').required=move;
  const a=assetById($('#loan-account')?.value),currency=$('#loan-currency').value,principal=Number($('#loan-principal').value)||0,outstanding=Number($('#loan-outstanding').value)||0,sign=modalDraft.direction==='borrowed'?1:-1;
  let content='';
  if(move&&a){const native=round(principal*rate(currency)/rate(a.currency));content=`<div class="preview-line"><span>${esc(a.name)} ${sign>0?'receives':'sends'}</span><strong>${moneyNative(native,a.currency,{reveal:true})} ${esc(a.currency)}</strong></div><div class="preview-line"><span>Account balance after</span><strong>${moneyNative(metrics(a).value+sign*native,a.currency,{reveal:true})} ${esc(a.currency)}</strong></div><p class="field-help">New disbursements require outstanding principal to equal the original amount. Both cash and the loan are tracked, so principal alone does not change net worth when the full cash movement is linked.</p>`;}
  else content=`<div class="preview-line"><span>Cash movement</span><strong>None</strong></div><p class="field-help">${modalDraft.id?'Saving details does not move cash.':'Only the loan record is added. '+(modalDraft.direction==='borrowed'?'Outstanding principal reduces net worth.':'Outstanding principal adds to money owed to you.')} Existing cash balances are left unchanged.</p>`;
  $('#loan-preview').innerHTML=`<div class="entry-preview">${content}</div>`;
}
function saveLoan(){
  if(modalDraft?.type!=='loan')return;
  const old=loanById(modalDraft.id),locked=Boolean(old&&(old.openingEntryId||paymentsFor(old.id).length)),direction=locked?old.direction:modalDraft.direction;
  const person=$('#loan-person').value.trim(),title=$('#loan-title').value.trim(),currency=locked?old.currency:$('#loan-currency').value,principal=locked?old.principal:round(Number($('#loan-principal').value)),outstanding=locked?old.openingOutstanding:round(Number($('#loan-outstanding').value)),startDate=locked?old.startDate:$('#loan-start').value,dueDate=$('#loan-due').value,notes=$('#loan-notes').value.trim();
  if(!person||!title)return formError('Enter a person or company and a loan label.');if(!Object.hasOwn(state.settings.rates,currency)||!['borrowed','lent'].includes(direction))return formError('Choose a valid currency and loan type.');
  if(!validNumber(principal,1e-8)||!validNumber(outstanding,0,principal))return formError('Outstanding principal must be between zero and the original loan amount.');
  if(!validDate(startDate)||startDate>today()||dueDate&&!validDate(dueDate))return formError('Check the loan dates. The start date cannot be in the future.');
  if(dueDate&&dueDate<startDate)return formError('The next due date cannot be before the loan start date.');
  const move=!old&&Boolean($('#loan-move')?.checked),account=move?assetById($('#loan-account').value):null,amount=account?round(principal*rate(currency)/rate(account.currency)):0;
  if(move){if(!account||account.category!=='cash'||!account.included)return formError('Choose an included everyday cash account.');if(Math.abs(outstanding-principal)>1e-8)return formError('For new money, outstanding must equal the original amount. For an existing partly repaid loan, turn off the cash movement.');if(!validNumber(amount,1e-8))return formError('Check the amount and manual currency rates.');if(direction==='lent'&&amount>metrics(account).value+1e-8)return formError('This cash account does not have enough available money to lend.');if(direction==='borrowed'&&!validNumber(metrics(account).value+amount,0))return formError('The resulting account balance is too large.');}
  const l=old||{id:uid(),openingEntryId:'',createdAt:new Date().toISOString()};Object.assign(l,{person,title,direction,currency,principal,openingOutstanding:outstanding,startDate,dueDate,notes});
  if(!old){state.loans.push(l);if(move){const e=appendEntry(account,direction==='borrowed'?'loan_received':'loan_advanced',amount,startDate,(direction==='borrowed'?'Borrowed from ':'Lent to ')+person);e.loanId=l.id;l.openingEntryId=e.id;}}
  closeModal();commit(old?'Loan details updated.':move?'Loan added and cash balance updated.':'Existing loan added. Cash balances unchanged.');
}
function openLoanPayment(id){
  const l=loanById(id);if(!l)return;const remaining=loanRemaining(l);if(remaining<1e-8){toast('This loan principal is already fully repaid.');return;}
  const accounts=state.assets.filter(a=>a.category==='cash'&&a.included),origin=state.entries.find(e=>e.id===l.openingEntryId)?.assetId,selected=accounts.find(a=>a.id===origin)||accounts[0];
  modalDraft={type:'repayment',loanId:id};
  showModal(`${modalHeader(l.direction==='borrowed'?'Record a repayment':'Record money received',esc(l.person)+' &middot; '+esc(l.title))}<form id="repayment-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="repayment-outstanding"><span>Outstanding principal</span><strong>${moneyNative(remaining,l.currency,{reveal:true})} ${esc(l.currency)}</strong></div><div class="form-grid"><div class="field"><label for="payment-principal">Principal repaid <span class="field-label-hint">${esc(l.currency)}</span></label><input class="input" id="payment-principal" type="number" min="0" max="${remaining}" step="any" required placeholder="e.g. 100.00"></div><div class="field"><label for="payment-interest">Interest / fees <span class="field-label-hint">Optional</span></label><input class="input" id="payment-interest" type="number" min="0" max="10000000000000" step="any" value="0"><p class="field-help">Part of cash paid, but does not reduce principal.</p></div><div class="field"><label for="payment-date">Payment date</label><input class="input" id="payment-date" type="date" required min="${esc(l.startDate)}" max="${today()}" value="${today()}"></div><div class="field"><label for="payment-next-due">Next due date <span class="field-label-hint">Optional</span></label><input class="input" id="payment-next-due" type="date" value="${esc(l.dueDate>today()?l.dueDate:'')}"><p class="field-help">Set the next date, or leave blank to clear it.</p></div><div class="loan-link-box full"><label class="checkbox-line"><input id="payment-move" type="checkbox" ${accounts.length?'checked':'disabled'}><span><strong>Update my cash account balance</strong></span></label><p class="field-help">Turn off only when this payment is already included in the account balance, or you are recording history from an untracked account.</p><div class="field ${accounts.length?'':'hidden'}" id="payment-account-field"><label for="payment-account">${l.direction==='borrowed'?'Pay from':'Receive into'}</label><select class="input" id="payment-account">${cashAccountOptions(selected?.id)}</select></div></div><div class="field full"><label for="payment-note">Note</label><textarea class="input" id="payment-note" maxlength="300" placeholder="Payment reference or note..."></textarea></div></div><div id="payment-preview"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${icon('check')}Save repayment</button></div></form>`);
  updateLoanPaymentPreview();
}
function updateLoanPaymentPreview(){
  if(modalDraft?.type!=='repayment'||!$('#repayment-form'))return;
  const l=loanById(modalDraft.loanId),principal=Number($('#payment-principal').value)||0,interest=Number($('#payment-interest').value)||0,move=$('#payment-move').checked,a=assetById($('#payment-account').value),total=principal+interest;
  $('#payment-account-field').classList.toggle('hidden',!move);$('#payment-account').required=move;
  let content=`<div class="preview-line"><span>Total ${l.direction==='borrowed'?'paid':'received'}</span><strong>${moneyNative(total,l.currency,{reveal:true})} ${esc(l.currency)}</strong></div><div class="preview-line"><span>Principal remaining after</span><strong>${moneyNative(loanRemaining(l)-principal,l.currency,{reveal:true})} ${esc(l.currency)}</strong></div>`;
  if(move&&a){const amount=round(total*rate(l.currency)/rate(a.currency));content+=`<div class="preview-line"><span>${esc(a.name)} ${l.direction==='borrowed'?'pays':'receives'}</span><strong>${moneyNative(amount,a.currency,{reveal:true})} ${esc(a.currency)}</strong></div><div class="preview-line"><span>Cash balance after</span><strong>${moneyNative(metrics(a).value+(l.direction==='borrowed'?-amount:amount),a.currency,{reveal:true})} ${esc(a.currency)}</strong></div>`;}
  else content+='<div class="preview-line"><span>Cash movement</span><strong>None - history only</strong></div>';
  $('#payment-preview').innerHTML=`<div class="entry-preview">${content}<p class="field-help">Principal reduces the loan balance. This is not trading profit or loss. Currency conversions use your saved manual rates.</p></div>`;
}
function saveLoanPayment(){
  if(modalDraft?.type!=='repayment')return;const l=loanById(modalDraft.loanId);if(!l)return formError('This loan no longer exists.');
  const principal=round(Number($('#payment-principal').value)),interest=round(Number($('#payment-interest').value)),date=$('#payment-date').value,nextDueDate=$('#payment-next-due').value,note=$('#payment-note').value.trim(),move=$('#payment-move').checked,a=move?assetById($('#payment-account').value):null;
  if(!validNumber(principal,0,loanRemaining(l))||!validNumber(interest,0)||!validNumber(principal+interest,1e-8))return formError('Enter a valid payment. Principal cannot exceed the outstanding amount.');
  if(!validDate(date)||date>today()||date<l.startDate)return formError('Choose a payment date between the loan start date and today.');if(nextDueDate&&(!validDate(nextDueDate)||nextDueDate<date))return formError('The next due date must be on or after this payment date.');
  const amount=a?round((principal+interest)*rate(l.currency)/rate(a.currency)):0;
  if(move){if(!a||a.category!=='cash'||!a.included)return formError('Select an included everyday cash account.');if(!validNumber(amount,1e-8))return formError('Check the payment amount and manual conversion rates.');if(l.direction==='borrowed'&&amount>metrics(a).value+1e-8)return formError('There is not enough available money in that account.');if(l.direction==='lent'&&!validNumber(metrics(a).value+amount,0))return formError('The resulting cash balance is too large.');}
  const remaining=round(loanRemaining(l)-principal),p={id:uid(),loanId:l.id,principal,interest,date,note,fx:rate(l.currency),accountId:a?.id||'',entryId:'',createdAt:new Date().toISOString(),previousDueDate:l.dueDate,nextDueDate:remaining<1e-8?'':nextDueDate};
  if(move){const e=appendEntry(a,l.direction==='borrowed'?'loan_paid':'loan_collected',amount,date,note||'Loan repayment - '+l.person);e.loanId=l.id;e.paymentId=p.id;p.entryId=e.id;}
  state.loanPayments.push(p);l.dueDate=p.nextDueDate;closeModal();commit(remaining<1e-8?'Repayment saved. This loan principal is fully repaid.':move?'Repayment saved. Loan and cash balances updated.':'Repayment history saved. Cash balances unchanged.');
}
function canReverseEntries(entries){
  for(const a of state.assets){const change=entries.filter(e=>e.assetId===a.id).reduce((s,e)=>s+effect(e).value,0);if(change&&metrics(a).value-change<-1e-8)return 'Reversing this would make '+a.name+' negative. Reverse dependent spending or transfers first.';}
  return '';
}
function reverseLoanPayment(id){
  const p=state.loanPayments.find(x=>x.id===id);if(!p)return;const l=loanById(p.loanId),e=state.entries.find(x=>x.id===p.entryId);
  confirmAction('Reverse this repayment?',`<p>The principal payment of <strong>${esc(moneyNative(p.principal,l.currency,{reveal:true}))} ${esc(l.currency)}</strong> for ${esc(l.person)} will be removed, restoring that amount to the loan.</p><p>${e?'The linked cash movement, including interest or fees, will also be reversed.':'This history-only record has no cash movement to reverse.'}</p>`,'Reverse repayment',()=>{
    const error=canReverseEntries(e?[e]:[]);if(error){closeModal();toast(error,true);return;}
    const latest=[...paymentsFor(l.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    if(latest?.id===p.id&&l.dueDate===p.nextDueDate)l.dueDate=p.previousDueDate;
    state.entries=state.entries.filter(x=>x.id!==p.entryId);state.loanPayments=state.loanPayments.filter(x=>x.id!==p.id);closeModal();commit('Repayment reversed. Outstanding principal restored.');
  });
}
function deleteLoan(id){
  const l=loanById(id);if(!l)return;const linked=state.entries.filter(e=>e.loanId===id),payments=paymentsFor(id);
  confirmAction('Delete this loan?',`<p>This removes the <strong>${esc(l.title)}</strong> record with ${esc(l.person)}, its outstanding balance and ${payments.length} recorded repayments.</p><p>${linked.length?`All ${linked.length} linked cash entries will be reversed. Cash balances will return to what they would be without this loan's recorded movements.`:'No cash balances will change because this loan has no linked cash entries.'} Your net worth will be recalculated. Export a backup first to retain the history.</p>`,'Delete & reverse loan',()=>{const error=canReverseEntries(linked);if(error){closeModal();toast(error,true);return;}state.entries=state.entries.filter(e=>e.loanId!==id);state.loanPayments=state.loanPayments.filter(p=>p.loanId!==id);state.loans=state.loans.filter(x=>x.id!==id);closeModal();commit('Loan removed and linked cash entries reversed.');});
}
function showLoanHistory(id){
  const l=loanById(id);if(!l)return;const paidBefore=round(l.principal-l.openingOutstanding),entry=state.entries.find(e=>e.id===l.openingEntryId);
  modalDraft={type:'loan-history',loanId:id};showModal(`${modalHeader(esc(l.person),esc(l.title)+' &middot; '+(l.direction==='borrowed'?'Money you borrowed':'Money you lent'))}<div class="modal-body"><div class="repayment-outstanding"><span>Remaining principal</span><strong>${moneyNative(loanRemaining(l),l.currency,{reveal:true})} ${esc(l.currency)}</strong></div><div class="loan-history-summary"><p><strong>Original principal</strong> ${moneyNative(l.principal,l.currency,{reveal:true})} ${esc(l.currency)}</p><p><strong>Repaid before tracking</strong> ${moneyNative(paidBefore,l.currency,{reveal:true})} ${esc(l.currency)}</p><p><strong>Started</strong> ${dateLabel(l.startDate,{month:'long',day:'numeric',year:'numeric'})}</p><p><strong>Next due</strong> ${l.dueDate?dateLabel(l.dueDate,{month:'long',day:'numeric',year:'numeric'}):'Not set'}</p><p><strong>Initial cash movement</strong> ${entry?esc(assetById(entry.assetId)?.name)+' / '+moneyNative(entry.amount,assetById(entry.assetId).currency,{reveal:true}):'None - added as an existing record'}</p>${l.notes?`<p><strong>Notes</strong> ${esc(l.notes)}</p>`:''}</div>${loanPaymentTable([...paymentsFor(id)].sort(sortEntries))}</div><div class="modal-footer"><button class="btn btn-secondary" data-action="edit-loan" data-id="${id}">${icon('edit')}Edit details</button><button class="btn btn-primary" data-action="repay-loan" data-id="${id}" ${loanRemaining(l)<1e-8?'disabled':''}>${icon('plus')}Record repayment</button></div>`);
}
function exportLoans(){
  const rows=[['Record','Loan ID','Person','Label','Direction','Currency','Date','Original principal','Outstanding now','Principal paid','Interest / fees','Account','Next due date','Note']];
  for(const l of state.loans){rows.push(['Loan',l.id,l.person,l.title,l.direction,l.currency,l.startDate,l.principal,loanRemaining(l),'','', '',l.dueDate,l.notes]);for(const p of paymentsFor(l.id))rows.push(['Repayment',l.id,l.person,l.title,l.direction,l.currency,p.date,'','',p.principal,p.interest,p.accountId?assetById(p.accountId)?.name:'History only',p.nextDueDate,p.note]);}
  downloadBlob('assets-loans-'+today()+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv');toast('Loan and repayment CSV prepared.');
}
function handleMoneyAction(action,el){
  const id=el.dataset.id||'';
  if(action==='cash-entry'){const accounts=state.assets.filter(a=>a.category==='cash');if(!accounts.length){openAsset('','cash');toast('Add an everyday account first.');}else openEntry(id||accounts[0].id,el.dataset.kind||'income');return true;}
  if(action==='add-loan'){openLoan();return true;}if(action==='edit-loan'){openLoan(id);return true;}if(action==='repay-loan'){openLoanPayment(id);return true;}if(action==='loan-history'){showLoanHistory(id);return true;}
  if(action==='delete-loan'){deleteLoan(id);return true;}if(action==='reverse-loan-payment'){reverseLoanPayment(id);return true;}if(action==='export-loans'){exportLoans();return true;}
  if(action==='loan-tab'){ui.loanFilter=el.dataset.filter;render();return true;}if(action==='loans-filter'){ui.loanFilter=el.dataset.filter;setPage('loans');return true;}
  if(action==='loan-direction'&&modalDraft?.type==='loan'){modalDraft.direction=el.dataset.direction;$$('[data-action="loan-direction"]').forEach(x=>x.classList.toggle('active',x.dataset.direction===modalDraft.direction));$('#loan-person-label').textContent=modalDraft.direction==='borrowed'?'Who do you owe?':'Who owes you?';updateLoanPreview();return true;}
  return false;
}
// Interface upgrade. The ledger format stays at v2 for backup compatibility.
const RECOVERY_KEY = STORAGE_KEY + '.before-restore';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let pickerSession = null;
let importSequence = 0;

function formatStamp(value){
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Not recorded';
}
function sizeLabel(bytes){return bytes<1024?(bytes+' B'):bytes<1048576?((bytes/1024).toFixed(1)+' KB'):((bytes/1048576).toFixed(1)+' MB');}
function hasWorkspaceData(s=state){return Boolean(s.assets.length||s.entries.length||s.loans.length||s.loanPayments.length);}
function getRecovery(){try{const raw=localStorage.getItem(RECOVERY_KEY);if(!raw)return null;const r=JSON.parse(raw);if(!r||typeof r.raw!=='string')return null;return r;}catch{return null;}}
function transferableState(){
  if(persistenceBlocked)throw Error('Your saved workspace needs recovery. Export its recovery copy instead of an empty backup.');
  state.settings.lastBackup=new Date().toISOString();
  persist();
  // Normalize optional empty fields so exports restore byte-for-byte as records.
  const text=JSON.stringify(validateState(state),null,2);
  const time=new Date(),suffix=[time.getHours(),time.getMinutes(),time.getSeconds()].map(v=>String(v).padStart(2,'0')).join('');
  return {text,name:'assets-backup-'+today()+'_'+suffix+'.json'};
}
function backupPage(){
  const recovery=getRecovery(),photos=(state.profile.photo?1:0)+state.assets.filter(a=>a.logo).length;
  const canShare=typeof navigator.share==='function'&&typeof navigator.canShare==='function';
  return `${demoBanner()}<div class="cloud-shortcut-banner"><div><strong>Automatic daily backups &amp; device sync</strong><p>Connect a private cloud workspace to keep server-side copies while this browser is closed.</p></div><button class="btn btn-primary" data-page="cloud">${icon('globe')}Cloud &amp; daily backups</button></div><div class="backup-hero"><div><div class="eyebrow">YOUR WORKSPACE, WITH YOU</div><h1>Pick up where<br>you left off.</h1><p>One file keeps your whole workspace together. Download it here, restore it on another device, and continue with the same accounts and history.</p></div><div class="backup-hero-icon">${icon('folder')}</div></div>
  <div class="backup-status-strip"><span>${icon(storageOk?'shield':'info')}<strong>${storageOk?'Saved in this browser':'Browser storage needs attention'}</strong></span><span>${icon('clock')}Last backup prepared: <strong>${state.settings.lastBackup?esc(formatStamp(state.settings.lastBackup)):'Not yet'}</strong></span></div>
  ${recovery?`<div class="backup-undo"><div><strong>A pre-restore copy is available</strong><p>Saved in this browser on ${esc(formatStamp(recovery.savedAt))}. Review it before replacing anything.</p></div><button class="btn btn-secondary" data-action="review-recovery">${icon('clock')}Review previous workspace</button></div>`:''}
  ${corruptRaw?`<div class="inline-note warning" style="margin-bottom:20px">${icon('info')}<span>Your earlier browser data could not be read. It has not been overwritten. <button class="text-link" data-action="recovery">Download the recovery copy</button> before restoring a different file.</span></div>`:''}
  <div class="backup-grid">
    <section class="backup-card download-card"><div class="backup-card-label"><span class="backup-icon">${icon('download')}</span><span class="backup-step-label">01 / KEEP A COPY</span></div><h2>Download your workspace</h2><p>A complete JSON backup, not just a report. Your records, pictures and settings all travel together.</p>
      <div class="backup-content-list"><span>${icon('check')}Accounts &amp; balances</span><span>${icon('check')}Loans &amp; repayments</span><span>${icon('check')}Income &amp; spending</span><span>${icon('check')}Trading &amp; value history</span><span>${icon('check')}Profile photo &amp; logos</span><span>${icon('check')}Currency settings</span></div>
      <div class="backup-card-bottom"><button class="btn btn-primary" data-action="export">${icon('download')}Download full backup</button>${canShare?'<button class="btn btn-secondary" data-action="share-backup">'+icon('upload')+'Share / save backup</button>':''}<p class="backup-file-caption">${state.assets.length} accounts &middot; ${state.loans.length} loans &middot; ${photos} saved ${photos===1?'image':'images'}<br>Save the file in a private folder you can find again.</p></div>
    </section>
    <section class="backup-card"><div class="backup-card-label"><span class="backup-icon">${icon('upload')}</span><span class="backup-step-label">02 / CONTINUE ANYWHERE</span></div><h2>Restore your workspace</h2><p>Choose the latest backup from your phone or computer. Review the file before replacing this browser's workspace.</p>
      <button class="backup-drop" data-action="import" data-backup-drop aria-label="Choose a JSON backup to restore">${icon('folder')}<strong>Choose your backup file</strong><span>Tap to browse, or drop a .json file here</span><span>Assets v1 / v2 &middot; Up to 12 MB</span></button>
      <div class="backup-card-bottom"><button class="btn btn-secondary" data-action="import">${icon('upload')}Upload &amp; review backup</button><p class="backup-file-caption">Read locally first. A linked cloud workspace syncs after you confirm.<br>Nothing changes until you confirm the restore.</p></div>
    </section>
  </div>
  <div class="backup-bottom-grid"><section class="panel"><h3>From your computer to your phone.</h3><p>The same process works in either direction.</p><div class="backup-how">
      <div class="backup-how-step"><span>1</span><div><strong>Download the latest backup</strong><p>Finish saving any open form, then download your workspace from this page.</p></div></div>
      <div class="backup-how-step"><span>2</span><div><strong>Move the file privately</strong><p>Use your own Files folder, private cloud storage or a direct device transfer. The file contains your financial records.</p></div></div>
      <div class="backup-how-step"><span>3</span><div><strong>Open Assets, then restore</strong><p>On the other device, open this website in a browser, go to Backups, choose the file and confirm. Your profile and history come back too.</p></div></div>
    </div></section><section class="panel"><h3>Your data stays yours.</h3><p>Saving in the browser and downloading a backup are different things. Keep both.</p><div class="backup-tools"><button class="btn btn-secondary" data-action="export-csv">${icon('download')}Export account activity as CSV</button><button class="btn btn-secondary" data-action="export-loans">${icon('download')}Export loans as CSV</button></div><p class="field-help">CSV files are reports only. Use the full JSON backup to restore a workspace.</p><div class="backup-caution"><strong>File restore is a replacement, not a merge.</strong> Without cloud sync, move a fresh JSON backup between devices. With cloud sync linked, a confirmed restore also replaces the cloud workspace after syncing.<br><br><strong>Backups are not encrypted.</strong> Keep them private. Clearing browser data removes local records and any local pre-restore copy, but not files you have saved separately.</div></section></div>`;
}
function restorePreview(incoming,filename,bytes,isRecovery=false){
  closeDatePicker(false);
  const older=!state.demo&&hasWorkspaceData()&&new Date(incoming.updatedAt)<new Date(state.updatedAt);
  const keepable=hasWorkspaceData()&&!state.demo||Boolean(corruptRaw);
  const imageCount=(incoming.profile.photo?1:0)+incoming.assets.filter(a=>a.logo).length;
  modalDraft={type:'restore',incoming,filename,isRecovery,original:JSON.stringify(state)};
  showModal(`${modalHeader(isRecovery?'Review your previous workspace':'Ready to restore','Your file has been checked. Review what it contains before continuing.')}<div class="modal-body"><div class="form-error" id="form-error" role="alert"></div>
    <div class="restore-file"><span class="backup-icon">${icon('check')}</span><div><strong>${esc(filename)}</strong><small>Valid Assets backup &middot; ${sizeLabel(bytes)}<br>Saved ${esc(formatStamp(incoming.updatedAt))}</small></div></div>
    <div class="restore-profile"><span class="avatar">${incoming.profile.photo?`<img src="${incoming.profile.photo}" alt="Profile photo in this backup">`:esc(incoming.profile.name.slice(0,1))}</span><div><strong>${esc(incoming.profile.name)}</strong><p>${esc(incoming.profile.subtitle)}${incoming.demo?' &middot; Sample workspace':''}</p></div></div>
    <div class="restore-counts"><div><strong>${incoming.assets.length}</strong><span>Accounts</span></div><div><strong>${incoming.entries.length}</strong><span>Transactions</span></div><div><strong>${incoming.loans.length}</strong><span>Loans</span></div><div><strong>${incoming.loanPayments.length}</strong><span>Repayments</span></div></div>
    <div class="restore-details"><span>${icon('check')}${imageCount} saved ${imageCount===1?'image':'images'}</span><span>${icon('check')}${incoming.snapshots.length} valuation ${incoming.snapshots.length===1?'snapshot':'snapshots'}</span><span>${icon('check')}Profile &amp; currency settings</span></div>
    ${older?'<div class="inline-note warning" style="margin-bottom:17px">'+icon('clock')+'<span>This file is older than the workspace currently open. Changes made after this backup will not be in the restored version.</span></div>':''}
    <p class="restore-warning"><strong>This replaces the workspace in this browser. It does not merge records.</strong><br>${state.demo?'Your sample data will be replaced.':`Current workspace: ${state.assets.length} accounts, ${state.entries.length} transactions, ${state.loans.length} loans and ${state.loanPayments.length} repayments.`} ${cloud.linked?'Cloud sync will also replace the cloud workspace; a server recovery snapshot is kept.':'Other devices are not changed unless you later upload this workspace.'}</p>
    ${keepable?'<div class="restore-save-current"><label class="checkbox-line"><input type="checkbox" id="restore-keep-copy" checked><span>Keep a local pre-restore copy of my current workspace.</span></label><p>This provides one-step recovery on this browser only. Download your current backup for a separate, portable copy.</p></div>':''}
    <label class="checkbox-line"><input type="checkbox" id="restore-confirm"><span>I understand that these records will replace the current workspace.</span></label></div>
    <div class="modal-footer restore-footer"><button class="btn btn-secondary btn-small" data-action="export" ${persistenceBlocked?'disabled':''}>${icon('download')}Download current first</button><div><button class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" id="restore-apply" data-action="apply-restore" disabled>${icon('check')}Restore workspace</button></div></div>`);
}
function applyRestore(){
  const draft=modalDraft;
  if(draft?.type!=='restore'||!$('#restore-confirm')?.checked)return;
  if(pendingExternal)return formError('Another tab changed this workspace. Close this preview and open the backup again.');
  if(draft.original!==JSON.stringify(state)){
    // A download updates only backup timestamps. Any ledger changes invalidate the preview.
    const before=JSON.parse(draft.original),now=JSON.parse(JSON.stringify(state));
    before.updatedAt=now.updatedAt;before.settings.lastBackup=now.settings.lastBackup;
    if(JSON.stringify(before)!==JSON.stringify(now))return formError('The current workspace changed. Close this preview and review the backup again.');
  }
  const keep=$('#restore-keep-copy')?.checked||false;
  const next=validateState(draft.incoming);
  try{
    if(keep){const raw=corruptRaw||JSON.stringify(state);localStorage.setItem(RECOVERY_KEY,JSON.stringify({savedAt:new Date().toISOString(),raw}));}
    // localStorage writes are atomic. Do not replace the active state unless saving succeeds.
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  }catch(err){return formError('Restore stopped: this browser could not save the workspace. Your current records are unchanged. Download the current backup, then free browser storage or use a regular browser window. If only the extra recovery copy is too large, uncheck it after downloading your current backup.');}
  state=next;storageOk=true;persistenceBlocked=false;corruptRaw='';pendingExternal=null;resetFilters();
  cloud.replaceNext=true;cloudLocalChanged();
  closeModal();setPage('overview');
  toast('Workspace restored. Your saved accounts, loans, pictures and history are ready.');
}
async function shareBackup(){
  try{
    if(!navigator.share||!navigator.canShare){exportBackup();return;}
    const prepared=transferableState(),file=new File([prepared.text],prepared.name,{type:'application/json'});
    if(!navigator.canShare({files:[file]})){downloadBlob(prepared.name,prepared.text);render();toast('Backup prepared. Save it to your private Files or Downloads folder.');return;}
    await navigator.share({files:[file],title:'Assets workspace backup'});
    render();toast('Backup handed to your chosen app. Keep a private copy.');
  }catch(err){if(err.name==='AbortError')return;toast('Sharing was unavailable. Use Download full backup instead.',true);}
}
function reviewRecovery(){
  const r=getRecovery();if(!r)return toast('No previous workspace is saved in this browser.',true);
  try{restorePreview(validateState(JSON.parse(r.raw)),'Previous workspace - '+formatStamp(r.savedAt),new Blob([r.raw]).size,true);}catch(err){infoModal('Recovery copy available','<p>This earlier copy cannot be restored automatically. Download it to keep the original records.</p><button class="btn btn-primary" data-action="export-previous">'+icon('download')+'Download recovery copy</button>');}
}
function mobileMore(){
  modalDraft={type:'more'};
  showModal(`${modalHeader('Your workspace','Everything else, close at hand.')}<div class="modal-body"><div class="more-profile">${avatar()}<div><strong>${esc(state.profile.name)}${state.profile.badge?badge():''}</strong><small>${esc(state.profile.subtitle)}</small></div></div><div class="more-menu">
    <button data-action="profile">${icon('user')}<span>Edit profile<small>Your name, photo and badge</small></span>${icon('chevron')}</button>
    <button data-page="backup">${icon('folder')}<span>Backup &amp; restore<small>Move your workspace between devices</small></span>${icon('chevron')}</button>
    <button data-page="quick">${icon('bolt')}<span>Quick Update<small>Fast entries, the same full workspace</small></span>${icon('chevron')}</button><button data-page="tracker">${icon('chart')}<span>Daily tracker<small>All your trading results</small></span>${icon('chevron')}</button><button data-page="cloud">${icon('globe')}<span>Cloud &amp; daily backups<small>Private sync and daily snapshots</small></span>${icon('chevron')}</button><button data-action="install-help">${icon('phone')}<span>Phone shortcut<small>Add Quick Update to your home screen</small></span>${icon('chevron')}</button><button data-page="activity">${icon('clock')}<span>Activity log<small>All account transactions</small></span>${icon('chevron')}</button>
    <button data-page="settings">${icon('settings')}<span>Settings<small>Currencies, privacy and workspace</small></span>${icon('chevron')}</button>
    <button data-action="help">${icon('info')}<span>How it works</span>${icon('chevron')}</button></div></div>` ,true);
}
function updateMobileNav(){
  $$('.mobile-tab[data-page]').forEach(b=>{const active=b.dataset.page===ui.page;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  const more=$('#mobile-more');if(more){const active=['activity','settings','backup','cloud','tracker'].includes(ui.page);more.classList.toggle('active',active);more.setAttribute('aria-current',active?'page':'false');}
  const nav=$('.nav-item[data-action="open-backup"]');if(nav){nav.classList.toggle('active',ui.page==='backup');nav.setAttribute('aria-current',ui.page==='backup'?'page':'false');}
}
function handleUpgradeAction(action,el){
  if(action==='pick-date'){openDatePicker(el.dataset.target);return true;}
  if(action==='mobile-more'){mobileMore();return true;}
  if(action==='apply-restore'){applyRestore();return true;}
  if(action==='share-backup'){shareBackup();return true;}
  if(action==='review-recovery'){reviewRecovery();return true;}
  if(action==='export-previous'){const r=getRecovery();if(r)downloadBlob('assets-before-restore-'+today()+'.json',r.raw);return true;}
  return false;
}
function dateDisplay(value,mode='date'){
  if(!value)return mode==='month'?'Choose a month':'Choose a date';
  const d=dateObj(mode==='month'?value+'-01':value);
  return d.toLocaleDateString('en-GB',mode==='month'?{month:'long',year:'numeric'}:{day:'numeric',month:'short',year:'numeric'});
}
function enhanceDateInputs(root=document){
  $$('input[type="date"],input[type="month"]',root).forEach(input=>{
    if(input.dataset.dateEnhanced)return;
    if(!input.id)input.id='date-'+uid();
    const label=$$('label[for]',root).find(l=>l.htmlFor===input.id);
    const text=(label?.childNodes[0]?.textContent||input.getAttribute('aria-label')||'Choose a date').trim();
    input.dataset.dateEnhanced='true';input.dataset.dateLabel=text;input.classList.add('date-native');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
    const wrap=document.createElement('div');wrap.className='date-control';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const btn=document.createElement('button');btn.type='button';btn.id=input.id+'-trigger';btn.className='date-trigger';btn.dataset.action='pick-date';btn.dataset.target=input.id;btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-controls','date-picker');btn.setAttribute('aria-expanded','false');btn.disabled=input.disabled;
    wrap.appendChild(btn);if(label)label.htmlFor=btn.id;refreshDateTrigger(input);
    input.addEventListener('invalid',e=>{e.preventDefault();if(!$('#date-picker').open)openDatePicker(input.id);toast('Choose a valid '+text.toLowerCase()+'.',true);});
    input.addEventListener('change',()=>refreshDateTrigger(input));
  });
}
function refreshDateTrigger(input){
  const b=document.getElementById(input.id+'-trigger');if(!b)return;
  b.disabled=input.disabled;
  b.innerHTML='<span'+(!input.value?' class="date-placeholder"':'')+'>'+esc(dateDisplay(input.value,input.type))+'</span>'+icon('calendar');
  b.setAttribute('aria-label',(input.dataset.dateLabel||'Date')+': '+dateDisplay(input.value,input.type));
}
function enhanceUI(root=document){
  enhanceDateInputs(root);
  $$('input[type="number"]',root).forEach(input=>input.setAttribute('inputmode','decimal'));
  $$('table',root).forEach(table=>{
    if(!table.querySelector('thead'))return;
    table.classList.add('mobile-ledger');
    const head=table.querySelector('thead th:nth-child(2)');
    if(head?.textContent.includes('Loan'))table.classList.add('payment-ledger');
    const labels=$$('thead th',table).map(h=>h.textContent.trim());
    $$('tbody tr',table).forEach(row=>$$('td',row).forEach((td,i)=>{if(!td.hasAttribute('data-label'))td.dataset.label=labels[i]||'';}));
  });
}
function pickerValueAllowed(value){
  const p=pickerSession;if(!p)return false;
  if(p.mode==='month'?!/^\d{4}-(0[1-9]|1[0-2])$/.test(value):!validDate(value))return false;
  return (!p.min||value>=p.min)&&(!p.max||value<=p.max);
}
function pickerMonthAllowed(y,m){
  const p=pickerSession,key=`${String(y).padStart(4,'0')}-${String(m+1).padStart(2,'0')}`;
  return y>=1&&y<=9999&&(!p.min||key>=p.min.slice(0,7))&&(!p.max||key<=p.max.slice(0,7));
}
function openDatePicker(id){
  const input=document.getElementById(id);if(!input||input.disabled)return;
  closeDatePicker(false);
  const mode=input.type==='month'?'month':'date',current=input.value;
  let initial=current||(mode==='month'?today().slice(0,7):today());
  if(input.min&&initial<input.min)initial=input.min;if(input.max&&initial>input.max)initial=input.max;
  const d=dateObj(mode==='month'?initial+'-01':initial);
  pickerSession={id,input,mode,value:current,min:input.min,max:input.max,required:input.required,year:d.getFullYear(),month:d.getMonth(),focus:initial};
  const dialog=$('#date-picker');dialog.innerHTML='';renderDatePicker();
  document.getElementById(id+'-trigger')?.setAttribute('aria-expanded','true');
  document.body.classList.add('modal-open');dialog.showModal();positionDatePicker();
  requestAnimationFrame(()=>{const target=$('[tabindex="0"]',dialog)||$('.dp-apply',dialog);target?.focus({preventScroll:true});});
}
function renderDatePicker(){
  const p=pickerSession;if(!p)return;
  const firstYear=p.min?Number(p.min.slice(0,4)):Math.min(1900,p.year),lastYear=p.max?Number(p.max.slice(0,4)):Math.max(2100,p.year);
  const years=Array.from({length:Math.max(1,lastYear-firstYear+1)},(_,i)=>firstYear+i);
  const prev=new Date(p.year,p.month-1,1),next=new Date(p.year,p.month+1,1);
  let selection=p.value?dateDisplay(p.value,p.mode):'No date selected';
  const yearOptions=years.map(y=>`<option value="${y}" ${y===p.year?'selected':''}>${y}</option>`).join('');
  const monthOptions=MONTH_NAMES.map((name,m)=>`<option value="${m}" ${m===p.month?'selected':''} ${pickerMonthAllowed(p.year,m)?'':'disabled'}>${name}</option>`).join('');
  let calendar='',presets=[];
  if(p.mode==='date'){
    const first=new Date(p.year,p.month,1,12),offset=(first.getDay()+6)%7,start=new Date(p.year,p.month,1-offset,12),daysInMonth=new Date(p.year,p.month+1,0).getDate(),cells=Math.ceil((offset+daysInMonth)/7)*7;
    const focus=p.focus&&pickerValueAllowed(p.focus)?p.focus:p.value||localDate(first);
    calendar='<div class="dp-weekdays" aria-hidden="true">'+['M','T','W','T','F','S','S'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="dp-grid" role="group" aria-label="'+MONTH_NAMES[p.month]+' '+p.year+'">';
    for(let i=0;i<cells;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const key=localDate(d),selected=key===p.value,allowed=pickerValueAllowed(key);
      calendar+=`<button type="button" class="dp-day ${d.getMonth()!==p.month?'other-month':''} ${key===today()?'is-today':''} ${selected?'selected':''}" data-dp-date="${key}" ${allowed?'':'disabled'} tabindex="${key===focus&&allowed?0:-1}" aria-label="${esc(d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}" aria-pressed="${selected}" ${key===today()?'aria-current="date"':''}>${d.getDate()}</button>`;
    }
    calendar+='</div>';
    presets=(p.max&&p.max<=today()?[[today(),'Today'],[shiftDate(-1),'Yesterday'],[shiftDate(-7),'7 days ago']]:[[today(),'Today'],[shiftDate(1),'Tomorrow'],[shiftDate(7),'+7 days'],[shiftDate(30),'+30 days']]).filter(([v])=>pickerValueAllowed(v));
  }else{
    calendar='<div class="dp-month-grid" role="group" aria-label="Choose a month">'+MONTH_NAMES.map((name,m)=>{const key=`${String(p.year).padStart(4,'0')}-${String(m+1).padStart(2,'0')}`;return `<button type="button" class="dp-month-choice ${key===p.value?'selected':''}" data-dp-month="${key}" tabindex="${key===(p.focus||p.value)?0:-1}" ${pickerValueAllowed(key)?'':'disabled'} aria-pressed="${key===p.value}">${name.slice(0,3)}</button>`;}).join('')+'</div>';
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);
    presets=[[today().slice(0,7),'This month'],[localDate(d).slice(0,7),'Last month']].filter(([v])=>pickerValueAllowed(v));
  }
  const prevAllowed=p.mode==='month'?p.year>firstYear:pickerMonthAllowed(prev.getFullYear(),prev.getMonth()),nextAllowed=p.mode==='month'?p.year<lastYear:pickerMonthAllowed(next.getFullYear(),next.getMonth());
  $('#date-picker').innerHTML=`<div class="dp-head"><div><div class="dp-eyebrow">${p.mode==='month'?'SELECT MONTH':'SELECT DATE'}</div><h2 id="dp-title">${esc(p.input.dataset.dateLabel||'Choose a date')}</h2></div><button type="button" class="icon-button" data-dp="cancel" aria-label="Close date picker">${icon('close')}</button></div><div class="dp-body"><div class="dp-month-bar"><button type="button" class="icon-button" data-dp="previous" aria-label="Previous ${p.mode==='month'?'year':'month'}" ${prevAllowed?'':'disabled'}>${icon('chevron')}</button><div class="dp-month-selects">${p.mode==='date'?`<select id="dp-month" aria-label="Month">${monthOptions}</select>`:''}<select id="dp-year" aria-label="Year">${yearOptions}</select></div><button type="button" class="icon-button" data-dp="next" aria-label="Next ${p.mode==='month'?'year':'month'}" ${nextAllowed?'':'disabled'}>${icon('chevron')}</button></div>${calendar}<div class="dp-presets">${presets.map(([v,label])=>`<button type="button" data-dp-preset="${v}">${label}</button>`).join('')}</div><div class="dp-selection" aria-live="polite">${icon('calendar')}<span>${esc(selection)}</span></div></div><div class="dp-footer"><button type="button" class="dp-clear" data-dp="clear" ${p.required?'disabled title="This date is required"':''}>Clear</button><button type="button" class="btn btn-secondary" data-dp="cancel">Cancel</button><button type="button" class="btn btn-primary dp-apply" data-dp="apply" ${(!p.value&&p.required||p.value&&!pickerValueAllowed(p.value))?'disabled':''}>${icon('check')}Use ${p.mode==='month'?'month':'date'}</button></div>`;
  const grid=$('.dp-grid')||$('.dp-month-grid');if(grid&&!grid.querySelector('[tabindex="0"]'))grid.querySelector('button:not(:disabled)')?.setAttribute('tabindex','0');
  if($('#date-picker').open)positionDatePicker();
}
function positionDatePicker(){
  const p=pickerSession,d=$('#date-picker');if(!p||!d.open)return;
  if(matchMedia('(max-width:540px)').matches){d.style.left='';d.style.top='';return;}
  const b=document.getElementById(p.id+'-trigger'),r=b?.getBoundingClientRect();if(!r)return;
  const height=d.getBoundingClientRect().height,width=d.getBoundingClientRect().width,vh=window.visualViewport?.height||window.innerHeight;
  const left=Math.max(12,Math.min(r.left,innerWidth-width-12));let top=r.bottom+8;
  if(top+height>vh-12)top=r.top-height-8;
  top=Math.max(12,Math.min(top,vh-height-12));d.style.left=left+'px';d.style.top=top+'px';
}
function closeDatePicker(focus=true){
  const p=pickerSession,dialog=$('#date-picker');if(dialog?.open)dialog.close();pickerSession=null;
  if(p){const b=document.getElementById(p.id+'-trigger');b?.setAttribute('aria-expanded','false');if(focus&&b?.isConnected)b.focus({preventScroll:true});}
  if(!$('#modal')?.open)document.body.classList.remove('modal-open');
}
function selectPickerValue(value){
  const p=pickerSession;if(!p||value&&!pickerValueAllowed(value))return;
  p.value=value;p.focus=value;
  if(value){const d=dateObj(p.mode==='month'?value+'-01':value);p.year=d.getFullYear();p.month=d.getMonth();}
  renderDatePicker();
  const selected=$('.dp-day.selected,.dp-month-choice.selected',$('#date-picker'));selected?.focus({preventScroll:true});
}
function applyPickerValue(){
  const p=pickerSession;if(!p||(!p.value&&p.required)||p.value&&!pickerValueAllowed(p.value))return;
  const input=p.input;if(!input.isConnected){closeDatePicker(false);return;}
  input.value=p.value;refreshDateTrigger(input);closeDatePicker();
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
}
function initInterfaceUpgrade(){
  const picker=document.createElement('dialog');picker.id='date-picker';picker.className='date-picker';picker.setAttribute('aria-labelledby','dp-title');picker.setAttribute('aria-modal','true');document.body.appendChild(picker);
  picker.addEventListener('cancel',e=>{e.preventDefault();closeDatePicker();});
  picker.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target===picker){const r=picker.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDatePicker();return;}
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.dpDate){selectPickerValue(b.dataset.dpDate);return;}
    if(b.dataset.dpMonth){selectPickerValue(b.dataset.dpMonth);return;}
    if(b.dataset.dpPreset){selectPickerValue(b.dataset.dpPreset);return;}
    const action=b.dataset.dp,p=pickerSession;if(!p)return;
    if(action==='cancel'){closeDatePicker();return;}
    if(action==='apply'){applyPickerValue();return;}
    if(action==='clear'){if(!p.required)selectPickerValue('');return;}
    if(action==='previous'||action==='next'){
      const delta=action==='previous'?-1:1;
      if(p.mode==='month')p.year+=delta;else {const d=new Date(p.year,p.month+delta,1);p.year=d.getFullYear();p.month=d.getMonth();}
      p.focus='';renderDatePicker();$('[data-dp="'+action+'"]',picker)?.focus({preventScroll:true});
    }
  });
  picker.addEventListener('change',e=>{
    e.stopPropagation();if(!pickerSession)return;
    const id=e.target.id,p=pickerSession;
    if(id==='dp-month')p.month=Number(e.target.value);if(id==='dp-year')p.year=Number(e.target.value);
    if(!pickerMonthAllowed(p.year,p.month)){
      const valid=Array.from({length:12},(_,m)=>m).filter(m=>pickerMonthAllowed(p.year,m));if(valid.length)p.month=valid[0];
    }
    p.focus='';renderDatePicker();$('#'+id,picker)?.focus({preventScroll:true});
  });
  picker.addEventListener('keydown',e=>{
    const target=e.target.closest('[data-dp-date]');if(!target||!pickerSession)return;
    const d=dateObj(target.dataset.dpDate),key=e.key;
    if(key==='ArrowLeft')d.setDate(d.getDate()-1);else if(key==='ArrowRight')d.setDate(d.getDate()+1);else if(key==='ArrowUp')d.setDate(d.getDate()-7);else if(key==='ArrowDown')d.setDate(d.getDate()+7);else if(key==='Home')d.setDate(d.getDate()-(d.getDay()+6)%7);else if(key==='End')d.setDate(d.getDate()+6-(d.getDay()+6)%7);else if(key==='PageUp'||key==='PageDown'){
      const wanted=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+(key==='PageUp'?-1:1)*(e.shiftKey?12:1));d.setDate(Math.min(wanted,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
    }else return;
    e.preventDefault();let value=localDate(d);const p=pickerSession;if(p.min&&value<p.min)value=p.min;if(p.max&&value>p.max)value=p.max;if(!pickerValueAllowed(value))return;
    const next=dateObj(value);p.year=next.getFullYear();p.month=next.getMonth();p.focus=value;renderDatePicker();$('[data-dp-date="'+value+'"]',picker)?.focus({preventScroll:true});
  });
  const observer=new MutationObserver(records=>{
    const roots=new Set();for(const r of records){if(r.addedNodes.length){const host=r.target.closest?.('#main,#modal-content');if(host)roots.add(host);}}
    roots.forEach(enhanceUI);
  });
  observer.observe($('#main'),{childList:true,subtree:true});observer.observe($('#modal-content'),{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target.id==='restore-confirm'){const button=$('#restore-apply');if(button)button.disabled=!e.target.checked;}});
  document.addEventListener('dragover',e=>{const drop=e.target.closest?.('[data-backup-drop]');if(drop){e.preventDefault();e.dataTransfer.dropEffect='copy';drop.classList.add('drag-over');}});
  document.addEventListener('dragleave',e=>{const drop=e.target.closest?.('[data-backup-drop]');if(drop&&!drop.contains(e.relatedTarget))drop.classList.remove('drag-over');});
  document.addEventListener('drop',e=>{const drop=e.target.closest?.('[data-backup-drop]');if(!drop)return;e.preventDefault();drop.classList.remove('drag-over');if(e.dataTransfer.files.length!==1){toast('Choose one JSON backup at a time.',true);return;}importBackup(e.dataTransfer.files[0]);});
  $('#modal').addEventListener('close',()=>{if(!$('#modal').open){closeDatePicker(false);document.body.classList.remove('modal-open');}});
  window.addEventListener('resize',positionDatePicker);window.visualViewport?.addEventListener('resize',positionDatePicker);
}

document.addEventListener('input',event=>{
  const id=event.target.id;
  if(id==='loan-outstanding'&&modalDraft?.type==='loan')modalDraft.outstandingTouched=true;
  if(id==='loan-principal'&&modalDraft?.type==='loan'&&!modalDraft.outstandingTouched)$('#loan-outstanding').value=event.target.value;
  if(['loan-principal','loan-outstanding'].includes(id))updateLoanPreview();
  if(['payment-principal','payment-interest','payment-date'].includes(id))updateLoanPaymentPreview();
});
document.addEventListener('change',event=>{
  const id=event.target.id;
  if(['loan-move','loan-account','loan-currency'].includes(id))updateLoanPreview();
  if(['payment-move','payment-account'].includes(id))updateLoanPaymentPreview();
  if(id==='cash-account'){ui.cashAccount=event.target.value;render();}
  if(id==='cash-month'&&/^\d{4}-\d{2}$/.test(event.target.value)){ui.cashMonth=event.target.value;render();}
  if(id==='entry-category')entryDraftFromForm();
});

document.addEventListener('click',event=>{const page=event.target.closest('[data-page]');if(page){event.preventDefault();setPage(page.dataset.page);return;}const action=event.target.closest('[data-action]');if(action){event.preventDefault();handleAction(action.dataset.action,action);return;}if(ui.openMenu&&!event.target.closest('.asset-menu')){ui.openMenu=null;const grid=$('#asset-grid');if(grid)grid.innerHTML=assetCards();}});
document.addEventListener('input',event=>{if(['entry-amount','entry-note','entry-date','entry-counterparty'].includes(event.target.id))updateEntryPreview();});
document.addEventListener('change',event=>{const t=event.target,id=t.id;
  if(id==='display-currency'||id==='setting-display'){state.settings.displayCurrency=t.value;commit('',{snapshot:false});}
  else if(id==='setting-badge'){state.profile.badge=t.checked;commit('',{snapshot:false});}
  else if(id==='setting-hide'){state.settings.hideBalances=t.checked;commit('',{snapshot:false});}
  else if(id==='asset-logo-file'&&t.files[0])handleImageUpload(t.files[0],'asset');
  else if((id==='profile-photo-file'||id==='profile-camera-file')&&t.files[0])handleImageUpload(t.files[0],'profile');
  else if(id==='asset-category'){syncAssetMode();if(!modalDraft.includedTouched)$('#asset-included').checked=t.value!=='prop';if(!modalDraft.logo)$('#asset-logo-preview').innerHTML=assetLogo({category:t.value,name:'Asset',symbol:$('#asset-symbol').value,logo:''});if(t.value==='crypto')$('.quantity-details').open=true;}
  else if(id==='asset-included'){modalDraft.includedTouched=true;}
  else if(id==='asset-currency'){const custom=t.value==='__custom__';$('#custom-currency-fields').classList.toggle('hidden',!custom);$('#custom-code').required=custom;$('#custom-rate').required=custom;$$('.form-currency').forEach(el=>el.textContent=custom?'New currency':t.value);}
  else if(id==='entry-account'){entryDraftFromForm();const cash=assetById(t.value)?.category==='cash';if(!allowedEntryKinds(assetById(t.value)).includes(modalDraft.kind))modalDraft.kind=cash?'income':'profit';if(modalDraft.destination===t.value)modalDraft.destination=state.assets.find(a=>a.id!==t.value)?.id||'';modalDraft.cashCategory='';renderEntryForm();}
  else if(id==='entry-destination'||id==='entry-date'){updateEntryPreview();}
  else if(id==='tracker-account'){ui.trackerAccount=t.value;ui.trackerDate='';render();}
  else if(id==='activity-account'){ui.activityAccount=t.value;ui.activityPage=1;$('#activity-content').innerHTML=activityContents();}
  else if(id==='activity-kind'){ui.activityKind=t.value;ui.activityPage=1;$('#activity-content').innerHTML=activityContents();}
  else if(id==='import-file'){importBackup(t.files[0]);t.value='';}
});
document.addEventListener('submit',event=>{event.preventDefault();if(pendingExternal){formError('Another tab changed this workspace. Close this form, then reopen it with the latest data.');return;}const form=event.target;if(!form.reportValidity())return;
  if(form.id==='cloud-login-form')signInCloud();
  else if(form.id==='quick-balance-form')saveQuickBalance();
  else if(form.id==='asset-form')saveAsset();
  else if(form.id==='entry-form')saveEntry();
  else if(form.id==='loan-form')saveLoan();
  else if(form.id==='repayment-form')saveLoanPayment();
  else if(form.id==='profile-form'){const name=$('#profile-name').value.trim();if(!name)return formError('Please enter your display name.');state.profile={name,subtitle:$('#profile-subtitle').value.trim()||'Personal portfolio',photo:modalDraft.photo,badge:$('#profile-badge').checked,workspaceLabel:$('#profile-workspace-label').value.trim()||'PRIVATE WORKSPACE',showDate:$('#profile-show-date').checked,showWorkspaceLabel:$('#profile-show-label').checked};closeModal();commit('Profile updated.',{snapshot:false});}
  else if(form.id==='currency-form'){const code=$('#currency-code').value.trim().toUpperCase(),r=Number($('#currency-rate').value);if(!/^[A-Z][A-Z0-9]{1,9}$/.test(code))return formError('Use a currency code such as EUR, AED or INR.');if(Object.hasOwn(state.settings.rates,code))return formError('This currency already exists. Update it in Settings instead.');if(!validNumber(r,1e-12,1e12))return formError('Enter a positive conversion rate.');state.settings.rates[code]=r;closeModal();commit('Currency added. You can now select it for an asset.');}
  else if(form.id==='daily-email-form'){const enabled=$('#daily-email-enabled').checked,address=$('#daily-email-address').value.trim();if(enabled&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return toast('Enter a valid email address for the daily status.',true);state.settings.dailyEmailEnabled=enabled;state.settings.dailyEmailAddress=address;commit(enabled?'Daily email preference saved.':'Daily email turned off.',{snapshot:false});}
  else if(form.id==='rates-form'){const next={...state.settings.rates};for(const el of $$('[data-rate]',form)){const value=Number(el.value);if(!validNumber(value,1e-12,1e12)){toast('All exchange rates must be positive numbers.',true);return;}next[el.dataset.rate]=value;}state.settings.rates=next;commit('Conversion rates saved. Your USDT totals are updated.');}
});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
$('#modal').addEventListener('close',()=>{modalDraft=null;if(pendingExternal){state=pendingExternal;pendingExternal=null;resetFilters();render();toast('Latest workspace loaded from the other tab.');}});
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(['overview','cash','loans','tracker','activity','settings','backup','quick','cloud'].includes(p)&&ui.page!==p){ui.page=p;render();}});
window.addEventListener('beforeunload',event=>{if(!storageOk){event.preventDefault();event.returnValue='Unsaved changes. Export a backup before leaving.';}});
window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY||!event.newValue)return;try{const updated=validateState(JSON.parse(event.newValue));if($('#modal').open){pendingExternal=updated;formError('This workspace changed in another tab. Close this form to load the latest version.');toast('Another tab updated this workspace. Close this form before continuing.',true);return;}state=updated;render();toast('Workspace updated from another tab.');}catch(err){toast('Another tab changed the saved data, but it could not be read.',true);}});
// v4: optional private cloud, real backend snapshots, and a phone-first shortcut.
function cloudStatusText(){
  if(cloud.busy)return 'Syncing...';
  if(cloud.reconcile)return 'Review device copies';
  if(cloud.error)return 'Sync needs attention';
  if(!cloud.configured)return 'Local only';
  if(!cloud.signedIn)return 'Sign in to sync';
  if(!cloud.linked)return 'Choose your workspace';
  if(cloud.dirty)return navigator.onLine?'Changes waiting to sync':'Offline - saved here';
  return 'Cloud up to date';
}
function paintCloudStatus(){
  $$('[data-cloud-status]').forEach(el=>{el.textContent=cloudStatusText();el.closest('button')?.classList.toggle('needs-attention',Boolean(cloud.error||cloud.reconcile));});
  const note=$('#local-card-copy');if(note)note.innerHTML=cloud.linked&&cloud.signedIn?'Saved here. Sync connected.<br>Check daily backup status.':'Saved on this device.<br>Cloud sync is optional.';
}
function saveCloudMeta(){
  try{localStorage.setItem(CLOUD_META_KEY,JSON.stringify({owner:cloud.user?.id||cloud.owner||'',revision:cloud.revision,dirty:cloud.dirty,lastSync:cloud.lastSync,timezone:cloud.timezone}));}catch{}
}
function cloudLocalChanged(){
  if(cloud.applying)return;
  cloud.generation++;cloud.dirty=true;
  if(cloud.owner||cloud.user?.id)saveCloudMeta();
  clearTimeout(cloud.timer);cloud.timer=setTimeout(()=>syncCloud(),850);paintCloudStatus();
}
async function cloudRequest(action,method='GET',body){
  if(location.protocol==='file:')throw Error('Open the deployed HTTPS website to use cloud sync.');
  const response=await fetch('/api/vault?action='+action,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Vault-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(26000)});
  let result;try{result=await response.json();}catch{throw Error('The backend is not available on this address. Deploy the complete Vercel package.');}
  if(!response.ok){const error=Error(result.error||'Cloud request failed. Your local data is unchanged.');error.status=response.status;throw error;}
  return result;
}
function cloudError(error){
  cloud.error=error.message||'Connection unavailable. Your changes remain on this device.';
  if(error.status===401){cloud.signedIn=false;cloud.linked=false;}
  paintCloudStatus();
}
function stableRecord(s){
  // JSONB reorders object keys; compare their meaning, not their string order.
  const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
  const copy=structuredClone(s);delete copy.updatedAt;if(copy.settings)delete copy.settings.lastBackup;
  return JSON.stringify(normalize(copy));
}
function adoptCloud(workspace){
  const next=validateState(workspace.data);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
  catch{throw Error('This browser cannot save the cloud workspace. Export your current records and free some browser storage first.');}
  cloud.applying=true;state=next;storageOk=true;persistenceBlocked=false;corruptRaw='';pendingExternal=null;
  cloud.revision=workspace.revision;cloud.timezone=workspace.timezone||cloud.timezone;cloud.owner=cloud.user.id;cloud.linked=true;cloud.dirty=false;cloud.lastSync=workspace.updated_at;cloud.reconcile=null;cloud.error='';cloud.pendingMutation=null;cloud.applying=false;saveCloudMeta();resetFilters();render();
}
async function getCloudWorkspace({initial=false}={}){
  const result=await cloudRequest('workspace');cloud.health=result.status||{};
  const remote=result.workspace;
  if(!remote){cloud.remote=null;cloud.linked=false;cloud.revision=0;cloud.reconcile={remote:null,initial:true};return;}
  remote.data=validateState(remote.data);cloud.remote=remote;
  if(!cloud.linked || cloud.owner!==cloud.user.id){cloud.reconcile={remote,initial:true};return;}
  if(cloud.dirty){
    if(remote.revision!==cloud.revision){
      // A network response may have been lost after the server committed it.
      if(!$('#modal').open&&stableRecord(state)===stableRecord(remote.data)){adoptCloud(remote);return;}
      cloud.reconcile={remote,initial:false};
    }
    return;
  }
  if(remote.revision!==cloud.revision || initial){
    if($('#modal').open){cloud.reconcile={remote,initial:false};return;}
    adoptCloud(remote);
  }
}
async function initCloud(){
  try{
    const raw=localStorage.getItem(CLOUD_META_KEY);if(raw){const m=JSON.parse(raw);cloud.owner=typeof m.owner==='string'?m.owner:'';cloud.revision=Number.isSafeInteger(m.revision)?m.revision:0;cloud.dirty=Boolean(m.dirty);cloud.lastSync=m.lastSync||null;cloud.timezone=m.timezone||cloud.timezone;}
    if(location.protocol==='file:'){paintCloudStatus();return;}
    const session=await cloudRequest('session');cloud.configured=session.configured;cloud.signedIn=session.authenticated;cloud.user=session.user||null;
    if(session.authenticated){cloud.linked=cloud.owner===session.user.id&&cloud.revision>0;await getCloudWorkspace({initial:true});if(cloud.dirty&&!cloud.reconcile)syncCloud();}
  }catch(e){cloud.configured=false;cloud.signedIn=false;cloud.error=e?.message||'Cloud unavailable. Local tools are still available.';}
  paintCloudStatus();if(ui.page==='cloud')render();
}
async function signInCloud(){
  const form=$('#cloud-login-form'),button=$('button[type=submit]',form);if(!form.reportValidity())return;
  button.disabled=true;$('#cloud-login-error').textContent='';
  try{
    const result=await cloudRequest('login','POST',{email:$('#cloud-email').value.trim(),password:$('#cloud-password').value});
    $('#cloud-password').value='';cloud.user=result.user;cloud.configured=true;cloud.signedIn=true;cloud.error='';cloud.linked=cloud.owner===result.user.id&&cloud.revision>0;
    await getCloudWorkspace({initial:true});render();
    if(cloud.dirty&&cloud.linked&&!cloud.reconcile)syncCloud();
  }catch(e){const el=$('#cloud-login-error');if(el)el.textContent=e.message;}
  finally{if(button.isConnected)button.disabled=false;}
}
async function syncCloud(){
  if(cloud.busy||!cloud.signedIn||!cloud.linked||cloud.reconcile||!cloud.dirty||persistenceBlocked||!navigator.onLine)return;
  const run=async()=>{
    if(cloud.busy||!cloud.signedIn||cloud.reconcile||!cloud.dirty)return;
    cloud.busy=true;cloud.error='';paintCloudStatus();
    const generation=cloud.generation;
    try{
      if(state.demo)throw Error('Restore your own records or start fresh before syncing.');
      const data=validateState(state);
      if(new Blob([JSON.stringify(data)]).size>3*1024*1024)throw Error('This workspace exceeds the 3 MB cloud limit. Export a local backup, then reduce oversized images.');
      const canonical=stableRecord(data)+'|'+cloud.timezone+'|'+Boolean(cloud.replaceNext);
      if(!cloud.pendingMutation||cloud.pendingMutation.content!==canonical)cloud.pendingMutation={id:crypto.randomUUID(),content:canonical,data};
      const mutation=cloud.pendingMutation;
      const result=await cloudRequest('workspace','PUT',{data:mutation.data,expectedRevision:cloud.revision,mutationId:mutation.id,timezone:cloud.timezone,replace:cloud.replaceNext===true});
      cloud.revision=result.revision;cloud.lastSync=result.updated_at;cloud.owner=cloud.user.id;cloud.replaceNext=false;cloud.pendingMutation=null;cloud.dirty=generation!==cloud.generation;saveCloudMeta();
    }catch(e){
      if(e.status===409){try{const data=await cloudRequest('workspace');cloud.remote=data.workspace;cloud.health=data.status;cloud.reconcile={remote:data.workspace,initial:false};}catch{} }
      cloudError(e);
    }finally{
      cloud.busy=false;paintCloudStatus();if(ui.page==='cloud'&&!$('#modal').open)render();
      if(cloud.dirty&&!cloud.reconcile&&cloud.signedIn){clearTimeout(cloud.timer);cloud.timer=setTimeout(syncCloud,cloud.error?15000:800);}
    }
  };
  if(navigator.locks)await navigator.locks.request('vault-cloud-write',run);else await run();
}
async function pollCloud(){
  if(!cloud.signedIn||cloud.busy||document.hidden||!navigator.onLine)return;
  if(cloud.dirty&&!cloud.reconcile){await syncCloud();return;}
  if(cloud.reconcile)return;
  cloud.busy=true;
  try{await getCloudWorkspace();cloud.error='';}catch(e){cloudError(e);}finally{cloud.busy=false;paintCloudStatus();if(ui.page==='cloud'&&!$('#modal').open)render();}
}
async function chooseCloudCopy(){
  if(cloud.busy)return;
  confirmAction('Continue with the cloud copy?',`<p>This replaces this browser's workspace with your private cloud records. Other devices and the cloud copy are not overwritten.</p><p>Download your local copy first if it contains changes you need.</p><button class="btn btn-secondary" data-action="export">${icon('download')}Download this device's copy</button>`,'Use cloud workspace',async()=>{
    cloud.busy=true;
    try{if(hasWorkspaceData()&&!state.demo)localStorage.setItem(RECOVERY_KEY,JSON.stringify({savedAt:new Date().toISOString(),raw:JSON.stringify(state)}));const latest=await cloudRequest('workspace');if(!latest.workspace)throw Error('No cloud workspace exists yet.');closeModal();adoptCloud(latest.workspace);toast('Cloud workspace loaded on this device.');}
    catch(e){formError(e.message);cloudError(e);}finally{cloud.busy=false;paintCloudStatus();}
  },false);
}
function chooseLocalCopy(){
  if(cloud.busy)return;
  if(state.demo){toast('Restore your JSON backup or choose Start fresh before uploading. Sample data is never uploaded.',true);return;}
  const tz=$('#cloud-timezone')?.value.trim()||cloud.timezone;
  try{new Intl.DateTimeFormat('en',{timeZone:tz});}catch{return toast('Enter a valid time zone, for example Asia/Dubai.',true);}
  const remote=cloud.reconcile?.remote||cloud.remote;
  confirmAction(remote?'Replace the cloud copy?':'Start your private cloud workspace?',`<p><strong>${remote?'Your local workspace will replace the cloud records.':'Your current workspace will be uploaded to your private database.'}</strong></p><p>${state.assets.length} accounts, ${state.entries.length} transactions, ${state.loans.length} loans and ${state.loanPayments.length} repayments. Backup time zone: <strong>${esc(tz)}</strong>.</p><p>${remote?'A server-side recovery snapshot of the previous cloud copy is kept before replacement. This does not merge two versions.':'Other devices can use the same login to load this workspace.'}</p>` ,remote?'Replace cloud copy':'Upload my workspace',async()=>{
    if(cloud.busy)return;cloud.busy=true;
    try{
      const data=validateState(state),generation=cloud.generation;
      const saved=await cloudRequest('workspace','PUT',{data,expectedRevision:remote?.revision||0,mutationId:crypto.randomUUID(),timezone:tz,replace:Boolean(remote)});
      cloud.linked=true;cloud.owner=cloud.user.id;cloud.revision=saved.revision;cloud.timezone=tz;cloud.lastSync=saved.updated_at;cloud.dirty=generation!==cloud.generation;cloud.reconcile=null;cloud.error='';cloud.pendingMutation=null;saveCloudMeta();closeModal();render();toast('Your private workspace is connected.');
      await loadCloudBackups();
    }catch(e){if(e.status===409){const latest=await cloudRequest('workspace').catch(()=>null);if(latest)cloud.reconcile={remote:latest.workspace,initial:false};}formError(e.message);cloudError(e);}
    finally{cloud.busy=false;paintCloudStatus();}
  },Boolean(remote));
}
async function loadCloudBackups(){
  if(!cloud.signedIn)return;
  try{const r=await cloudRequest('backups');cloud.backups=r.backups;cloud.backupsLoaded=true;cloud.error='';if(ui.page==='cloud'&&!$('#modal').open)render();}
  catch(e){cloudError(e);if(ui.page==='cloud'&&!$('#modal').open)render();}
}
async function manualCloudBackup(){
  await syncCloud();
  if(cloud.dirty||cloud.reconcile||!cloud.linked||cloud.busy)return toast('Finish syncing or review the device copies before making a cloud backup.',true);
  cloud.busy=true;paintCloudStatus();
  try{await cloudRequest('backups','POST',{});toast('Private cloud backup created.');await loadCloudBackups();}
  catch(e){cloudError(e);toast(e.message,true);}finally{cloud.busy=false;paintCloudStatus();}
}
async function downloadCloudBackup(id){
  try{const {backup}=await cloudRequest('backup&id='+encodeURIComponent(id));downloadBlob('assets-cloud-'+backup.backup_day+'-'+backup.kind+'.json',JSON.stringify(validateState(backup.data),null,2));toast('Cloud snapshot prepared as a portable JSON file.');}
  catch(e){cloudError(e);toast(e.message,true);}
}
function restoreCloudBackup(id){
  if(cloud.busy||cloud.dirty||cloud.reconcile)return toast('Sync or resolve your current workspace before restoring a cloud snapshot.',true);
  const b=cloud.backups.find(x=>x.id===id);if(!b)return;
  confirmAction('Restore this cloud snapshot?',`<p>Restore the <strong>${esc(b.kind)}</strong> copy for <strong>${esc(b.backup_day)}</strong>, revision ${b.revision}?</p><p>This replaces your current cloud workspace and this device. Other signed-in devices will detect the new revision. A pre-restore cloud snapshot is created first.</p><p>No repayments or transactions are replayed.</p>`,'Restore snapshot',async()=>{
    cloud.busy=true;const generation=cloud.generation;
    try{const saved=await cloudRequest('restore','POST',{backupId:id,expectedRevision:cloud.revision,mutationId:crypto.randomUUID()});closeModal();if(generation!==cloud.generation){cloud.reconcile={remote:saved,initial:false};render();}else adoptCloud(saved);toast('Cloud snapshot restored. A recovery copy was kept.');await loadCloudBackups();}
    catch(e){formError(e.message);cloudError(e);}finally{cloud.busy=false;paintCloudStatus();}
  },true);
}
function signOutCloud(){
  confirmAction('Sign out on this device?',`<p>${cloud.dirty?'<strong>There are unsynced changes. Download a backup before continuing.</strong>':'Your cloud records and daily backup job are not deleted.'}</p><p>The sign-out below also clears the locally cached workspace and recovery copy on this device. Saved JSON downloads are not deleted.</p><button class="btn btn-secondary" data-action="export">${icon('download')}Download my current copy</button>`,'Sign out & clear this device',async()=>{
    if(cloud.busy)return;cloud.busy=true;clearTimeout(cloud.timer);
    try{await cloudRequest('logout','POST',{});clearTimeout(cloud.timer);localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(RECOVERY_KEY);localStorage.removeItem(CLOUD_META_KEY);state=blankState();state.profile.name='My workspace';cloud.signedIn=false;cloud.linked=false;cloud.owner='';cloud.user=null;cloud.revision=0;cloud.dirty=false;cloud.reconcile=null;cloud.error='';cloud.backups=[];cloud.remote=null;closeModal();render();toast('Signed out. The cached records on this device were cleared.');}
    catch(e){formError(e.message);}finally{cloud.busy=false;paintCloudStatus();}
  },true);
}
function cloudPage(){
  const health=cloud.health||{},jobFresh=health.lastJobSuccess&&Date.now()-new Date(health.lastJobSuccess).getTime()<20*60000;
  const jobLabel=!cloud.signedIn?'Sign in to check':!health.schedulerConfigured?'Scheduler not installed':jobFresh?'Daily backup job running':'Scheduler needs attention';
  const remote=cloud.reconcile?.remote,localCount=`${state.assets.length} accounts / ${state.entries.length} transactions / ${state.loans.length} loans`;
  return `<div class="page-heading"><div><div class="eyebrow">PRIVATE CLOUD</div><h1>Keep it safe. Keep it in sync.</h1><p>Your workspace across devices, with a separate copy of each completed day.</p></div><button class="btn btn-secondary" data-page="backup">${icon('download')}File backups</button></div>
    <div class="cloud-status-grid"><section class="cloud-status-card"><span>${icon('globe')}Connection</span><strong data-cloud-status>${esc(cloudStatusText())}</strong><small>${cloud.lastSync?'Last server save: '+esc(formatStamp(cloud.lastSync)):'Local saving works before cloud setup.'}</small></section><section class="cloud-status-card"><span>${icon('shield')}Daily protection</span><strong>${jobLabel}</strong><small>${health.lastBackupDay?'Latest completed day: '+esc(health.lastBackupDay):'Runs after local midnight once configured.'}</small></section><section class="cloud-status-card"><span>${icon('clock')}Backup schedule</span><strong>00:05 / ${esc(cloud.timezone)}</strong><small>90-day history. Includes records synced before midnight.</small></section></div>
    ${cloud.error?`<div class="inline-note warning cloud-alert">${icon('info')}<span>${esc(cloud.error)}</span></div>`:''}
    ${!cloud.configured?`<section class="panel cloud-setup"><span class="backup-icon">${icon('shield')}</span><h2>Connect Assets to your private cloud.</h2><p>Assets will test <strong>/api/vault</strong> on this deployment. Your local records stay untouched until you sign in and choose which copy to keep.</p><div class="setup-steps"><div><b>01</b><span>Private database<small>Your Supabase workspace and daily backup scheduler should already be installed.</small></span></div><div><b>02</b><span>Vercel connection<small>Production environment variables must be present on the active deployment.</small></span></div><div><b>03</b><span>Sign in &amp; choose your copy<small>The first cloud save should go from this device to the empty cloud workspace.</small></span></div></div><div class="quick-inline-actions"><button class="btn btn-primary" data-action="cloud-refresh">${icon('globe')}Check connection</button><button class="btn btn-secondary" data-page="backup">${icon('folder')}Keep using file backups</button></div></section>`:
    !cloud.signedIn?`<div class="cloud-connect-grid"><section class="panel cloud-login"><div class="eyebrow">YOUR PRIVATE ACCOUNT</div><h2>Welcome back.</h2><p>Use the owner account created in your Supabase project. There is no public registration.</p><form id="cloud-login-form"><div class="form-error" id="cloud-login-error" role="alert"></div><div class="field"><label for="cloud-email">Email</label><input class="input" type="email" id="cloud-email" autocomplete="username" required></div><div class="field"><label for="cloud-password">Password</label><input class="input" id="cloud-password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">${icon('shield')}Sign in securely</button></form><p class="field-help">Signing in does not silently overwrite local records. On a new device, choose the cloud copy to continue.</p></section><section class="panel cloud-explainer"><h3>One workspace. All your devices.</h3><p>Changes are first saved on this device, then sent to your private database when connected. A daily job saves the last server-saved revision before midnight.</p><p>Offline changes stay here until the app is open and online again. They cannot be included in an earlier daily snapshot.</p><p>Need to reset your password? Manage your owner account through the Supabase dashboard.</p></section></div>`:
    `<section class="panel cloud-account"><div><strong>${esc(cloud.user?.email||'Owner signed in')}</strong><p>Private owner account &middot; ${cloud.linked?'This device is linked':'Choose a workspace below'}</p></div><div class="quick-inline-actions"><button class="btn btn-secondary" data-action="cloud-refresh">${icon('globe')}Refresh</button><button class="btn btn-secondary" data-action="cloud-signout">Sign out</button></div></section>
      ${cloud.reconcile?`<section class="panel cloud-reconcile"><div class="eyebrow">${remote?'REVIEW BEFORE CONTINUING':'FIRST CLOUD SAVE'}</div><h2>${remote?'Which workspace should you continue with?':'Take this workspace to your other devices.'}</h2><p>${remote?'We have paused syncing so neither copy is silently overwritten. These options replace a workspace; they do not merge records.':'Restore your latest JSON backup first if this browser does not have your latest data.'}</p><div class="copy-options"><div><h3>This device</h3><strong>${esc(state.profile.name)}</strong><p>${localCount}${state.demo?' / demo data':''}</p><button class="btn btn-secondary" data-action="export">${icon('download')}Download local copy</button></div>${remote?`<div><h3>Private cloud</h3><strong>${esc(remote.data.profile.name)}</strong><p>${remote.data.assets.length} accounts / ${remote.data.entries.length} transactions / ${remote.data.loans.length} loans<br>Revision ${remote.revision} &middot; ${esc(formatStamp(remote.updated_at))}</p><button class="btn btn-primary" data-action="cloud-use-remote">${icon('download')}Continue with cloud data</button></div>`:''}</div><div class="field timezone-field"><label for="cloud-timezone">Backup time zone</label><input class="input" id="cloud-timezone" list="timezone-list" value="${esc(cloud.timezone)}" placeholder="e.g. Asia/Dubai"><p class="field-help">Your browser's zone is suggested. Confirm the zone you want for end-of-day backups.</p></div>${timezoneList()}<button class="btn ${remote?'btn-secondary':'btn-primary'}" data-action="cloud-use-local" ${state.demo?'disabled':''}>${icon('upload')}${remote?'Use this device instead':'Upload this workspace'}</button>${state.demo?`<p class="field-help">Sample data cannot be uploaded. <button class="text-link" data-action="import">Restore your backup</button> or <button class="text-link" data-action="start-fresh">Start fresh</button>.</p>`:''}</section>`:
      `<section class="panel cloud-tools"><div><h3>Automatic sync is ${cloud.linked?'connected':'not linked yet'}.</h3><p>Edits sync while this app is open and online. The daily database job runs without an open browser.</p></div><div class="quick-inline-actions"><button class="btn btn-primary" data-action="cloud-sync">${icon('globe')}Sync now</button><button class="btn btn-secondary" data-action="cloud-backup">${icon('shield')}Create cloud backup</button></div><div class="field timezone-field"><label for="cloud-timezone">End-of-day time zone</label><div class="timezone-row"><input class="input" id="cloud-timezone" list="timezone-list" value="${esc(cloud.timezone)}"><button class="btn btn-secondary" data-action="cloud-timezone">Save zone</button></div></div>${timezoneList()}<div class="daily-email-panel"><div><span class="eyebrow">DAILY EMAIL</span><h3>Short end-of-day status</h3><p>Receive a compact summary after the completed day is backed up: asset value, net worth, trading P&amp;L and loan totals.</p></div><form id="daily-email-form" class="daily-email-form"><label class="checkbox-line"><input type="checkbox" id="daily-email-enabled" ${state.settings.dailyEmailEnabled?'checked':''}><span><strong>Send daily status email</strong></span></label><div class="field"><label for="daily-email-address">Send to</label><input class="input" id="daily-email-address" type="email" maxlength="254" value="${esc(state.settings.dailyEmailAddress||cloud.user?.email||'')}" placeholder="you@example.com"></div><button class="btn btn-secondary btn-small" type="submit">${icon('check')}Save email preference</button><p class="field-help">Email delivery uses the optional server mail setup in <strong>database/05-email-digest.sql</strong>. Your preference still syncs safely if the mail provider is not configured yet.</p></form></div></section>`}
      <section class="panel cloud-history"><div class="panel-heading"><div><h3>Cloud backup history</h3><p>Daily, manual and pre-restore snapshots. Download a JSON copy or restore a version.</p></div><button class="btn btn-secondary btn-small" data-action="cloud-load-backups">${icon('clock')}Load history</button></div>${cloud.backups.length?`<div class="cloud-backup-list">${cloud.backups.map(b=>`<div class="cloud-backup-row"><span class="backup-icon">${icon(b.kind==='daily'?'calendar':'shield')}</span><div><strong>${esc(b.backup_day)} <span class="small-tag">${esc(b.kind.replace(/-/g,' '))}</span></strong><small>Revision ${b.revision} &middot; ${esc(b.timezone)}<br>Server saved: ${esc(formatStamp(b.source_saved_at))}</small></div><div class="quick-inline-actions"><button class="btn btn-secondary btn-small" data-action="cloud-download" data-id="${b.id}" aria-label="Download backup for ${b.backup_day}">${icon('download')}JSON</button><button class="btn btn-secondary btn-small" data-action="cloud-restore" data-id="${b.id}">Restore</button></div></div>`).join('')}</div>`:`<div class="empty-state">${icon('folder')}<h3>${cloud.backupsLoaded?'No cloud snapshots yet':'Load your saved snapshots'}</h3><p>${cloud.backupsLoaded?'The first daily copy appears after a completed day of synced data. You can create a manual backup now.':'Your financial records are never stored as public website files.'}</p></div>`}</section>`}
    <div class="inline-note cloud-footnote">${icon('info')}<span><strong>Keep an independent copy too.</strong> These snapshots are stored in your private database, not a separate disaster-recovery service. Deleted projects or service outages can affect access. Download occasional JSON backups to a private location. Local caches and downloaded JSON files are not encrypted by this app.</span></div>`;
}
function timezoneList(){return '<datalist id="timezone-list">'+['Asia/Dubai','Asia/Kabul','Asia/Kolkata','Asia/Tashkent','Asia/Tehran','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','UTC'].map(t=>'<option value="'+t+'">').join('')+'</datalist>';}
function quickPage(){
  const t=totals(),cash=state.assets.filter(a=>a.category==='cash'),recent=[...state.entries].sort(sortEntries).slice(0,4),due=state.loans.filter(l=>loanRemaining(l)>1e-8).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).slice(0,3);
  const actions=[['expense','Spend','Purchases & family support','upload'],['income','Money in','Salary, gifts & refunds','download'],['pnl','Profit / loss','Log a trading result','chart'],['transfer','Transfer','Move between your accounts','transfer'],['balance','Update balance','Set what is available now','wallet'],['repayment','Loan payment','Repay or receive money','shield']];
  return `<div class="quick-page">${demoBanner()}<section class="quick-header"><div class="profile-identity">${avatar()}<div><div class="profile-name">${esc(state.profile.name)} ${state.profile.badge?badge():''}</div><div class="profile-subtitle">Your personal workspace</div></div></div><button class="btn btn-secondary" data-page="overview">Full dashboard ${icon('arrow-right')}</button></section><section class="quick-hero"><div class="eyebrow">QUICK UPDATE</div><h1>Update &amp; go.</h1><p>Small actions. Everything in one place.</p><div class="quick-summary"><div><span>Everyday money</span><strong>${money(t.cash)}<small>${esc(state.settings.displayCurrency)}</small></strong></div><button class="quick-cloud" data-page="cloud">${icon('globe')}<span data-cloud-status>${esc(cloudStatusText())}</span>${icon('chevron')}</button></div></section><section class="quick-actions" aria-label="Quick money actions">${actions.map(([key,title,sub,i])=>`<button class="quick-action ${key==='expense'?'quick-action-primary':''}" data-action="quick-action" data-kind="${key}"><span class="quick-action-icon">${icon(i)}</span><strong>${title}</strong><small>${sub}</small><span class="quick-action-arrow">${icon('arrow-right')}</span></button>`).join('')}</section><section class="quick-account-section"><div class="section-heading"><div><h2>Your daily accounts</h2><p>Cash, bank and wallet balances.</p></div><button class="text-link" data-page="cash">All ${icon('arrow-right')}</button></div>${cash.length?`<div class="quick-account-list">${cash.map(a=>`<button class="quick-account" data-action="quick-select" data-kind="expense" data-id="${a.id}">${assetLogo(a)}<span><strong>${esc(a.name)}</strong><small>${esc(a.platform||'Everyday account')}</small></span><div><strong>${moneyNative(metrics(a).value,a.currency)}</strong><small>${esc(a.currency)}</small></div>${icon('chevron')}</button>`).join('')}</div>`:`<button class="empty-card" data-action="add-asset" data-category="cash"><span>${icon('plus')}</span><strong>Add your first everyday account</strong><small>Binance, your bank or cash on hand.</small></button>`}</section>${due.length?`<section class="quick-loans"><div class="section-heading"><div><h2>Loans to keep in view</h2><p>Next due dates and remaining principal.</p></div><button class="text-link" data-page="loans">All ${icon('arrow-right')}</button></div>${due.map(l=>`<button class="quick-loan" data-action="repay-loan" data-id="${l.id}"><span class="backup-icon">${icon(l.direction==='borrowed'?'upload':'download')}</span><span><strong>${esc(l.person)}</strong><small>${l.direction==='borrowed'?'You owe':'Owes you'} &middot; ${l.dueDate?esc(dateLabel(l.dueDate)):'No due date'}</small></span><strong>${moneyNative(loanRemaining(l),l.currency)}</strong>${icon('chevron')}</button>`).join('')}</section>`:''}<section class="panel quick-recent"><div class="panel-heading"><div><h3>Latest updates</h3><p>Your most recent account activity.</p></div><button class="text-link" data-page="activity">View all ${icon('arrow-right')}</button></div>${ledgerTable(recent,{compact:true})}</section><section class="quick-install"><span class="backup-icon">${icon('phone')}</span><div><strong>One tap from your home screen.</strong><p>Add this Quick Update screen to your phone.</p></div><button class="btn btn-secondary" data-action="install-help">Add shortcut</button></section><div class="quick-bottom-link"><button class="text-link" data-page="overview">All charts, accounts, settings and reports ${icon('arrow-right')}</button></div></div>`;
}
function quickChoose(kind){
  if(kind==='transfer'&&state.assets.length<2){openAsset('','cash');toast('Add a second account before transferring between your own accounts.');return;}
  if(kind==='repayment'){
    const loans=state.loans.filter(l=>loanRemaining(l)>1e-8);
    if(!loans.length){openLoan();return;}
    modalDraft={type:'quick-picker'};showModal(`${modalHeader('Choose a loan','Record a repayment or money received.')}<div class="modal-body quick-picker-list">${loans.map(l=>`<button class="quick-picker-row" data-action="repay-loan" data-id="${l.id}">${icon('shield')}<span><strong>${esc(l.person)}</strong><small>${esc(l.title)} &middot; ${l.direction==='borrowed'?'I borrowed':'I lent'}</small></span><strong>${moneyNative(loanRemaining(l),l.currency)}</strong>${icon('chevron')}</button>`).join('')}</div>`,true);return;
  }
  const list=state.assets.filter(a=>['expense','income'].includes(kind)?a.category==='cash':kind==='pnl'?a.category!=='cash':true);
  if(!list.length){openAsset('',kind==='pnl'?'forex':'cash');toast('Add an account first.');return;}
  if(list.length===1){quickSelect(kind,list[0].id);return;}
  modalDraft={type:'quick-picker'};showModal(`${modalHeader('Choose an account',kind==='pnl'?'Trading results only. Everyday spending is separate.':'Which account would you like to update?')}<div class="modal-body quick-picker-list">${list.map(a=>`<button class="quick-picker-row" data-action="quick-select" data-kind="${kind}" data-id="${a.id}">${assetLogo(a)}<span><strong>${esc(a.name)}</strong><small>${esc(a.platform||CATEGORY[a.category].short)}</small></span><strong>${moneyNative(metrics(a).value,a.currency)} <small>${esc(a.currency)}</small></strong>${icon('chevron')}</button>`).join('')}</div>`,true);
}
function quickSelect(kind,id){
  if(kind==='balance'){quickBalance(id);return;}
  openEntry(id,kind==='pnl'?'profit':kind);
}
function quickBalance(id){
  const a=assetById(id);if(!a)return;modalDraft={type:'quick-balance',id};
  showModal(`${modalHeader('Update current balance',esc(a.name)+' / '+esc(a.currency))}<form id="quick-balance-form"><div class="modal-body"><div class="form-error" id="form-error" role="alert"></div><div class="quick-balance-current"><span>Currently recorded</span><strong>${moneyNative(metrics(a).value,a.currency,{reveal:true})}</strong></div><div class="field"><label for="quick-balance-value">${a.category==='cash'?'Available balance right now':'Current account value'}</label><input class="input quick-amount" id="quick-balance-value" type="number" inputmode="decimal" step="any" min="0" max="10000000000000" required placeholder="0.00"></div><div class="field" style="margin-top:18px"><label for="quick-balance-note">Note <span class="field-label-hint">Optional</span></label><input class="input" id="quick-balance-note" maxlength="300" placeholder="Balance checked today"></div><div class="inline-note" style="margin-top:20px">${icon('info')}<span>This sets the balance to the amount above; it does not add it again. ${a.category==='cash'?'A cash balance correction is not trading profit or loss.':'Use Profit / loss instead for a daily trading result.'}</span></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check')}Update balance</button></div></form>`,true);
  requestAnimationFrame(()=>$('#quick-balance-value')?.focus());
}
function saveQuickBalance(){
  const a=assetById(modalDraft?.id),value=Number($('#quick-balance-value').value);if(!a||!validNumber(value,0))return formError('Enter a valid available balance.');
  const difference=round(value-metrics(a).value);
  if(Math.abs(difference)>1e-8)state.entries.push({id:uid(),assetId:a.id,kind:'valuation',amount:difference,note:$('#quick-balance-note').value.trim()||'Quick current-balance update',date:today(),createdAt:new Date().toISOString(),fx:rate(a.currency),groupId:'',cashCategory:'',counterparty:'',loanId:'',paymentId:''});
  closeModal();commit('Balance updated.');
}
function showInstallHelp(){
  const file=location.protocol==='file:';
  modalDraft={type:'install'};showModal(`${modalHeader('Your phone shortcut','Quick updates, without losing the full dashboard.')}<div class="modal-body"><div class="install-preview assets-install-mark">A<div><strong>Assets Quick</strong><p>Spending, trading results and loan payments.</p></div></div>${file?'<div class="inline-note warning">Open the deployed HTTPS website on your phone first. A downloaded HTML file cannot install the hosted shortcut.</div>':`<p class="about-copy"><strong>On iPhone:</strong> open Quick Update in Safari, then use Share &rarr; Add to Home Screen. Enable Open as Web App where available.<br><br><strong>On Android:</strong> use the browser menu &rarr; Install app / Add to Home screen.</p><div class="quick-inline-actions">${cloud.installPrompt?'<button class="btn btn-primary" data-action="install-now">Install Assets Quick</button>':''}<button class="btn btn-secondary" data-action="copy-quick-link">${icon('phone')}Copy shortcut link</button></div>`}<p class="field-help" style="margin-top:18px">The shortcut opens Quick Update. Full dashboard, charts, loans, settings and file backups remain available. Sign in to the same private workspace on each device to sync.</p></div><div class="modal-footer"><button class="btn btn-primary" data-action="close-modal">Done</button></div>`,true);
}
function handleCloudQuickAction(action,el){
  const run=fn=>{Promise.resolve().then(fn).catch(e=>{cloudError(e);toast(e.message,true);});};
  if(action==='quick-action'){quickChoose(el.dataset.kind);return true;}
  if(action==='quick-select'){quickSelect(el.dataset.kind,el.dataset.id);return true;}
  if(action==='install-help'){showInstallHelp();return true;}
  if(action==='install-now'){run(async()=>{if(cloud.installPrompt){await cloud.installPrompt.prompt();await cloud.installPrompt.userChoice;cloud.installPrompt=null;closeModal();}});return true;}
  if(action==='copy-quick-link'){run(async()=>{const url=new URL(location.href);url.search='?quick=1';url.hash='quick';await navigator.clipboard.writeText(url.href);toast('Quick Update link copied.');});return true;}
  if(action==='cloud-refresh'){run(async()=>{cloud.error='';cloud.busy=true;paintCloudStatus();try{const session=await cloudRequest('session');cloud.configured=Boolean(session.configured);cloud.signedIn=Boolean(session.authenticated);cloud.user=session.user||null;if(cloud.signedIn){cloud.linked=cloud.owner===cloud.user.id&&cloud.revision>0;await getCloudWorkspace({initial:true});await loadCloudBackups();}toast(cloud.configured?(cloud.signedIn?'Cloud connection verified.':'Backend online. Sign in to continue.'):'Backend responded, but production configuration is incomplete.',!cloud.configured);}finally{cloud.busy=false;paintCloudStatus();if(ui.page==='cloud')render();}});return true;}
  if(action==='cloud-sync'){run(async()=>{await syncCloud();await pollCloud();paintCloudStatus();});return true;}
  if(action==='cloud-use-remote'){run(chooseCloudCopy);return true;}
  if(action==='cloud-use-local'){chooseLocalCopy();return true;}
  if(action==='cloud-signout'){signOutCloud();return true;}
  if(action==='cloud-load-backups'){run(loadCloudBackups);return true;}
  if(action==='cloud-backup'){run(manualCloudBackup);return true;}
  if(action==='cloud-download'){run(()=>downloadCloudBackup(el.dataset.id));return true;}
  if(action==='cloud-restore'){restoreCloudBackup(el.dataset.id);return true;}
  if(action==='cloud-timezone'){
    const tz=$('#cloud-timezone').value.trim();try{new Intl.DateTimeFormat('en',{timeZone:tz});}catch{return toast('Enter a valid time zone such as Asia/Dubai.',true),true;}
    if(cloud.reconcile||!cloud.linked)return toast('Choose a workspace before changing its time zone.',true),true;
    cloud.timezone=tz;cloudLocalChanged();toast('Time zone queued for the next server save.');return true;
  }
  return false;
}
function initQuickCloud(){
  if(!location.hash&&(new URLSearchParams(location.search).get('quick')==='1'||matchMedia('(max-width:760px)').matches))ui.page='quick';
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();cloud.installPrompt=e;});
  window.addEventListener('online',()=>{if(cloud.signedIn){syncCloud();pollCloud();}else initCloud();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollCloud();});
  window.addEventListener('beforeunload',e=>{if(cloud.dirty&&cloud.linked){e.preventDefault();e.returnValue='Changes are saved on this device but have not reached the cloud yet.';}});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&e.newValue===null&&cloud.owner){clearTimeout(cloud.timer);cloud.signedIn=false;cloud.linked=false;cloud.dirty=false;cloud.reconcile=null;cloud.owner='';cloud.user=null;cloud.revision=0;cloud.error='';state=blankState();closeModal();setPage('cloud');}});
  setInterval(pollCloud,30000);
  if(location.protocol==='https:'&&'serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}
  initCloud();
}

initInterfaceUpgrade();
initQuickCloud();
render();
if(!storageOk)setTimeout(()=>toast(persistenceBlocked?'Saved data needs recovery. It has not been overwritten. Open Settings.':'Browser saving is unavailable. Use Export JSON to keep your work.',true),600);
})();

