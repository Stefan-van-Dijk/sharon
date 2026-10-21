# Personen op de bestaande JSON-voorziening van Log

Sharon gebruikt voor Personen en chat dezelfde PHP-voorziening als Log:
https://sharon.life/log/api/connections.php. Er is geen tweede dienst, database,
extra PHP-extensie of CLI-installatie nodig. Het bestaande endpoint krijgt een
uitbreiding voor identiteit en toegangsrelaties in JSON.

## Eenmalig het bestaande serverbestand bijwerken

Vervang met Strato/FileZilla uitsluitend /log/api/connections.php op sharon.life
met server/connections.php uit deze repository. Hetzelfde bestand staat ook in
Log onder server/connections.php en test/server/connections.php. Log is de
bron voor het gedeelde endpoint; houd deze kopieën bij wijzigingen gelijk.

De bestaande /log/private/publish-secret.php met LOG_PUBLISH_KEY blijft in
gebruik. Die sleutel hoeft niet opnieuw ingesteld te worden. De webserver
moet zoals voor Log al nodig is kunnen schrijven in /log/private/connections/.
De uitbreiding maakt daar automatisch network-v1.json en een vast slotbestand
network-v1.json.lock aan. Bewaar een back-up voordat je bestaande servercode
vervangt. Verwijder geen bestaande verbindingsbestanden.

De nieuwe JSON-inhoud mag niet via HTTP bereikbaar zijn. Op Strato/Apache
maakt het endpoint zo nodig een .htaccess met Require all denied in de private
connections-map. Bestaande regels worden niet overschreven. Controleer na
upload dat /log/private/connections/network-v1.json een 403 of 404 geeft en
geen JSON toont. Bij een andere webserver moet dezelfde map door diens
configuratie geblokkeerd zijn. Maak de map niet publiek voor probleemoplossing.

Een frontend-update via GitHub Pages vervangt dit PHP-bestand niet. Zolang de
hosting nog de oude versie uitvoert, werken de nieuwe Sharon-aanroepen nog
niet. Het in GitHub bijwerken van beide repositories bewijst geen live upload.

## Eerste activatie in de app

1. Open Sharon → Personen → Eigen installatie activeren.
2. Vul eenmalig de bestaande publicatiesleutel van Log in en kies
   Maak eenmalige startcode. De server controleert de sleutel tegen de
   bestaande publish-secret.php. Alleen met die sleutel kan de eigenaar
   de eerste startcode maken. Het invoerveld wordt direct leeggemaakt;
   de sleutel wordt niet in de lokale opslag, het JSON-netwerk of de QR gezet.
3. Bevestig Verbinden met Sharon op je eigen toestel. Je kunt de tijdelijke
   code ook als QR tonen en op je eigen andere toestel aannemen. De startcode
   is 15 minuten geldig en kan één installatie eigenaar maken. Alleen vóór
   activatie kan een nieuwe code de vorige vervangen.
4. Laat de ander in Personen Identiteit aanmaken kiezen en de getoonde
   12-teken-ID aan jou geven.
5. Kies Iemand uitnodigen, vul die ID in en deel de uitnodigings-QR of link.
   De uitnodiging is 24 uur geldig en alleen door de gekozen installatie
   aan te nemen. De ander bevestigt de verbinding in Personen.
6. Beide personen kunnen daarna vanuit het contact chatten. Bij een geopende
   zichtbare module wordt iedere minuut ververst; eerder ophalen kan met
   Berichten verversen.

De publicatiesleutel is uitsluitend voor het maken van de eerste startcode.
Verdere verzoeken gebruiken een eigen willekeurig installatiegeheim van
256 bits. De server bewaart daarvan alleen een SHA-256-hash. Een 12-teken-ID
is een verwijzing, geen bewijs van identiteit. Stuur de publicatiesleutel niet
mee in uitnodigingen en plaats hem niet in GitHub of in een bericht.

## Het JSON-netwerk

network-v1.json bevat één 12-teken netwerk-ID, de eigenaar, geregistreerde
personen, uitnodigingen, berichten en expliciete relaties. De verzamelingen
zijn objecten met IDs als sleutel. Bijvoorbeeld, zonder interne credentials:

```json
{
  "schema": "sharon-network-v1",
  "id": "Netwerk00001",
  "ownerId": "Persoon00001",
  "relations": {
    "Relatie00001": {
      "id": "Relatie00001",
      "fromId": "Persoon00001",
      "toId": "Persoon00002",
      "type": "grants-access",
      "status": "active"
    },
    "Gesprek00001": {
      "id": "Gesprek00001",
      "fromId": "Persoon00001",
      "toId": "Persoon00002",
      "type": "chat",
      "status": "active"
    }
  }
}
```

