# Winkelketens, vestigingen en passen — 0.3.86

Uitvoering van de eerste Nederlandse versie van [#59](https://github.com/Stefan-van-Dijk/sharon/issues/59), bovenop de gedeelde kaartbasis van [#52](https://github.com/Stefan-van-Dijk/sharon/issues/52). Dit document beschrijft de code en de geteste werking; de eerste volledige live OSM-import en echte GPS-/iPhone-controles moeten nog plaatsvinden.

## Omgeving vanaf 0.3.86

Veeg het locatie-icoon omhoog (of gebruik pijl omhoog op het toetsenbord) voor het bronpaneel, net als bij Wikipedia. Dit toont opgeslagen locaties én lokaal beschikbare vestigingen van gekoppelde ketens. Zoeken op naam/adres werkt offline; maximaal dertig resultaten tegelijk, op afstand van het kaartcentrum. Filter op opgeslagen locaties of een gekoppelde keten. Een locatie opent het bestaande locatiedeck; een vestiging opent een board met bronvermelding en Bewaar bij Locaties. Beide bronpanelen sluiten elkaar. Dit haalt geen extra openbare POI-dataset op: andere bekende locaties zijn de al opgeslagen Sharon-locaties.

## Gebruik

- **Kaarten:** kies optioneel een winkelketen bij een bestaande of nieuwe pas. De naam van een pas wordt niet gebruikt om een keten te raden. Catalogus: Albert Heijn (inclusief AH XL en AH to go), Jumbo, HEMA, Lidl, Aldi, PLUS, Dirk, DekaMarkt, Vomar, Spar, Kruidvat, Etos, Action, Gamma, Karwei, Praxis en IKEA. Dekking: Nederland.
- **Onder de pas:** het vestigingenpaneel toont de laatst gesynchroniseerde landelijke gegevens, een handmatige verversknop en maximaal twintig dichtstbijzijnde vestigingen. Een actuele GPS-positie laat één passende vestiging voorselecteren. Bij meerdere passende vestigingen moet de gebruiker kiezen voordat een persoonlijke zone kan worden opgeslagen.
- **Verfijnen:** de bestaande Omgeving-/Locaties-kaartviewer toont het gebied en de huidige GPS-positie. De slider werkt live; alleen loslaten/change bewaart een zone rond de huidige GPS-positie. Geen aparte opslaan- of bevestigingsvraag. De zone kan worden aangepast en de verfijning kan worden verwijderd; de bewaarde locatie zelf blijft bestaan.
- **Omgeving:** de winkelbron toont alleen lokaal beschikbare vestigingen van ketens met een actieve pas. Punten clusteren bij uitzoomen. Kies eventueel één keten. Een punt toont brongegevens en **Bewaar bij Locaties**. Vanuit de pas opent Omgeving met een tijdelijk ketenfilter; dit filter wordt niet als voorkeur bewaard.
- **Locaties:** een bewaarde vestiging heeft een willekeurige Sharon-identiteit en behoudt de bron- en ketenkoppeling. Een reeds bestaande, niet gearchiveerde locatie voor dezelfde vestiging wordt hergebruikt. Een persoonlijke titel, adres en verfijning worden niet door nieuwe brongegevens overschreven.
- **Home/automatische boards:** de bestaande pasvoorstellen en hetzelfde boarddeck werken ook met de expliciete ketenkoppeling. Een pas verschijnt maximaal één keer in de voorstellen, ook als meerdere vestigingen passen. De vestigingkeuze blijft beschikbaar onder de pas. Bezoeksonderdrukking houdt bij ketenpassen ook de vestiging bij.

## Gegevens en herkenning

Keten, vestiging, pas en persoonlijke zone blijven afzonderlijk. De catalogus gebruikt Wikidata-ID's van de keten. Vestigingen krijgen willekeurige twaalfteken-identifiers. Bij volgende imports blijft de identiteit bij dezelfde OSM type/id behouden; meerdere objecten in één gebied blijven afzonderlijk bestaan. Een vervangen OSM-object met een nieuw type/id wordt vooralsnog als een nieuwe bronvestiging behandeld; mogelijke bronduplicaten moeten handmatig worden onderscheiden.

De bronindex bevat per vestiging ID, OSM type/id, zes-teken-gebiedscode, bronpositie in micrograden (of null), naam, adres, bronstatus, OSM-versie/timestamp en openingstijden. Een kaartlabel in Omgeving wordt alleen geplaatst als een bronpositie beschikbaar is. Een broncentrum van een gebouw is geen gegarandeerde ingang.

De zes-teken-code en nabijheidsindex hergebruiken `EnvironmentIdentifier` en `GeographicBranchIndex`. De eerste herkenning gebruikt het midden en een berekende, dekkende straal van het bronvak. Dit midden is herkenningsgeometrie, geen verzonnen exacte winkelpositie. Een persoonlijke zone vervangt deze grove geometrie voor uitsluitend de betreffende vestiging. GPS-onzekerheid telt mee; ketenherkenning en verfijning worden niet gebruikt bij een GPS-onzekerheid groter dan 2 km of een positie ouder dan twee minuten. Er wordt geen nieuwe GPS-polling gestart.

Verdwenen OSM-objecten blijven als **mogelijk gesloten** bewaard. Ze blijven zichtbaar in de bronkaart met een afwijkende kleur/status. Ze leveren geen nieuwe grove automatische match meer op; een bestaande persoonlijke zone blijft leidend. Een OSM-timestamp is geen openings- of sluitingsdatum.

## Synchronisatie

`ChainSyncService` bewaart één lokale broncache in IndexedDB. Alleen ketens met actieve passen worden bewaard. De persoonlijke locaties staan apart in de objectopslag. Het openen van een pas en GPS-events lezen uitsluitend lokale gegevens.

Bij actief gebruik controleert de service of gegevens ontbreken of dertig dagen oud zijn. De controle gebeurt bij opstarten, online/voorgrond komen, een gewijzigde ketenkoppeling en een uurcontrole terwijl de app zichtbaar is. Binnen die maand volgt geen nieuwe netwerkcontrole na een succesvolle controle, ook niet als er geen inhoudelijke wijziging was. Een expliciete verversknop controleert uitsluitend die keten.

Eén JSON POST naar `https://sharon.life/log/api/chains.php` bevat uitsluitend `{schema:1, chains:[{id,version}]}`. Geen GPS, pascode, persoonlijke zone, naam of locatiegeschiedenis. De server weigert extra aanvraagvelden. Het antwoord bevat volledige data bij een eerste/te oude versie, een delta bij een bekende eerdere versie, of `unchanged`. Het register bewaart maximaal drie eerdere bronsnapshots, binnen de downloadlimiet van 8 MB. De client valideert alle gevraagde ketens vóór één atomaire cache-update. Versies uit een ander tabblad worden niet teruggedraaid. `lastCheckedAt` verandert pas na succesvolle verwerking. Fouten behouden bestaande data en persoonlijke zones.

Een pas zonder ketenkoppeling blijft exact werken zoals voorheen. Beschadigde ketengegevens mogen de al bestaande expliciete pas-locatievoorstellen niet blokkeren. In de testomgeving blijft de broncache gescheiden via de bestaande testopslag.

## Centrale bronimport

De workflow downloadt het complete Nederlandse OSM-PBF-bestand van Geofabrik, controleert de gepubliceerde MD5 en selecteert lokaal met Osmium op de catalogusmerken. Osmium exporteert geometrie en type/id/versie/timestamp. `scripts/update-chain-register.mjs` zet die export om naar dezelfde compacte vestigingsrijen. Dubbele lijn-/vlakrepresentaties van één bronobject krijgen één identiteit. De bronpositie is het midden van de geometrische begrenzing. De Overpass-import blijft beschikbaar voor handmatig gebruik zonder exportbestand; de maandelijkse workflow gebruikt Geofabrik. Alleen expliciete `brand:wikidata`-koppelingen worden gebruikt. De bron-ID's zijn gecontroleerd tegen de officiële Name Suggestion Index:

- Albert Heijn: Q1653985; AH XL: Q78163765; AH to go: Q77971185.
- Jumbo Nederland/België: Q2262314; geen verwarring met andere Jumbo-ketens.
- HEMA: Q903805.

Volledigheidsfouten, time-outs, Overpass-remarks en een geheel ontbrekende keten breken de import af. Het bestaande register wordt niet overschreven. De importer bewaart bestaande identiteiten en historie, berekent een inhoudsversie en schrijft pas na succes via een tijdelijke file/rename.

De workflow **OSM winkelregister bijwerken** draait na merge van de importer/catalogus/workflow, op de eerste dag van de maand en via **Run workflow**. De laatst gepubliceerde dataset wordt vóór import teruggelezen, zodat identiteiten behouden blijven. Alleen openbare OSM-brongegevens komen op de aparte branch `data/osm-chains-nl`; geen gebruikersdata en geen wijzigingen aan de appbranch. Die databranche heeft eigen inhoudsversies en vereist geen nieuwe appversie. Er is ook een downloadbaar workflow-artifact.

`chains.php` leest het gepubliceerde register via een vaste GitHub-URL en bewaart het centraal in `log/private/chains/register-v1.json`. Een sidecar-lock en atomaire rename beschermen de cache. Verversen gebeurt maximaal ongeveer maandelijks, wanneer een bundel wordt opgevraagd. Bij een bronfout blijft de oude servercache bruikbaar; een mislukte verversing wordt maximaal eens per uur opnieuw geprobeerd. De endpoint bevraagt zelf geen OSM en heeft geen database of gebruikersaccount nodig.

## Installatie

1. Merge de PR nadat de releasecontroles groen zijn. GitHub Pages publiceert de app; de nieuwe importworkflow probeert automatisch het eerste register te vullen.
2. Controleer in Actions of **OSM winkelregister bijwerken** geslaagd is. Zo nodig opnieuw **Run workflow**. De branch `data/osm-chains-nl` moet een `register-v1.json` bevatten vóór de eerste download kan werken.
3. Upload `server/chains.php` als nieuw bestand naar **`/log/api/chains.php`**, naast `connections.php`. Geen vervanging van `connections.php` voor deze wijziging. PHP 8.3 met HTTPS-downloads/`allow_url_fopen` en schrijfrechten op `log/private/chains` volstaat. De private map wordt met een Apache deny-regel aangemaakt.
4. Als uitgaande HTTPS-downloads op de hosting zijn geblokkeerd: download het workflow-artifact en plaats `register-v1.json` zelf in **`/log/private/chains/`**. Behoud daarna dit bestand; het bevat de stabiele vestigingsidentiteiten. Automatisch centraal verversen vereist werkende uitgaande HTTPS.
5. Open de bijgewerkte app, bewerk een pas, kies een keten en controleer de eerste synchronisatie. Daarna werkt herkenning ook offline in een andere Nederlandse stad.

De bestaande releaseworkflow publiceert uitsluitend GitHub Pages; de PHP-upload blijft een hostinghandeling. De eerste live import is in deze werkomgeving niet gelukt: de Overpass-aanvragen gaven een afwijzing/time-out. Er zijn daarom geen verzonnen of onvolledige vestigingen als productiedataset toegevoegd.

## Bronnen en attributie

- [OpenStreetMap `brand:wikidata`](https://wiki.openstreetmap.org/wiki/Key:brand:wikidata)
- [Name Suggestion Index — broncatalogus](https://github.com/osmlab/name-suggestion-index)
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
- [OpenStreetMap copyright en ODbL](https://www.openstreetmap.org/copyright)

De UI, API en publicatie vermelden **© OpenStreetMap contributors**. De afgeleide bron-database valt onder ODbL 1.0. De importer kopieert geen NSI-code of logo's. Openingstijden worden als brontekst getoond; er wordt geen ongecontroleerd label ‘nu open’ berekend.

## Praktijkcontroles vóór afronding van #59

Echte iPhone/GPS, twee overlappende vestigingen, vijf passen tegelijk, slider bij beperkte locatieprecisie, bronduplicaten/node-way-vervanging, nieuwe installatie vóór eerste download en de volledige live maandelijkse import op GitHub/hosting blijven te controleren. Internationale dekking en meer ketens zijn uitbreidingen op dezelfde gegevenslaag. Dit is geen verklaring dat heel #59 is afgerond.

## Herstel van de eerste import-time-out — 0.3.85

De eerste GitHub-import in 0.3.84 strandde op een time-out voordat het register kon worden gepubliceerd. Die versie bevatte één landelijke regex-aanvraag en logde alleen de laatste fout. De app-releasecontrole zelf was succesvol.

De importer gebruikt nu vijf kleine exacte merkselecties, een serverlimiet van 25 seconden per aanvraag en een clientlimiet van 35 seconden. Bij uitval probeert hij drie gedocumenteerde Overpass-instanties (Private.coffee, overpass-api.de en VK Maps), met maximaal twee rondes en een korte wachttijd tussen rondes. Een werkende bron krijgt bij volgende merken voorrang. GET voorkomt afhankelijkheid van proxies die POST blokkeren; de workflow geeft IPv4-adressen voorrang. Logregels tonen merk, bronserver, poging, resultaat en foutreden.

Een onvolledig antwoord, HTTP-fout of een Overpass-remark wordt binnen de bronpoging afgehandeld, zodat de volgende bron wordt geprobeerd. Eén mislukt deel breekt nog steeds de publicatie van het hele register af; bestaande data en identiteiten worden behouden. Lege optionele merkvarianten mogen wel bestaan, maar elke hoofdketen moet vestigingen hebben. De bron-snapshottijd is de oudste van de volledig opgehaalde deelantwoorden.

Pull requests die de importer, catalogus of workflow wijzigen voeren voortaan ook een live proefimport uit. Daarbij wordt geen databranch gepubliceerd. Alleen een geslaagde main-/maand-/handmatige main-run publiceert brongegevens. De job heeft ruimte voor de begrensde terugvalpogingen; de stappenlog geeft voortgang tijdens het ophalen.

De eerste live proef van deze reparatie gaf nog time-outs bij Private.coffee/VK Maps en HTTP 502 bij overpass-api.de. Daarom is de bronselectie verder beperkt tot het Europese Nederlandse kader, met behoud van het landgebiedfilter. De wereldwijde `shop`-index wordt niet meer op de server doorsneden: de exacte merkselectie komt eerst, waarna alleen objecten met een winkeltag lokaal worden behouden. Bij volledige uitval logt de CLI ook bereikbaarheid van serverstatus en een minimale query. Deze diagnose publiceert geen bronobjectinhoud. Een geslaagde live run blijft vereist om het ophalen als hersteld te beschouwen.
