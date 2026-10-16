import { element, errorMessage, type Registration } from './dom.js';
let page=1, controller: AbortController | undefined, requestNumber=0;
const message=element('#admin-message');
const filters=element<HTMLFormElement>('#filters');
const formatDate=(value:string)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
async function api(url:string,options:RequestInit={}) {
  const response=await fetch(url,{...options,signal:options.signal||AbortSignal.timeout(30000)});
  if(response.status===401){location.assign('/admin/login');throw new Error('Your session expired. Please sign in again.');}
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'The request failed. Please try again.');}
  return response;
}
async function load(){
  controller?.abort();controller=new AbortController();const sequence=++requestNumber;
  const state=element('#table-state');const panel=element('#records-panel');
  const records=element('#records');records.replaceChildren();message.textContent='';
  state.hidden=false;state.textContent='Loading registrations…';panel.setAttribute('aria-busy','true');
  element<HTMLButtonElement>('#previous').disabled=true;element<HTMLButtonElement>('#next').disabled=true;
  try{
    const params=new URLSearchParams([...new FormData(filters)].map(([key,value])=>[key,String(value)]));params.set('page',String(page));
    const data=await(await api('/api/admin/registrations?'+params,{signal:controller.signal})).json();
    if(sequence!==requestNumber)return;
    element('#total').textContent=data.total;
    for(const record of data.records as Registration[]){
      const tr=document.createElement('tr');
      for(const key of ['full_name','email','whatsapp','school','gender','created_at','status'] as const){
        const td=document.createElement('td');td.textContent=key==='created_at'?formatDate(record[key]):record[key];
        if(key==='full_name'){td.className='name-cell';const id=document.createElement('span');id.className='record-id';id.textContent=record.id;td.append(id);}
        if(key==='status'){const span=document.createElement('span');span.className='status-pill';span.textContent=record.status;td.replaceChildren(span);}
        tr.append(td);
      }
      const td=document.createElement('td');const button=document.createElement('button');button.className='secondary-button';button.textContent='Details';button.setAttribute('aria-label','View details for '+record.full_name);button.addEventListener('click',()=>details(record.id,button));td.append(button);tr.append(td);records.append(tr);
    }
    state.hidden=!!data.records.length;state.textContent='No registrations found.';
    element('#page-info').textContent=`${data.filtered} result${data.filtered===1?'':'s'} · Page ${page} of ${Math.max(1,Math.ceil(data.filtered/data.pageSize))}`;
    element<HTMLButtonElement>('#previous').disabled=page<=1;element<HTMLButtonElement>('#next').disabled=page*data.pageSize>=data.filtered;
  }catch(error){if(!(error instanceof Error && error.name==='AbortError')){state.textContent='Could not load registrations. Use Refresh to retry.';message.textContent=errorMessage(error);}}
  finally{if(sequence===requestNumber)panel.setAttribute('aria-busy','false');}
}
async function details(id:string,button:HTMLButtonElement){
  button.disabled=true;message.textContent='';
  try{
    const data=await(await api('/api/admin/registrations/'+encodeURIComponent(id))).json();
    const dl=element('#details');dl.replaceChildren();
    for(const [label,key] of [['Registration ID','id'],['Full Name','full_name'],['Email Address','email'],['WhatsApp Number','whatsapp'],['School','school'],['Gender','gender'],['Age (years)','age'],['Date of Birth','dob'],["Guardian's Email Address",'guardian_email'],["Guardian's Phone Number",'guardian_phone'],['Registration Date','created_at'],['Registration Status','status'],['Consent provided by','consent_role'],['Privacy notice version','consent_version']]){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=['created_at','dob'].includes(key) && data[key]?formatDate(data[key]):String(data[key] ?? 'Not provided');dl.append(dt,dd);
    }
    element<HTMLDialogElement>('#details-dialog').showModal();
  }catch(error){message.textContent=errorMessage(error);}finally{button.disabled=false;}
}
filters.addEventListener('submit',event=>{event.preventDefault();page=1;load();});
filters.addEventListener('reset',()=>{page=1;setTimeout(load,0);});
element<HTMLButtonElement>('#previous').addEventListener('click',()=>{page--;load();});
element<HTMLButtonElement>('#next').addEventListener('click',()=>{page++;load();});
element('#retry').addEventListener('click',load);
element('#close-details').addEventListener('click',()=>{element<HTMLDialogElement>('#details-dialog').close();element('#details').replaceChildren();});
element<HTMLDialogElement>('#details-dialog').addEventListener('close',()=>element('#details').replaceChildren());
element('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.assign('/admin/login');}catch(error){message.textContent=errorMessage(error);}});
element('#export').addEventListener('click',async event=>{
  const button=event.currentTarget as HTMLButtonElement;button.disabled=true;button.textContent='Preparing complete CSV…';message.textContent='';
  try{
    const response=await api('/api/admin/registrations/export',{signal:AbortSignal.timeout(120000)});
    const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download='the-becoming-conference-registrations-2026-12-04.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){message.textContent='CSV download failed. '+errorMessage(error)+' Click Download All Registrations (CSV) to retry.';}
  finally{button.disabled=false;button.textContent='Download All Registrations (CSV) ↓';}
});
load();
