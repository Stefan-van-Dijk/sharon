# Winkelregister 0.4.54 — implementatie en gecontroleerde uitrol

## Uitgangssituatie, gecontroleerd op 1 november 2026

Basis: main `07790a39a61cdc2af65ec60b1d219b22ca8abfc4` (0.4.53). Geen open PR's bij aanvang. PR's 233–235 zijn al gemergd: doorzoeken pauzeren, boardlogica en sneller verversen van Wikipedia. Deze wijzigingen zijn behouden.

Er bestond al wereldwijde Overpass-discovery in `server/chains.php`: `shop=*` plus geselecteerde amenities, maximaal 2.000 kaartpunten en details op aanvraag. De NL-import selecteerde alleen merken. De wereldroute gebruikte een SHA-afgeleide ID; de import willekeurige 12-teken-ID's. De kaart dedupliceert op OSM-reference en beoordelingen gebruiken die reference; persoonlijke locatiekoppelingen gebruikten alleen de branch-ID.

**Werkelijk aangetroffen:** databranche `data/osm-chains-nl` bevat alleen `register-v1.json` met 17 ketens / 6.649 vestigingen, brondatum 22 oktober 2026. Het gedownloade artifact 12552754064 van run 40075417190 bevat wel 2.243 merken / 50.155 vestigingen (brondatum 23 oktober), `browse-v1.json` en detailbestanden. Dit is dus geen bewijs dat het uitgebreide register op de live PHP-server staat. Geen live POST uitgevoerd: zo'n verzoek kan de servercache wijzigen. Geen productiegegevens of serverbestanden gewijzigd.

## Implementatie

- `scripts/build-chain-browse.mjs`: alle actieve `shop=*`-objecten, ook zonder merk of naam; `no` en `vacant` worden niet als actieve winkel getoond. Bestaande merk/amenity-import blijft bruikbaar. Landcode als parameter; `buildInternationalBrowse` combineert NL/BE/DE-extracten met één model.
- `scripts/shop-register.mjs`: persistent organisatiemodel en vestigingsledger, oude wereld-ID als alias, verdwenen bronnen blijven als `possibly-closed` bestaan. Namen, handelsnamen, externe identifiers, optionele moederrelatie, operator, adresvelden, bronversie/tijd en ODbL-herkomst staan bij de details. Een afwijkende operator wordt geregistreerd; dat bewijst op zichzelf geen franchisecontract.
- `server/chains.php`: bestaande map/detail-API kan geïnstalleerde `shop-tiles/manifest.json` gebruiken; leest alleen betrokken geografische bestanden en één detailbestand. Wereldwijde discovery gebruikt het importregister voor canonieke ID's. Nieuwe wereld-ID's zijn willekeurig en blijven in `world-identities/` bewaard, los van de wegwerpbare responsecache. Ook oudere hash-ID's en eerder uitgegeven wereld-ID's blijven geldige detailreferenties voor hun eigen bron.
- `ChainBrowse.js`: ontbrekende stroken ophalen bij overlap, maximaal vier deelverzoeken, anders één begrensde gebiedsaanvraag. Maximaal 32 bezochte gebieden en 16 request/detail-cache-items. Eerder opgehaalde details blijven bij netwerkuitval bruikbaar tijdens de sessie; mislukte/afgebroken nieuwe gebieden worden niet als compleet opgeslagen. Truncated resultaten gelden nooit als complete gebiedsdekking.
- `ChainLayer.js`: kleinere analyseafstand beperkt ook de aanvraag; bestaande 10-km-discoverylimiet, zoomdrempel, 400-ms vertraging, annulering en pauzeren tijdens boards blijven behouden. Grotere analyseradii leveren geen volledige 200-km-download op.
- `ChainModel.js` / `ObjectStore.js`: opslag herkent dezelfde OSM-reference ook na ID-migratie. Eigen titel, GPS, straal, object-ID en bestaande branch-ID blijven behouden; canonicalBranchId is aanvullend. Geen bulkmutatie van gebruikersgegevens.
- Versie 0.4.54; de vele overige JS/HTML-wijzigingen zijn de vereiste releaseversies in imports en offline-assets.

De bestaande gecombineerde boards, categorieën, sortering, centrering, swipes, delen en feedback blijven de UI. Zelfstandige winkels vullen geen enorme ketenkeuzelijst: de organisatie staat bij de vestiging, de bestaande chainId blijft alleen een compatibiliteits-/filterrelatie.

## Geografische keuze en begrenzingen

De bestaande EnvironmentIdentifier-hiërarchie wordt hergebruikt: vier tekens geven een cel van 360/4096 bij 180/4096 graden. Zes tekens blijven geschikt voor bestaande zeer lokale herkenning. Geen H3/WASM/bibliotheek nodig. Immutable bestanden hebben een SHA-256 in hun naam en worden voor gebruik gecontroleerd. Kaartrecords houden de bestaande zes velden; categorieën staan apart, adressen en organisatiegegevens uitsluitend bij details.

