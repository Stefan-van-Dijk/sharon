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

1. Open Sharon → Codes. Ga via Terug naar Verbinden → Eerste installatie →
   Eigen installatie activeren. Dit is alleen voor de eerste eigenaar nodig.
2. Vul eenmalig de bestaande publicatiesleutel van Log in en kies
   Maak eenmalige startcode. De server controleert de sleutel tegen de
   bestaande publish-secret.php. Alleen met die sleutel kan de eigenaar
   de eerste startcode maken. Het invoerveld wordt direct leeggemaakt;
   de sleutel wordt niet in de lokale opslag, het JSON-netwerk of de QR gezet.
3. Bevestig Verbinden met Sharon op je eigen toestel. Je kunt de tijdelijke
   code ook als QR tonen en op je eigen andere toestel aannemen. De startcode
   is 15 minuten geldig en kan één installatie eigenaar maken. Alleen vóór
   activatie kan een nieuwe code de vorige vervangen.
4. Personen verschijnt na activering in het menu. Daar staan alleen de
   contacten en de knop Verbinding maken. Kies die knop om een QR te tonen.
5. De ander opent Codes in de eigen Sharon-installatie en scant de QR. Een
   eigen identiteit en sleutel worden automatisch aangemaakt. De profielnaam
   wordt uitgewisseld en de chat opent. Ontbreekt een naam, dan wordt die
   eenmalig gevraagd. Vooraf registreren of een persoons-ID overtypen vervalt.
6. Het toestel dat de QR toont controleert elke drie seconden of deze is
   aangenomen, zolang het scherm zichtbaar is. Zodra dat gebeurt opent ook
   daar de chat. Handmatig controleren kan met Verbinding controleren.
7. De ander ziet nu ook Personen en kan zelf een verbindings-QR tonen,
   binnen de bestaande grenzen van 100 deelnemers en drie lijnen.

Een QR is 24 uur geldig en kan door één installatie worden aangenomen.
De eerste scanner wordt onder hetzelfde exclusieve bestandsslot als de
netwerktoegang aan de uitnodiging gebonden. Een herhaalde aanvraag van die
installatie geeft hetzelfde resultaat; een andere installatie wordt geweigerd.
De QR bevat geen blijvende toegangssleutel. Elk toestel bewaart zijn eigen
geheim en krijgt daarmee dezelfde mogelijkheden om verbindingen te maken.
Bestaande, vooraf aan een persoon gebonden uitnodigingen blijven geldig.

Een scan in de app start direct de verbindingsmodule. Een extern geopende
link vraagt eerst bevestiging. De scanner bij Kaarten herkent de
verbindings-QR eveneens en opent de verbindingsmodule in plaats van een pas
te maken. Buiten het netwerk blijft Personen uit het menu; Codes is beschikbaar
om toe te treden. De bestaande eigenaar behoudt zijn identiteit en activering.

De publicatiesleutel is uitsluitend voor het maken van de eerste startcode.
Verdere verzoeken gebruiken een eigen willekeurig installatiegeheim van
256 bits. De server bewaart daarvan alleen een SHA-256-hash. Een 12-teken-ID
is een verwijzing, geen bewijs van identiteit. Stuur de publicatiesleutel niet
mee in uitnodigingen en plaats hem niet in GitHub of in een bericht.

## Camera en contactstroken

Veeg op Home van links naar rechts om de camera direct te openen. Dit kan
ook midden op een menuregel; verticaal scrollen blijft scrollen en naar
links vegen blijft de uitleg bij die menuregel tonen. Codes blijft als
bedienbare menuoptie beschikbaar. Binnen modules blijft de bestaande
terugbeweging gelden en hebben stroken hun eigen veegacties.

De camera herkent een verbindings-QR en opent Verbinden. Andere QR-codes
of barcodes gaan naar Kaarten: een bestaande kaart wordt geopend, een
nieuwe code komt in de kaarteditor. Er wordt niet stilzwijgend een pas opgeslagen.

