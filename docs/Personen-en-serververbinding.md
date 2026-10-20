# Personen en eerste serververbinding

## Wat deze module doet

Personen verbindt een installatie met de PHP-dienst op
https://sharon.life/connection/api.php. De frontend werkt op GitHub Pages.
De PHP-dienst wordt afzonderlijk op de hosting geplaatst; een GitHub Pages-
publicatie activeert die dienst niet.

Een eigen installatie wordt eenmalig geactiveerd met een startcode. Elke
installatie bewaart een eigen 12-tekenidentiteit en een willekeurig geheim
van 256 bits in IndexedDB. De server bewaart uitsluitend de hash van dat
geheim. Het geheim staat niet in een QR-code, instellingenexport of URL.

Een startlink bevat een 15 minuten geldige eenmalige code en een
netwerkidentifier in het URL-fragment. Een uitnodiging is 24 uur geldig
en vooraf gebonden aan de reeds geregistreerde identiteit van de ontvanger.
Bij openen verwijdert Sharon de code uit de URL en bewaart hem lokaal tot
de gebruiker de verbinding bevestigt. De server bepaalt de geldigheid.

Herhaling van dezelfde geslaagde activatie met dezelfde installatie
herhaalt het resultaat, bijvoorbeeld na een verloren HTTP-antwoord. Een
andere installatie krijgt daarmee geen toegang.

## Installatie op de PHP-host

Vereist: PHP 8.1 of hoger met PDO SQLite, HTTPS, schrijfrechten voor de
PHP-gebruiker in een private map en correcte doorgifte van de HTTP-header
Authorization aan PHP. De CI gebruikt PHP 8.3 en test PDO SQLite expliciet.

1. Plaats api.php en Connection.php uit server/connection/ in de publieke
   hostingmap /connection/. setup.php is alleen een CLI-hulpmiddel en kan
   buiten de publieke map blijven, naast Connection.php.
2. Maak een map buiten de documentroot met rechten 0700 voor de
   PHP-gebruiker. Stel SHARON_CONNECTION_DB voor zowel PHP-webverzoeken
   als de CLI in op een absoluut pad, bijvoorbeeld
   /home/ACCOUNT/private/sharon/connection.sqlite.
3. Maak de database en een startlink aan vanuit de server-checkout:

   SHARON_CONNECTION_DB=/home/ACCOUNT/private/sharon/connection.sqlite php server/connection/setup.php

   De nieuwe database krijgt door umask 0077 private rechten. De uitvoer
   bevat een geheime startlink: deel die niet en bewaar hem niet in GitHub
   of een ticket. Opnieuw uitvoeren vóór activatie vervangt de oude code.
   Na activatie kan setup de eigenaar niet opnieuw instellen.
4. Controleer https://sharon.life/connection/api.php: het antwoord moet
   {"ready":true} zijn. Een fout bevat geen databasepad of geheimen.
5. Open op je eigen toestel Sharon → Personen en plak de startlink bij
   “Startlink of uitnodigingslink”. Kies “Code bekijken” en bevestig
   “Verbinden met Sharon”. Doe dit binnen 15 minuten.
6. Laat de tweede persoon in Personen “Identiteit aanmaken” kiezen en diens
   identiteit aan jou doorgeven. Kies op jouw toestel “Iemand uitnodigen”,
   vul die identiteit in en maak de uitnodiging.
7. Laat de ander de QR scannen vanuit Personen of de link plakken en
   bevestigen. Aan beide kanten verschijnt een contact. Open het contact
   en verstuur een bericht. Binnen de geopende module wordt iedere minuut
   ververst; “Berichten verversen” haalt eerder nieuwe berichten op.

De CLI toont een startlink. Een scanbare uitnodigings-QR wordt in de app
gegenereerd met de meegeleverde lokale QR-bibliotheek. Een bestaande startlink
kan ook in een Sharon-installatie worden bekeken als QR; gebruik geen
externe QR-generator voor een geheime startcode.

Als je HTTP achter een proxy termineert, configureer de webserver zodat PHP
HTTPS=on ontvangt voor werkelijk beveiligde verzoeken. De dienst vertrouwt
geen willekeurige X-Forwarded-Proto-header. Alleen de lokale PHP-testserver
mag voor tests HTTP gebruiken.

