export const normalizePhone = (value: string): string => value.replace(/[ ()-]/g, '');
export const validPhone = (value: string): boolean => /^\+[1-9][0-9 ()-]*$/.test(value) && /^\+[1-9]\d{7,14}$/.test(normalizePhone(value)) && !/^\+(\d)\1+$/.test(normalizePhone(value));
