# Sharon-account en organisaties

De bestaande Sharon-persoon-ID van twaalf tekens is de sleutel voor een account. De server bewaart e-mailverificaties en organisatielidmaatschappen als aanvullende registers in `network-v1.json`. Relaties, netwerktoegang, lokale objecten en ShopList-apparaatkoppelingen gebruiken hun huidige identifiers en opslag. Installaties zonder de nieuwe registers lezen lege accounts. Er is geen offline migratie nodig.

## E-mailverificatie

- Een ingelogd netwerklid geeft een e-mailadres op. De server verstuurt een eenmalige code die na vijftien minuten verloopt. De code is gebonden aan het aanvragende persoon-ID en alleen de hash wordt opgeslagen.
- De server bevestigt elk adres apart. Een genormaliseerd adres kan tegelijk bij één persoon horen. Adressen worden in kleine letters opgeslagen. De inrichting ondersteunt gangbare ASCII-mailadressen.
- Alleen het eigen account kan zijn adressen zien of verwijderen. Een gekoppeld adres geeft in deze versie geen recht op aanmelding. ShopList behoudt zijn beperkte apparaatsleutel. Federatie met Event Line vereist een afzonderlijke aansluiting met eigen, afgebakende rechten.

## Organisaties

| Rol | Handelingen |
| --- | --- |
| Eigenaar | Organisatie kiezen, leden bekijken en rollen beheren |
| Beheerder | Organisatie kiezen, leden bekijken en rollen voor leden en lezers beheren |
| Lid | Organisatie kiezen |
| Lezer | Organisatie kiezen |

Een rol is gebonden aan een organisatie-ID van twaalf tekens. De server bepaalt de rol vanuit het bestaande persoon-ID. De organisatieschakelaar bewaart de keuze per persoon op het huidige apparaat en laat iedere selectie door de server controleren. Persoonlijke netwerkinhoud, shops en lokale objecten vallen onder hun bestaande toegangsregels. Toekomstige organisatiegebonden objecten moeten de organisatie-ID en de bijbehorende rechten zelf afdwingen.

## Uitrol op Strato

1. Maak in de bestaande, afgeschermde privémap een back-up van `connections/network-v1.json`. Gebruik dezelfde map bij een rollback van het PHP-bestand zodat wijzigingen in de tussentijd behouden blijven.
2. Upload de geteste `server/connections.php` als `/log/api/connections.php`. Behoud PHP 8.3 of nieuwer en controleer dat `/log/private/connections/` via HTTP is afgeschermd.
3. Stel `SHARON_ACCOUNT_EMAIL_FROM` in met een afzender die op de Strato-installatie is toegestaan. Als de hosting geen eigen omgevingsvariabele toelaat, plaats dan `/log/private/connections/account-mail.php` met de inhoud `<?php return 'afzender@eigen-domein.nl';`. Het PHP-proces moet dit bestand kunnen lezen.
4. Test de werkelijke aflevering via PHP `mail()` naar een eigen testadres. Controleer ingestelde afzender, ontvangst, eenmalig gebruik en verlopen codes. Bij hosting zonder werkende mailfunctie is een aparte mailtransportintegratie nodig.
5. Controleer na de frontendpublicatie met een eigen testaccount twee bevestigde adressen en een organisatiewissel. Controleer ook een bestaande chat en ShopList-koppeling.
