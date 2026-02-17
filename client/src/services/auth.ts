// Simple auth state
export let apiKey: string | null = localStorage.getItem('apiKey');
export let adminApiKey: string | null = localStorage.getItem('adminApiKey');

export const setApiKey = (key: string | null) => {
  apiKey = key;
  if (key) {
    localStorage.setItem('apiKey', key);
  } else {
    localStorage.removeItem('apiKey');
  }
};

export const setAdminApiKey = (key: string | null) => {
  adminApiKey = key;
  if (key) {
    localStorage.setItem('adminApiKey', key);
  } else {
    localStorage.removeItem('adminApiKey');
  }
};

// Hash password using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