Personen gebruikt dezelfde objectstroken als de andere modules. Tikken
opent de chat. Naar links vegen toont Bewerk en Verwijder. Bewerken geeft
een eigen naam aan het contact op dit toestel; de identiteit en de naam
bij de ander veranderen niet. Verwijderen haalt het contact na bevestiging
uit deze persoonlijke lijst. De lokale keuze blijft behouden bij verversen
en opnieuw openen. Netwerktoegang en berichtgeschiedenis worden hierdoor
niet ingetrokken of gewist. Opnieuw een verbinding via QR maken herstelt
het contact met dezelfde persoons- en chatidentifier en de eigen contactnaam.
Deze bediening vraagt alleen een app-update; connections.php verandert niet.

## Automatisch verversen en ongelezen berichten

Eén centrale controle werkt zolang de app zichtbaar is. Buiten Chat wordt
iedere minuut de contactenlijst en nieuwe chatinhoud opgehaald. Bij een
geopende chat gebeurt dit direct en daarna iedere vijf seconden. Na één
minuut zonder activiteit wordt dit vijftien seconden; na vijf minuten
wordt dit dertig seconden. Een nieuw bericht of verzending herstelt de
snelle controle. Na verzenden wordt direct opnieuw opgehaald. De app pauzeert
op de achtergrond en ververst direct bij terugkeer. Er is geen handmatige
verversknop meer en een geslaagde verbinding toont geen statuszin.

Personen heeft een plus in dezelfde kopbediening als andere modules.
Ongelezen inkomende berichten krijgen een bolletje bij Personen op Home
en bij de contactstrook. Een eigen bericht geeft geen bolletje. De lokale
leespositie wordt pas verhoogd voor berichten die in de zichtbare chat
zijn getoond. Zij blijft behouden na opnieuw openen. Het ophalen van
berichten buiten Chat maakt ze niet gelezen. Een laat antwoord na het
verlaten van Chat of verbergen van de app wist de melding niet. De
leespositie en de ophaalcursor zijn afzonderlijke, monotone tellers.
Dit zijn meldingen binnen de app; het netwerkprotocol en PHP-bestand
veranderen hiervoor niet.

## Opnieuw beginnen na het verwijderen van network-v1.json

Dit bestand bevat het hele centrale netwerk. Contacten en reeds opgehaalde
berichten kunnen daarna nog zichtbaar zijn uit de lokale appopslag. Het
verwijderen van het serverbestand stuurt geen wisopdracht naar toestellen.
Een serveraanvraag kan automatisch alweer een leeg netwerkdocument maken;
verwijder dat bestand niet steeds opnieuw.

Voor een bewust nieuw netwerk:

1. Werk alle toestellen bij. Sluit andere Sharon-vensters tijdens de reset.
2. Kies op ieder toestel Instellingen → Netwerkverbinding → Opnieuw instellen.
   Bevestig het verwijderen van de lokale netwerkgegevens, contacten en
   chatberichten. Kaarten, locaties, profiel en overige gegevens blijven
   behouden. De oorspronkelijke lokale persoons-ID en toestelsleutel blijven
   bestaan, maar zijn nog niet geregistreerd in het nieuwe netwerk.
3. Kies op het eerste toestel Eigen netwerk starten en activeer met de
   bestaande publicatiesleutel. De server moet hiervoor nog geen eigenaar
   hebben; deze knop wist of vervangt geen bestaand servernetwerk.
4. Toon vanuit Personen een nieuwe verbindings-QR. De overige toestellen
   scannen die na hun lokale reset om aan het nieuwe netwerk deel te nemen.

De reset wordt in één lokale opslagtransactie uitgevoerd en verwijdert
alleen connection-metadata en objecten van het type chat-message. Er gaat
geen wisopdracht naar de server of andere toestellen. Bij ingetrokken of
onbekende servertoegang verwijst Sharon naar deze instellingen; offline
zijn is geen aanleiding voor een automatische reset.

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
PHP-server met twee gescheiden browseropslagen. Inclusief eenmalige QR-claims, bestaande binding aan de
ontvanger, verlopen codes, intrekking, herstel, chat-isolatie, idempotente
berichten, behoud van bestaande Log-verbindingsbestanden en twee gelijktijdige
claims op de laatste plaats. De PWA-browsertests controleren daarnaast het
frontendpakket. Deze tests bewijzen geen installatie op de echte hosting.

## v0.3.78 — compacte contactcode en kaarten delen