De wereldroute blijft Overpass-first; het geïnstalleerde NL-register is de bestaande fallback en levert stabiele identiteiten. De geografische serverroute is dus gereed en getest, maar vervangt nog niet wereldwijd alle Overpass-verzoeken. Buiten NL wordt bij bronuitval geen dekking verzonnen. Grenzen rond de datumgrens/polen houden voorlopig de bestaande beperkingen van één non-wrapping box. Bij >2.000 resultaten moet verder worden ingezoomd/gefilterd. Gebieden op het apparaat zijn sessiegeheugen, geen onbeperkte offline wereldkaart.

Fase 3 vereist een beheerde import-/publicatiecyclus, coverage-metadata voor volledige en lege cellen, bronmonitoring en een duurzame identity-backup. Pas dan kan de wereldroute per volledig gedekte cel rechtstreeks uit het register antwoorden. De importer leest een GeoJSON-extract in geheugen: gebruik regionale/country-extracten, geen planet-GeoJSON. De v1-compatibiliteitsuitvoer stopt boven 16 MB; detail/kaartshards boven 2 MB worden geweigerd. Deze grenzen voorkomen stille onvolledige publicaties en vragen bij overschrijding een kleinere exportregio of uitsluitend v2-publicatie. Dezelfde datatype/API-architectuur blijft bruikbaar.

## Deduplicatie en identiteit

Een herhaalde OSM-reference is één vestiging. Verschillende objecten in één gebouw worden niet automatisch samengevoegd. `duplicateEvidence` geeft alleen een reviewkandidaat bij gelijke genormaliseerde naam, land, unit/verdieping, adres, website en maximaal 15 meter afstand. Deze kandidaatfunctie is getest, maar er is geen automatische fuzzy merge of Overture-import geactiveerd. Een toekomstig goedgekeurd mergebesluit moet alle bronreferenties en oude ID-aliases bewaren. Onzekerheid resulteert in twee records, niet in verlies van een winkel.

Organisatiegroepen op basis van historische chainId blijven voor compatibiliteit bestaan; een gelijk merk is geen juridisch bewijs van dezelfde onderneming. Buiten geïmporteerde organisaties krijgt live discovery voorlopig een eigen organisatie-ID per vestiging. Juridische moeder-/franchiseverbanden en bronvervangingen vereisen betrouwbare aanvullende gegevens of een gecontroleerd besluit.

## Bronnen en licenties (onderzoek 1 november 2026)

OSM is wereldwijd beschikbaar, maar lokale volledigheid en actualiteit verschillen. Geofabrik-country/regio-extracten kunnen lokaal op shop-tags worden gefilterd; Overpass is geschikt voor begrensde ontdekkingsvragen, niet voor een planetimport. De bestaande UI toont OSM-attributie. Publiceer de afgeleide openbare database met ODbL en bronvermelding; persoonlijke kaarten en voorkeuren gaan niet naar deze database.

Overture Places is een mogelijke aanvullende wereldwijde bron. De actuele documentatie beschrijft circa 88 miljoen plaatsen, uiteenlopende providers en kwaliteit/confidence/status-velden. Het is geen garantie op actuele of volledige winkeldekking. GeoParquet kan geografisch worden geselecteerd met bbox/Python-client/DuckDB. Downloads hebben geen betaalde API nodig, maar verwerking, opslag en overdracht zijn niet kosteloos.

Licenties verschillen per provider: onder andere CDLA Permissive 2.0, Apache 2.0 (Foursquare, inclusief NOTICE) en CC0 (AllThePlaces). Overture Places bevat volgens de huidige gids zelf geen OSM. Een combinatie met OSM kan echter een ODbL-afgeleide database opleveren. Daarom nu **uitsluitend OSM**. Een Overture-proef bewaart bron, release en licentie per record, importeert alleen gecontroleerde providers, behoudt verplichte licentie-/NOTICE-teksten en ondergaat een aparte beoordeling vóór samenvoeging of herpublicatie. Er zijn geen betaalde API's aangeschaft of aangeroepen.

Primaire bronnen:
- https://www.openstreetmap.org/copyright
- https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- https://docs.overturemaps.org/guides/places/
- https://docs.overturemaps.org/attribution/
- https://docs.overturemaps.org/getting-data/

## Migratie en terugval — nog handmatig uit te voeren

