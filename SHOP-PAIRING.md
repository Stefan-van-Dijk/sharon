# Shop koppelen — 0.5.26

Upload `server/connections.php` naar `/log/api/connections.php` op sharon.life.
Behoud configuratie en private gegevens. GitHub Pages plaatst dit PHP-bestand niet.

Registreer en bevestig eerst een Sharon-account via Apps verbinden. De installatie en mailconfiguratie staan in [Accounts](server/ACCOUNTS.md). Open daarna het ShopList-board en kies Koppelcode maken. Bij geweigerde klembordtoegang verschijnt Kopieer code als herhaalactie.
Het maken van de code geeft één Shop-installatie toestemming voor toegang tot de
boodschappenlijsten van deze identiteit, binnen bestaande lijstbevoegdheden.
De code bestaat uit twaalf willekeurige tekens en is zeven dagen geldig.

In Shop druk je op het Sharon-logo. De app raadpleegt het klembord alleen tijdens
die bewuste klik. Een tijdelijke menuoptie verschijnt bij een geldige code of als
toestemming/opnieuw proberen nodig is. De browser kan een plakbevestiging vragen.
Gewone klembordinhoud wordt niet opgeslagen of verstuurd. Alleen een exact passende
code wordt bij het afzonderlijke koppelprotocol gecontroleerd; kaarten en contacten
kunnen geen toegang verlenen. Controleren verbruikt de code niet.

Na kiezen van Koppelen met Sharon bewaart Shop eerst een eigen apparaatsleutel.
De server bindt de overdracht aan die sleutel, maar geeft nog geen lijsttoegang.
Na duurzaam lokaal opslaan bevestigt Shop de ontvangst; de server activeert dan de
verbinding en verwijdert de tijdelijke code. Herhalen met dezelfde sleutel is veilig,
ook na een verloren bevestigingsantwoord. Sharon toont pas daarna Shop verbonden.
Het open Sharon-koppelscherm controleert iedere vijf seconden als het zichtbaar is
en bij terugkeer; sluiten verwijdert de timer en listener.

Bestaande actieve koppelingen krijgen toegang zodra de eigenaar de Sharon-identiteit aan een geverifieerd account heeft verbonden. Oude lange codes blijven hun oude
bevestigingsroute gebruiken. Nieuwe codes gebruiken uitsluitend de compacte route.
Een gekoppelde Shop leest het klembord niet opnieuw en vervangt geen identiteit.
Verbinding intrekken blijft beschikbaar. Na koppelen synchroniseert Shop alle lokale actieve lijsten naar de eigen identiteit.
Toegang voor andere personen ontstaat uitsluitend via Delen. De code geeft geen toegang tot chats, contacten of netwerkbeheer.


## Lijstbeheer
Archiveren is per persoon en telt als behouden. Via Archief kan dezelfde persoon
herstellen. Verwijderen beëindigt het lidmaatschap van die persoon, inclusief diens
gekoppelde installaties. Andere deelnemers behouden hun rechten. Vertrekt de eigenaar,
dan neemt een bestaande schrijver het beheer over; zonder schrijver blijven lezers
lezers. Alleen zonder eigenaar én zonder deelnemers wordt de lijst verwijderd.
Shop haalt bij terugkeer, iedere 30 seconden en via het logo de lidmaatschappen op
voordat wijzigingen worden verstuurd. Onverzonden wijzigingen van een verdwenen
lidmaatschap blijven als lokale archiefkopie behouden.

Release samen met Stefan-van-Dijk/shop: eerst connections.php uploaden, daarna beide
clients. Controleer op iPhone het automatisch kopiëren en de plakbevestiging en test
verwijderen/archiveren met twee echte identiteiten. De bestaande private gegevens
blijven op hun huidige locatie.
