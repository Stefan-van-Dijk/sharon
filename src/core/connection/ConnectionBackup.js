import { IdentifierService } from '../ids/IdentifierService.js?v=0.5.20';

const connectionFormat = 'sharon-connections-v1';
const fullFormat = 'sharon-local-backup-v1';
export const MAX_CONNECTION_BACKUP_BYTES = 64 * 1024 * 1024;
const encoder = new TextEncoder();


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

function encode(bytes) {
  const chunks = [];
  // A multiple of three keeps base64 padding at the end of the final chunk.
  const size = 24576;
  for (let start = 0; start < bytes.length; start += size) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(start, start + size))));
  }
  return chunks.join('');
}
function decode(value) {
  if (typeof value !== 'string') throw new Error('Ongeldige back-up.');
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

export async function encryptConnectionBackup(device, password, local = null) {
  const format = local ? fullFormat : connectionFormat;
  const payload = credential(device);
  if (local) Object.assign(payload, { registered: device.registered === true, local });
  const data = encoder.encode(JSON.stringify(payload));
  if (data.length > (MAX_CONNECTION_BACKUP_BYTES - 512) * 3 / 4) {
    throw new Error('Je lokale gegevens zijn te groot voor één back-upbestand.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt, 'encrypt');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(format) }, key, data);
  return JSON.stringify({ format, salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(encrypted)) });
}

export async function decryptConnectionBackup(text, password) {
  if (typeof text !== 'string' || text.length > MAX_CONNECTION_BACKUP_BYTES) {
    throw new Error('Kies een geldig Sharon-back-upbestand.');
  }
  let format, salt, iv, data;
  try {
    const backup = JSON.parse(text);
    format = backup.format;
    if (format !== connectionFormat && format !== fullFormat) throw new Error();
    if (format === connectionFormat && text.length > 4096) throw new Error();
    salt = decode(backup.salt);
    iv = decode(backup.iv);
    data = decode(backup.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16 || (format === connectionFormat && data.length > 256)) throw new Error();
  } catch {
    throw new Error('Dit bestand is geen geldige back-up van Sharon-verbindingen.');
  }
  const key = await keyFor(password, salt, 'decrypt');
  try {
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(format) }, key, data);
    const payload = JSON.parse(new TextDecoder().decode(clear), (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error();
      return value;
    });
    const device = credential(payload);
    return format === fullFormat ? { ...device, registered: payload.registered === true, local: payload.local } : device;
  } catch {
    throw new Error('De wachtzin klopt niet of het back-upbestand is beschadigd.');
  }
}