Voor Apache/PHP-FPM moet Authorization soms expliciet worden doorgestuurd.
Controleer dit met de tweetoestellentest. Bewaar de database én een
consistente back-up van de bijbehorende SQLite-bestanden buiten de
documentroot. Een database kan berichtinhoud en persoonsgegevens bevatten.

## Toegang en relaties

De eigenaar staat op lijn 0. De eerste 100 geaccepteerde deelnemers staan
op lijn 1, 2 of 3. Een nieuwe deelnemer krijgt de lijn van de uitnodiger
plus één. Uit lijn 3 kunnen geen nieuwe deelnemers worden toegevoegd.
Een bestaande deelnemer kan wel een extra chatverbinding aannemen zonder
dat diens oorspronkelijke uitnodigingsrelatie verandert.

De grens telt ooit toegelaten identiteiten, ook na intrekking. Dit
verifieert geen unieke natuurlijke personen: meerdere installaties kunnen
bij één mens horen. Het bestaande domeinmodel server/access/AccessNetwork.mjs
blijft het beleidsreferentiepunt; de PHP-adapter test dezelfde grenzen met
echte SQLite-transacties. Elke nieuwe uitnodiging noemt één geregistreerde
ontvanger. Alleen het geheim van diens installatie kan haar aannemen.

Alle claims en beleidswijzigingen worden in BEGIN IMMEDIATE-transacties
uitgevoerd. De limiet kan dus niet door gelijktijdige acceptaties worden
overschreden. Iedere API-actie controleert de authenticatie. Alleen de
twee deelnemers lezen of schrijven in hun chat. Er is geen openbare
ledenlijst. Intrekking in de database blokkeert de betreffende deelnemer
en chats met die deelnemer, zonder automatisch diens nakomelingen te blokkeren.
Een beheerscherm voor intrekken/herstellen volgt later.

De bestaande publicatiesleutel blijft buiten deze module en buiten de
start-QR. Tiqets en andere live bronnen staan los van deze toegangslimiet.

## Berichten en beperkingen van deze eerste versie

Berichten staan op de server en worden op het toestel bewaard na ophalen.
HTTPS beschermt het transport; dit is geen end-to-endversleutelde chat.
De serverbeheerder kan de inhoud lezen. De interface vermeldt dat.

Een bericht krijgt vóór verzending een identifier. Een niet bevestigde
verzending blijft lokaal zichtbaar en kan met dezelfde identifier opnieuw
worden geprobeerd. De server slaat een herhaalde verzending maar één keer
op; een gewijzigde inhoud met dezelfde identifier wordt geweigerd. Er is
geen automatische verzending vanuit een achtergrondwachtrij.

Bij opnieuw openen gebruikt hetzelfde toestel zijn bewaarde identiteit.
Bij wissen van browsergegevens, een andere browser/PWA-opslag of overgang
naar een ander domein gaat deze toegang niet automatisch mee. Herstel,
meerdere apparaten, sleutelrotatie en domeinmigratie moeten nog worden
gebouwd voordat gebruikers hun identiteit betrouwbaar kunnen meenemen.
Gebruik bij voorkeur steeds dezelfde geïnstalleerde app en scan ontvangen
codes daarbinnen.

Registratie en verzoeken hebben serverlimieten. Verlopen of niet
geaccepteerde registraties tellen niet als deelnemer maar blijven in deze
eerste versie staan; ook verlopen uitnodigingen worden nog niet opgeschoond.
Er zijn maxima voor registratie (10000 identiteiten), verzoekgrootte
(16 KiB), berichtgrootte (8000 UTF-8-bytes), en ophalen (100 berichten per
pagina, maximaal 1000 per verversing). CORS staat alleen Sharon en de
huidige GitHub Pages-origin toe. De app haalt nooit een serveradres uit
een ontvangen QR-code en volgt geen API-redirects.

## Controle

npm run verify voert PHP-beleidscontroles en integratietests uit met een
lokale PHP-server, echte SQLite-database en twee gescheiden browseropslagen.
De tests omvatten activatie, ontvangerbinding, verlopen codes, onbevoegde
chattoegang, herhaalde verzending, herverbinden, intrekking en gelijktijdige
acceptatie van de laatste beschikbare plaats. De bestaande PWA-tests
controleren daarnaast de opstart- en updateketen van het frontendpakket.
Dit bewijst nog geen installatie of werking op de echte hosting.
