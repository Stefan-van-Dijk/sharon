# Sharon-account, release 0.5.26

Onder Apps verbinden staat het account boven de uitleg en de appstroken. De boards
van ShopList en Eventline zijn openbaar te bekijken. Aanmelden maakt de knop
Verbinden beschikbaar. Een verbonden app opent schermvullend. Via de Sharon-knop
keer je terug. Een swipe naar links toont Deactiveren.

Registreren vraagt een e-mailadres en een wachtwoord van minimaal twaalf tekens.
De gebruiker plakt de code uit de bevestigingsmail in het accountboard, bevestigt
het wachtwoord en logt in. Nieuwe code aanvragen en Wachtwoord vergeten werken
vanuit hetzelfde board. Codes verlopen na een uur en zijn eenmalig. Een sessie
verloopt na twee uur. Wachtwoordherstel trekt alle accountsessies in.

## Installeren op sharon.life

1. Maak een herstelkopie van het bestaande PHP-bestand en de private map
   `/log/private/connections`. Bewaar deze buiten de openbare website.
2. Upload `server/connections.php` naar `/log/api/connections.php`.
3. Upload `server/account-config.example.php` als
   `/log/private/account-config.php`. Vul bij `mailFrom` een bestaande mailbox in
   die de hosting als afzender toestaat. De omgevingsvariabele
   `SHARON_ACCOUNT_MAIL_FROM` heeft voorrang als die is ingesteld.
4. Upload `server/account-mail-retry.php` naar `/log/api/account-mail-retry.php`.
   Een geplande taak kan `php /absoluut/pad/log/api/account-mail-retry.php` iedere
   vijf minuten uitvoeren. De account-endpoints proberen de wachtrij ook opnieuw.
5. Vul ook een willekeurige serversleutel van minimaal 32 tekens in bij
   `eventlineKey`. Zet dezelfde sleutel bij `SHARON_APP_KEY` in de
   Eventline-serverconfiguratie. De omgevingsvariabele `SHARON_EVENTLINE_KEY`
   kan de sleutel aan Sharon-zijde instellen. Bewaar de sleutel op de servers.
6. Publiceer daarna het gecontroleerde Sharon-pakket via de bestaande
   GitHub Pages-workflow.

De PHP-bestanden vereisen PHP 8.1 of hoger en een werkende PHP-mailfunctie.
Controleer dat de private map via HTTP wordt geweigerd en dat de webserver de
bestanden kan lezen en schrijven. De accountgegevens, wachtwoordhashes,
sessiehashes en mailwachtrij worden in het bestaande private `network-v1.json`
bewaard. Gebruik voor uitgaande e-mail de DNS- en afzenderinstellingen van de
gekozen hostingmailbox.

GitHub Pages publiceert de webclient. Het uploaden van PHP en de configuratie van
de mailbox gebeuren op de eigen hosting.

## Bestaande gegevens en toegang

Bij de eerste succesvolle aanmelding bewijst Sharon de bestaande lokale
identiteit met de installatiesleutel. Het account wordt aan die `personId`
verbonden. Daarmee blijven lijsten, koppelingen en netwerkrechten bij dezelfde
identiteit. Een tweede account kan deze installatie niet overnemen. Een account
dat al aan een andere installatie-identiteit is gebonden krijgt een melding.
Herstel op een ander toestel eerst de bestaande Sharon-back-up om dezelfde
identiteit te gebruiken. Lokale gegevens worden door de accountregistratie niet
automatisch naar een nieuw toestel gesynchroniseerd.

Nieuwe accounts kunnen ShopList koppelen zonder uitnodiging voor het
gespreksnetwerk. Gesprekken gebruiken de bestaande netwerktoegang. Bestaande
ShopList-koppelingen krijgen toegang nadat hun Sharon-identiteit aan een
geverifieerd account is verbonden. De backend controleert bij iedere Shop-actie
de accountbinding en de bestaande lijstbevoegdheden. De ingebouwde ShopList
ontvangt uitsluitend de toegestane appacties via de bestaande berichtenbrug.

Eventline gebruikt voor de functies binnen Sharon de accountcontrole. Bij openen
vraagt Eventline via de bestaande berichtenbrug een eenmalige code aan. De
Eventline-server wisselt deze met de gedeelde serversleutel bij Sharon in. De
code verloopt na zestig seconden en wordt bij gebruik verwijderd. Uitloggen uit
Sharon maakt nog ongebruikte codes ongeldig. Eventline krijgt de geverifieerde
accountverwijzing, de naam en het e-mailadres. De accountsessie en de permanente
installatiesleutel blijven bij Sharon. De gekoppelde Eventline-release en de
serversleutel moeten samen met deze release worden geïnstalleerd. Ritten, Taken, Pasjes en Gesprekken hebben informatieboards in
het accountoverzicht en gebruiken hun bestaande modules en opslag.

## Controle voor publicatie

- Voer `npm run verify`, `npm run test:pwa` en `npm run test:boards` uit.
- Test op de hosting registratie, ontvangst van de mail, een verkeerde code,
  bevestigen, inloggen, nieuwe code aanvragen, wachtwoordherstel en uitloggen.
- Controleer op iPhone het accountboard, de terugkeer uit apps en de swipeactie.
- Test een bestaande identiteit met lijsten en contacten en een nieuwe identiteit
  zonder netwerkuitnodiging. Controleer dat een tweede account op hetzelfde
  toestel wordt geweigerd.
- Test dat Shop-API-verzoeken zonder accountsessie worden geweigerd en dat een
  ingetrokken Shop-installatie haar toegang verliest.

De automatische tests gebruiken een mailafzender die berichten opvangt. De echte
mailbezorging en de hostingconfiguratie moeten vóór livegang worden gecontroleerd.

## Herstel

Bewaar het vorige releasepakket en het vorige PHP-bestand samen met de private
herstelkopie. De nieuwe accountvelden zijn aanvullingen op het bestaande JSON.
Een oudere serverversie kent de nieuwe accountcontrole niet. Als terugzetten
nodig is, scherm dan de Shop-endpoint tijdelijk af tot het gewenste toegangsbeleid
weer is gecontroleerd. Zet een private herstelkopie alleen terug na beoordeling
van gegevens die sinds het maken van de kopie zijn gewijzigd.
