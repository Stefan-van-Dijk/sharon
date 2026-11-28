import {ConnectionService} from './ConnectionService.js?v=0.5.35';

export const ACCOUNT_SESSION_KEY = 'account.session.v1';

export class AccountService {
 constructor(store, connection = new ConnectionService(store)) {
  this.store = store;
  this.connection = connection;
 }
 async request(action, input = {}) {
  return this.connection.request('account-' + action, input);
 }
 async status() {
  const session = (await this.store.get('meta', ACCOUNT_SESSION_KEY))?.value;
  if (!session?.token) return null;
  const {account} = await this.connection.request('account-status',{},null,'',session.token);
  if ((await this.store.get('meta', ACCOUNT_SESSION_KEY))?.value?.token !== session.token) return null;
  if (!account) await this.clear(session.token);
  return account;
 }
 async require() {
  const account = await this.status();
  if (!account) throw Error('Log in met je Sharon-account via Apps verbinden.');
  const device = await this.connection.device();
  if (account.personId !== device.personId) throw Error('Dit account hoort bij een andere Sharon-identiteit.');
  return account;
 }
 async login(input) {
  const device = await this.connection.device();
  const {account, sessionToken} = await this.request('login', {...input,
   personId:device.personId, deviceToken:device.deviceToken
  });
  if (!account || account.personId !== device.personId || !/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) {
   throw Error('Ongeldig accountantwoord.');
  }
  await this.store.put('meta', {key:ACCOUNT_SESSION_KEY, value:{token:sessionToken, account}});
  return account;
 }
 async logout() {
  const session = (await this.store.get('meta', ACCOUNT_SESSION_KEY))?.value;
  if (!session?.token) return;
  await this.connection.request('account-logout',{},null,'',session.token);
  await this.clear(session?.token);
 }
 async clear(expectedToken) {
  if (!expectedToken) return;
  await this.store.updateMeta(ACCOUNT_SESSION_KEY,current=>current?.token===expectedToken?null:current);
 }

}
