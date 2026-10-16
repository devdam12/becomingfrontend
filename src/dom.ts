export function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing interface element: ${selector}`);
  return result;
}
export interface Registration {
  id: string; full_name: string; email: string; whatsapp: string; school: string;
  age: number; dob: string; guardian_email: string; guardian_phone: string; created_at: string;
  status: string; consent_role: string; consent_version: string;
}
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'The request could not be completed.';
