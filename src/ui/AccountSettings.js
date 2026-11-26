const roles = {owner:'Eigenaar', admin:'Beheerder', member:'Lid', viewer:'Lezer'};
const canManage = role => ['owner','admin'].includes(role);

export function mountAccountSettings(host, service) {
  host.innerHTML = `
    <summary>Sharon-account</summary>
    <p role="status" data-account-status></p>
    <div data-account-body hidden>
      <p>Persoon-ID <code data-account-person></code></p>
      <ul data-account-emails></ul>
      <form class="settings-form" data-email-start>
        <label class="clean-field"><span>E-mailadres</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label>
        <button class="settings-save">Verstuur bevestigingscode</button>
      </form>
      <form class="settings-form" data-email-verify hidden>
        <label class="clean-field"><span>Code uit je e-mail</span><input name="code" type="text" autocomplete="one-time-code" spellcheck="false" maxlength="43" required></label>
        <button class="settings-save">Bevestig e-mailadres</button>
      </form>
      <form class="settings-form" data-organization-select>
        <label class="clean-field"><span>Actieve organisatie op dit apparaat</span><select name="organization"></select></label>
        <button class="settings-save">Wissel organisatie</button>
      </form>
      <form class="settings-form" data-organization-create>
        <label class="clean-field"><span>Nieuwe organisatie</span><input name="name" maxlength="80" required></label>
        <button class="settings-save">Maak organisatie aan</button>
      </form>
      <section data-organization-admin hidden>
        <ul data-organization-members></ul>
        <form class="settings-form" data-organization-role>
          <label class="clean-field"><span>Persoon-ID van lid</span><input name="personId" pattern="[A-Za-z0-9_\\-]{12}" spellcheck="false" maxlength="12" required></label>
          <label class="clean-field"><span>Rol</span><select name="role">
            <option value="member">Lid</option><option value="viewer">Lezer</option><option value="admin">Beheerder</option><option value="">Toegang intrekken</option>
          </select></label>
          <button class="settings-save">Bewaar rol</button>
        </form>
      </section>
    </div>`;

  const field = selector => host.querySelector(selector);
  const body = field('[data-account-body]');
  const status = field('[data-account-status]');
  const emailVerificationForm = field('[data-email-verify]');
  const organizationSelect = field('[data-organization-select] select');
  const admin = field('[data-organization-admin]');
  let pending = false;
  let challengeId = null;
  let account = null;
  const selectionKey = () => 'account.organization.v1.' + account.personId;

  function renderEmails(emails) {
    const list = field('[data-account-emails]');
    list.replaceChildren(...emails.map(({email}) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Verwijder';
      button.setAttribute('aria-label','Verwijder ' + email);
      button.addEventListener('click',() => run(async () => {
        const result = await service.accountRequest('account-email-remove',{email});
        renderEmails(result.emails);
        status.textContent = 'E-mailadres verwijderd.';
      }));
      item.append(email + ' ', button);
      return item;
    }));
  }

  async function showOrganization(organization) {
    admin.hidden = true;
    const list = field('[data-organization-members]');
    list.replaceChildren();
    if (!canManage(organization?.role)) return;
    const {members} = await service.accountRequest('organization-members',{organizationId:organization.id});
    list.replaceChildren(...members.map(({name,role,personId}) => {
      const item = document.createElement('li');
      item.textContent = name + ' · ' + roles[role] + ' · ' + personId;
      return item;
    }));
    field('[data-organization-role] option[value=admin]').disabled = organization.role !== 'owner';
    field('[data-organization-role]').reset();
    admin.hidden = false;
  }

  async function selectedOrganization() {
    const saved = (await service.store.get('meta',selectionKey()))?.value;
    return account.organizations.find(({id}) => id === saved) || null;
  }

  async function refresh() {
    ({account} = await service.accountRequest('account-self'));
    field('[data-account-person]').textContent = account.personId;
    renderEmails(account.emails);
    organizationSelect.replaceChildren(new Option('Persoonlijk',''),...account.organizations.map(({id,name,role}) =>
      new Option(name + ' · ' + roles[role],id)));
    const organization = await selectedOrganization();
    organizationSelect.value = organization?.id || '';
    body.hidden = false;
    await showOrganization(organization);
  }

  async function run(action) {
    if (pending) return;
    pending = true;
    status.textContent = 'Even wachten…';
    try {
      await action();
      if (status.textContent === 'Even wachten…') status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      pending = false;
    }
  }

  function submit(selector, action) {
    field(selector).addEventListener('submit',event => {
      event.preventDefault();
      const form = event.currentTarget;
      return run(() => action(new FormData(form), form));
    });
  }

  host.addEventListener('toggle', () => {
    if (host.open) void run(refresh);
  });

  submit('[data-email-start]', async data => {
    const email = data.get('email').trim();
    ({challengeId} = await service.accountRequest('account-email-start',{email}));
    emailVerificationForm.reset();
    emailVerificationForm.hidden = false;
    emailVerificationForm.elements.code.focus();
    status.textContent = 'Bevestigingscode aangevraagd voor ' + email + '.';
  });

  submit('[data-email-verify]', async (data,form) => {
    const {emails} = await service.accountRequest('account-email-verify',{challengeId,code:data.get('code').trim()});
    challengeId = null;
    form.reset();
    form.hidden = true;
    renderEmails(emails);
    status.textContent = 'E-mailadres bevestigd.';
  });

  submit('[data-organization-select]',async data => {
    const organizationId = data.get('organization');
    const organization = organizationId
      ? (await service.accountRequest('organization-select',{organizationId})).organization
      : null;
    await service.store.setMeta(selectionKey(),organization?.id || null);
    await showOrganization(organization);
    status.textContent = organization ? 'Actief op dit apparaat: ' + organization.name : 'Persoonlijke omgeving geselecteerd.';
  });

  submit('[data-organization-create]',async (data,form) => {
    const {organization} = await service.accountRequest('organization-create',{name:data.get('name').trim()});
    form.reset();
    await service.store.setMeta(selectionKey(),organization.id);
    await refresh();
    status.textContent = 'Organisatie aangemaakt.';
  });

  submit('[data-organization-role]',async data => {
    const organization = await selectedOrganization();
    if (!organization) return;
    await service.accountRequest('organization-set-role',{
      organizationId:organization.id,personId:data.get('personId').trim(),role:data.get('role') || null
    });
    await showOrganization(organization);
    status.textContent = 'Rol bijgewerkt.';
  });
}
