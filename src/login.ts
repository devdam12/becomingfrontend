import { element } from './dom.js';
element<HTMLFormElement>('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget as HTMLFormElement;const button=element<HTMLButtonElement>('#login-form button');if(button.disabled)return;
  const message=element('#login-message');message.textContent='';button.disabled=true;button.textContent='Signing in…';
  try{
    const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok){message.textContent=data.message;return;}
    form.reset();location.assign('/admin');
  }catch{message.textContent='Unable to sign in. Check your connection and try again.';}
  finally{button.disabled=false;button.textContent='Sign in ↗';}
});
