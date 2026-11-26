import { IdentifierService } from '../ids/IdentifierService.js?v=0.5.14';

const format = 'sharon-connections-v1';
export const MAX_CONNECTION_BACKUP_BYTES = 4096;
const encoder = new TextEncoder();
const associatedData = encoder.encode(format);

function credential(value) {
  if (typeof value?.personId !== 'string' || !IdentifierService.isValid(value.personId) ||
      typeof value.deviceToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.deviceToken)) {
    throw new Error('Ongeldige Sharon-identiteit in de back-up.');
  }
  return { personId: value.personId, deviceToken: value.deviceToken };
}

async function keyFor(password, salt, usage) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('Gebruik een wachtzin van 12 tot 256 tekens.');
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    key, { name: 'AES-GCM', length: 256 }, false, [usage]
  );
}

const encode = bytes => btoa(String.fromCharCode(...bytes));
function decode(value) {
  if (typeof value !== 'string') throw new Error('Ongeldige back-up.');
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

export async function encryptConnectionBackup(device, password) {
  const data = encoder.encode(JSON.stringify(credential(device)));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt, 'encrypt');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associatedData }, key, data);
  return JSON.stringify({ format, salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(encrypted)) });
}

export async function decryptConnectionBackup(text, password) {
  if (typeof text !== 'string' || text.length > MAX_CONNECTION_BACKUP_BYTES) {
    throw new Error('Kies een geldig Sharon-back-upbestand.');
  }
  let salt, iv, data;
  try {
    const backup = JSON.parse(text);
    if (backup.format !== format) throw new Error();
    salt = decode(backup.salt);
    iv = decode(backup.iv);
    data = decode(backup.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16 || data.length > 256) throw new Error();
  } catch {
    throw new Error('Dit bestand is geen geldige back-up van Sharon-verbindingen.');
  }
  const key = await keyFor(password, salt, 'decrypt');
  try {
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: associatedData }, key, data);
    return credential(JSON.parse(new TextDecoder().decode(clear)));
  } catch {
    throw new Error('De wachtzin klopt niet of het back-upbestand is beschadigd.');
  }
}
