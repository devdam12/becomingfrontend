import { element } from './dom.js';
import { validPhone } from './phone.js';
const form = element<HTMLFormElement>('#registration-form');
const button = element<HTMLButtonElement>('#submit-button');
const message = element('#form-message');
const today=new Date().toISOString().slice(0,10);
form.dob.max=today;
function showErrors(errors: Record<string, string | string[]>) {
  document.querySelectorAll('.field-error').forEach(el=>{el.textContent='';});
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  for (const [key,values] of Object.entries(errors)) {
    const target = document.getElementById(key+'-error');
    if(target) target.textContent = Array.isArray(values) ? values.join(' ') : values;
    (form.elements.namedItem(key) as HTMLElement | null)?.setAttribute('aria-invalid','true');
  }
}
function validate(data: Record<string, string | boolean | number>) {
  const errors: Record<string, string>={};
  for(const key of ['full_name','email','whatsapp','school','gender','age','dob','guardian_email','guardian_phone']) if(data[key] === '' || data[key] === undefined) errors[key]='This field is required.';
  if(data.gender && !['female','male','non_binary','prefer_not_to_say'].includes(String(data.gender))) errors.gender='Select a gender option.';
  for(const key of ['email','guardian_email']) if(data[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data[key]))) errors[key]='Enter a valid email address.';
  for(const key of ['whatsapp','guardian_phone']) if(data[key] && !validPhone(String(data[key]))) errors[key]='Use an international number beginning with + and country code (8–15 digits).';
  const age=Number(data.age);
  if(!errors.age && (!Number.isInteger(age) || age<0 || age>120)) errors.age='Enter your age as a whole number between 0 and 120.';
  const dob=String(data.dob || '');
  if(dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>today))errors.dob='Enter a valid date of birth that is not in the future.';
  if(dob && !errors.dob && !errors.age){
    const expected=Number(today.slice(0,4))-Number(dob.slice(0,4))-(today.slice(5)<dob.slice(5)?1:0);
    if(age!==expected)errors.age='Age must match your date of birth.';
  }
  if(!data.consent) errors.consent='Please read the privacy notice and provide consent.';
  return errors;
}
const consentLabel=element<HTMLLabelElement>('label[for="consent"]');
function updateConsentLabel(){
  const value=String(form.age.value).trim();
  consentLabel.textContent=value!=='' && Number(value)<18
    ? 'I am the attendee’s parent or legal guardian. I have read the privacy notice and consent to the use of these details for their conference registration.'
    : 'I have read the privacy notice and consent to the use of these details for conference registration.';
}
form.age.addEventListener('input',()=>{form.consent.checked=false;updateConsentLabel();});
form.dob.addEventListener('input',()=>{form.consent.checked=false;});
updateConsentLabel();
form.addEventListener('submit',async event=>{
  event.preventDefault(); if(button.disabled)return;
  message.textContent='';
  const data:Record<string,string|boolean|number>=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
  data.consent=form.consent.checked;
  const errors=validate(data);showErrors(errors);
  if(Object.keys(errors).length){(form.elements.namedItem(Object.keys(errors)[0]) as HTMLElement | null)?.focus();return;}
  data.age=Number(data.age);
  button.disabled=true;element('#submit-button span').textContent='Submitting registration…';form.setAttribute('aria-busy','true');
  try {
    const response=await fetch('/api/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
    const result=await response.json();
    if(!response.ok){showErrors(result.errors||{});message.textContent=result.message||'Registration failed. Please try again.';message.focus();return;}
    element('#registration-id').textContent=result.id;
    element('#registration-content').hidden=true;
    const success=element('#success-screen');success.hidden=false;success.focus();success.scrollIntoView({behavior:'instant',block:'start'});
    form.reset();updateConsentLabel();
  } catch {message.textContent='We could not confirm your registration. Check your connection and try again. If it was saved, using the same email will prevent a duplicate.';message.focus();}
  finally {button.disabled=false;element('#submit-button span').textContent='Complete Registration';form.removeAttribute('aria-busy');}
});
element('#return-button').addEventListener('click',()=>{
  element('#success-screen').hidden=true;element('#registration-content').hidden=false;
  element('#registration-id').textContent='';showErrors({});message.textContent='';form.full_name.focus();
});
