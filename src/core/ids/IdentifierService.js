export const IDENTIFIER_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{12}$/;

export class IdentifierService {
  static isValid(value) {
    return IDENTIFIER_PATTERN.test(String(value ?? ''));
  }

  static create(cryptoObject = globalThis.crypto) {
    if (!cryptoObject?.getRandomValues) {
      throw new Error('Veilige willekeurige identifiers zijn niet beschikbaar.');
    }

    const bytes = new Uint8Array(12);
    cryptoObject.getRandomValues(bytes);
    return Array.from(bytes, byte => IDENTIFIER_ALPHABET[byte & 63]).join('');
  }

  static assert(value) {
    if (!this.isValid(value)) {
      throw new Error('Identifier moet exact 12 toegestane tekens bevatten.');
    }
    return value;
  }
}