1. Bewaar de huidige serverbestanden, `register-v1.json`, `browse-v1.json`, details en bestaande identity-ledgers. Controleer welke browse-ID's daadwerkelijk zijn uitgegeven. Het teruggevonden artifact is de workflow-bootstrap; als productie daarvan afwijkt moet die productieversie als migratiebasis worden gebruikt.
2. Bouw een kandidaat in een stagingdirectory. De workflow herstelt het oude artifact als de databranche geen browse bevat, en stopt als deze bron niet beschikbaar is of geen 50.155 records bevat. Het artifact vervalt op 22 januari 2027: archiveer vóór die datum de gecontroleerde migratiebasis. Een ontbrekend ledger na een v2-uitrol mag nooit stilzwijgend worden vervangen; herstel de backup.
3. Controleer aantallen, ID-behoud, tile-/detailhashes en grensgebieden. De workflow levert artifacts; publiceren is alleen mogelijk met expliciete `workflow_dispatch` en `publish=true` op main. PR/push/schedule publiceren de nieuwe data niet automatisch.
4. Na afzonderlijke toestemming: plaats de gecontroleerde `server/chains.php` en `shop-tiles/` onder de bestaande private chains-map. Eerst immutable bestanden, daarna atomisch het manifest. De server downloadt deze tiles niet automatisch. Zorg voor schrijfrechten op `world-cache/` en **duurzame** `world-identities/`; beide blijven buiten de webroot. Bewaar de importer-sidecar `browse-v1.json.identities.json` voor volgende imports.
5. Test kaart, details, bestaande passen/locaties, pauze/doorzoeken, bronuitval en gecombineerde sortering. Rol bij problemen servercode en manifest terug; verwijder geen identities of persoonlijke data. Oude bestanden kunnen pas na een vastgestelde bewaartermijn worden opgeruimd.

Voor BE/DE: dezelfde importer met landcode of `buildInternationalBrowse([{countryCode:'NL',data:nl}, ...], register, previous)`; sourceTimestamp moet de oudste extractdatum zijn. Gebruik de vorige gecombineerde ledger. De internationale fixtures zijn getest; echte BE/DE-country-imports en een landelijk volledige NL-shop-import zijn in deze sessie niet gedownload of uitgerold.

## Meting en verificatie

`scripts/benchmark-shop-register.mjs /pad/naar/uitgepakt-artifact` herhaalt de echte 50.155-record migratie zonder publicatie. Dit is een replay van het oude artifact, geen nieuwe OSM-landimport. Alle 50.155 ID's blijven in het ledger behouden, inclusief niet-actieve records. Eerste meting circa 3,3 seconden; 1.216 geografische tiles; mediaan 1.115 bytes, maximum 108.166 bytes; manifest circa 650 KB tegenover het oude 4,08 MB landelijke bestand. Immutable data circa 38,2 MB plus circa 21,7 MB ledger, exclusief v1-compatibiliteitskopie en historische versies. Extra zelfstandigen vergroten deze aantallen; die opslag is nog niet gemeten. Op het apparaat blijft ieder antwoord maximaal 2.000 lichte punten.

Live identity-ledgers zijn verdeeld over maximaal 256 bestanden, met maximaal 16 MB per bestand en atomische batchwrites onder het bestaande requestslot. Zij mogen niet met de 15-minuten responsecache worden gewist. Plan backups en opslagbewaking. Importcompute en serveropslag nemen toe; er is geen maandprijs vastgesteld, omdat hostcapaciteit en volledige nieuwe importomvang nog ontbreken.

Nieuwe tests: zelfstandigen/ketens/operatorrelatie, Unicode/adresvelden, NL/BE/DE samen, verdwenen/heropende vestigingen, legacy-identiteiten, conservatieve duplicaatkandidaten, PHP tile/detail/world-route, hashcontrole, duurzame random ID's, ontbrekende gebiedsstroken, cachelimieten, netwerkuitval, zoekstraal en persoonlijke migratie. Bestaande unit/server- en DOM-integratietests controleren daarnaast boards, sortering, selectie, passen, swipes en delen.

Lokale eindcontrole: `npm run verify` geslaagd, **307 unit/server-tests + 116 DOM-integratietests**, bron-/versiecontrole, build en release-integriteitscontrole. PHP 8.3.6 en Node 24.22.1 (repository vraagt 24.19.0). Migratiereplay opnieuw geslaagd: 50.155/50.155 IDs, 2,9 seconden, 38.135.727 bytes immutable bestanden + 21.678.918 bytes ledger. `git diff --check` schoon.

`npm run test:pwa` en `npm run test:boards` zijn geprobeerd maar lokaal geblokkeerd doordat Chromium/WebKit ontbreken. `npx playwright install chromium webkit` mislukte met onvolledige ZIP-downloads. Dit is **geen geslaagde browsercontrole**; de GitHub PR-workflow moet deze controles nog uitvoeren. De volledige nieuwe landelijke OSM-import is eveneens een aparte kandidaatworkflow, geen lokaal bewezen dataset.
