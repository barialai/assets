// Shared ledger validation, extracted from the v2-compatible local app.
const VERSION = 2;
const CATEGORY = {
  cash:{label:'Everyday cash / bank / wallet',short:'Cash & bank',icon:'wallet',color:'#D7E1EC'},
  forex:{label:'Forex account',short:'Forex',icon:'chart',color:'#0030CF'},
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
const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateObj = str => new Date(str+'T12:00:00');
const shiftDate = (n,base=new Date()) => {const d=new Date(base);d.setDate(d.getDate()+n);return localDate(d);};
const round = n => Math.round((n+Number.EPSILON)*1e8)/1e8;
const dateLabel = (date,options={month:'short',day:'numeric'}) => dateObj(date).toLocaleDateString('en-US',options);
const today = () => localDate();
function blankState() {return {version:VERSION,demo:false,profile:{name:'Nawab',subtitle:'Personal portfolio',photo:'',badge:true,workspaceLabel:'PRIVATE WORKSPACE',showDate:true,showWorkspaceLabel:true},settings:{displayCurrency:'USDT',hideBalances:false,rates:{USDT:1,USD:1},lastBackup:null,dailyEmailEnabled:false,dailyEmailAddress:''},assets:[],entries:[],loans:[],loanPayments:[],snapshots:[{date:today(),value:0}],updatedAt:new Date().toISOString()};}
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

export { validateState };