Een chatrelatie en een toegangsrelatie hebben verschillende IDs. Het ID van de
chatrelatie is de chatId van de berichten. De oorspronkelijke toegangslijn
wordt via grants-access afgeleid; een extra chat verandert die lijn niet.
De eigenaar staat op lijn 0, nieuwe deelnemers op lijn 1, 2 of 3. Er zijn
maximaal 100 ooit toegelaten deelnemers, naast de eigenaar. Ingetrokken
identiteiten blijven meetellen. Registreren zonder geaccepteerde uitnodiging
telt nog niet mee en geeft geen toegang tot chats of de ledenlijst.

De API controleert bij iedere handeling de persoonlijke sleutel en de
betreffende relatie. De eigenaar kan met set-access (personId en status
active/revoked) de toegang herstellen of intrekken; het beheerscherm volgt
later. Intrekken verandert de oorspronkelijke relatie-ID niet en trekt niet
automatisch de toegang van nakomelingen in. Alleen de twee actieve
chatdeelnemers kunnen de inhoud van hun chat lezen of wijzigen.

Alle controles en wijzigingen lopen onder één exclusief flock-slot op een
vast zijbestand. Daarna wordt het hele bijgewerkte JSON-document via een
tijdelijk bestand atomair vervangen. Daardoor verliezen gelijktijdige
verzoeken geen relaties en kunnen twee acceptaties de grens van 100 niet
overschrijden. Bij foutieve bestaande JSON wordt geweigerd; de server begint
niet stilzwijgend met een leeg netwerk. Bewerk een actief JSON-bestand niet
handmatig buiten deze vergrendeling.

## Samenwerking met bestaande Log-code

Bestaande Log-aanroepen (create, claim, put, revoke en GET met ConnectionId)
blijven werken met dezelfde gegevensbestanden en versleutelde payloads.
Alleen verzoeken met protocol sharon-network-v1 gebruiken het nieuwe
netwerkdocument. Ze gebruiken dezelfde X-Log-Access-Token-header als Log.
Dit maakt bestaande Log-chats en identiteiten niet automatisch zichtbaar in
Sharon; daarvoor is nog een bewuste import/overdracht nodig.

De eerder voorbereide losse /connection/api.php, SQLite-adapter en setup-CLI
zijn verwijderd. Een eventuele lokaal aangemaakte Sharon-identiteit blijft
bij de overstap dezelfde; de toegang moet op het JSON-endpoint opnieuw worden
bevestigd. Oude SQL-netwerkuitnodigingen en servergegevens worden niet
stilzwijgend als JSON-toegang overgenomen. Lokale historische berichten
worden niet verwijderd. Wis een eventuele oude serverdatabase niet zonder
back-up en controle; deze wijziging migreert die niet.

## Grenzen en controles

De uitbreiding vereist dezelfde PHP 8.1+ hosting en HTTPS als de bestaande
Log-dienst. Het vaste endpoint volgt geen redirects. CORS staat uitsluitend
de huidige GitHub Pages-origin, sharon.life en www.sharon.life toe. Registraties
en verzoeken hebben limieten; onbekende personen krijgen geen netwerkbrede
ledenlijst. Berichten zijn maximaal 8000 UTF-8-bytes en worden in pagina's van
100 opgehaald, maximaal 1000 per verversing.

De nieuwe Sharon-berichten staan als tekst in het private JSON-document.
HTTPS beschermt het transport; de serverbeheerder kan de inhoud lezen. Dit
wijzigt de versleuteling van bestaande Log-payloads niet. Voor een groter
gebruikersbestand is één netwerkdocument met alle berichtinhoud op termijn
minder geschikt; geschiedenis opsplitsen en opschonen kan binnen dezelfde
JSON-voorziening worden toegevoegd. Het ontbreken van een database heft de
noodzaak van back-ups en beheer niet op.

Een niet bevestigde verzending blijft lokaal zichtbaar en kan met dezelfde
identifier opnieuw worden geprobeerd. De server slaat dezelfde verzending
maar één keer op. Ophalen bewaart berichten en de cursor samen; een eigen
verzendbevestiging slaat geen oudere inkomende berichten over.

Herstel, meerdere apparaten en verhuizen naar een andere domeinopslag zijn
nog geen gebruikersfunctie. Het wissen van browseropslag verliest de lokale
sleutel. Een identiteit is hier een installatie, geen geverifieerde unieke
natuurlijke persoon. Tiqets en andere live bronnen staan los van dit netwerk.

npm run verify controleert de PHP/JSON-toegangsregels en een echte lokale
PHP-server met twee gescheiden browseropslagen. Inclusief binding aan de
ontvanger, verlopen codes, intrekking, herstel, chat-isolatie, idempotente
berichten, behoud van bestaande Log-verbindingsbestanden en twee gelijktijdige
claims op de laatste plaats. De PWA-browsertests controleren daarnaast het
frontendpakket. Deze tests bewijzen geen installatie op de echte hosting.