Een nieuwe uitnodiging gebruikt `#connect=<identifier>.<sleutel>`: een willekeurige
identifier van twaalf tekens en een AES-GCM-sleutel van 32 bytes. De sleutel blijft
in het URL-fragment; de server ontvangt alleen de identifier en de versleutelde
inhoud. De inhoud bevat de bestaande eenmalige uitnodiging. Scannen of openen
haalt deze inhoud op, ontsleutelt en valideert haar, en vervolgt dezelfde contactflow.
De server controleert bij publiceren dat de uitnodiging van de aangemelde uitgever
is. Een verwijzing verloopt tegelijk met de uitnodiging (24 uur). De bestaande
identiteits-, ontvanger-, eenmaligheids- en toegangscontroles blijven gelden.
Bestaande lange contactcodes en de eigen activatiecode blijven leesbaar.

**Serverstap:** vervang `log/api/connections.php` op sharon.life door
`server/connections.php` uit deze release. Het bestaande private JSON-bestand
blijft behouden. De nieuwe protocolacties zijn `invitation-publish` en
`invitation-resolve`; zonder die serverupdate geeft de app een gerichte melding
bij het maken van een compacte code. Kaarten delen en bestaande chats gebruiken
het bestaande berichtenprotocol en vereisen die nieuwe acties niet.

Op een kaartboard staat **Deel met personen**. Selecteer expliciet één of meerdere
bestaande contacten en bevestig de verzending. Er wordt dezelfde draagbare
kaartinhoud verstuurd als bij de bestaande kaart-QR, zonder lokale object-,
locatie- of persoonidentifiers. De ontvanger ziet een kaartbericht met **Bewaar
kaart**. Bewaren maakt één lokale kaart aan per ontvangen bericht; opnieuw
bewaren hergebruikt die kaart. Een mislukte verzending behoudt het lokale pending
bericht en probeert hetzelfde bericht-ID opnieuw. Bij meerdere ontvangers worden
reeds bevestigde verzendingen in hetzelfde venster niet opnieuw verstuurd.

De flits bij terugkeren uit een chat kwam door verlaagde opacity op alle disabled
knoppen: ook de volledige persoonsstrook werd tijdelijk doorschijnend. Die strook
blijft nu ondoorzichtig tijdens laden. Gelijke monitorupdates bouwen de stroken
niet opnieuw op, zodat ook geopende swipeacties minder snel worden onderbroken.

## v0.3.79 — contact-QR met alleen een identifier

Nieuwe contact-QR's bevatten uitsluitend een willekeurige identifier van twaalf
tekens. Geen webadres, URL-fragment of aparte ontsleutelsleutel. Sharon scant de
code vanuit de app en handelt het verbinden via het vaste serveradres af.
De knop voor kopiëren kopieert dezelfde twaalf tekens.

De uitgever vraagt aangemeld een code aan voor zijn bestaande uitnodiging
(`invite-code`). De server bewaart de code gehasht, gekoppeld aan de hash van
die uitnodiging, met dezelfde vervaldatum van 24 uur. Bij `accept-code` moet de
scanner zich met de eigen installatie-identiteit authenticeren. De server claimt
de uitnodiging onder de bestaande lock en legt de persoons- en chatrelaties vast.
De eerste toegestane ontvanger bindt de code aan zijn identiteit; een ander kan
dezelfde code niet overnemen. Dezelfde ontvanger mag een onbevestigde aanvraag
opnieuw proberen zonder een tweede contact of chat te maken. Een verlopen code
kan niet verbinden. De gewone ontvanger-, toegangs- en capaciteitscontroles blijven
gelden. De code is tijdens zijn geldigheid zelf het tijdelijke toegangsbewijs.

Een niet-claimende controle (`invite-code-check`) onderscheidt twaalf tekens in
een contact-QR van twaalf tekens in een gewone kaart-QR. Deze controle geeft
alleen een ja/nee-resultaat terug, geen persoonsgegevens of uitnodigingstoken.
Gewone barcodes worden niet als contactcode opgezocht. Er komt geen nieuwe
instelling of keuze voor de gebruiker bij.

Bestaande lange verbindingslinks, versleutelde verwijzingen uit v0.3.78 en eigen
activatiecodes blijven leesbaar. **Serverstap:** vervang opnieuw
`log/api/connections.php` door `server/connections.php` uit deze release. Het
bestaande private netwerkbestand blijft behouden. Deze wijziging betreft de
contactuitnodiging; zij verandert de opslag van chatberichten niet.
