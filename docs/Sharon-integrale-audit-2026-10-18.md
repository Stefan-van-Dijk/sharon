# Sharon — integrale audit, ecosysteemanalyse en ontwikkelroadmap

**Peildatum:** 18 oktober 2026. **Doel:** beoordeling vóór uitvoering. **Referentie:** Sharon v0.3.55, commit `eeee0cdbe20202136d26c7dcf82bcd39c76998b3` op `main`.

Dit rapport bevat A. managementsamenvatting, B. modulematrix, C. historische vergelijking, D. architectuuranalyse, E. roadmap en F. concrete issuevoorstellen. De voorstellen zijn niet in GitHub aangemaakt. Geen applicatiecode, publicaties of bestaande persoonlijke gegevens zijn gewijzigd. Testgegevens zijn uitsluitend fictief; aanvullende integratietests gebruiken een afzonderlijke in-memory opslag.

## Leeswijzer en bewijsniveau

De vijf gevraagde productstatussen worden letterlijk gebruikt. Bij iedere status is het testbereik bepalend: een geslaagde functietest betekent niet dat de gehele module op iPhone is gevalideerd.

| Aanduiding | Betekenis |
|---|---|
| U — uitgevoerd | Gedrag tijdens deze audit daadwerkelijk uitgevoerd; testvorm staat erbij. |
| S — broncode | Implementatie gelezen, zonder volledige uitvoering van het gedrag. |
| H — historisch | Aangetroffen in Log of ontwikkelhistorie; huidige werking zo nodig afzonderlijk vermeld. |
| C — concept | Beschreven doel of ontwerp, zonder bewezen werkende keten. |
| A — advies | Nieuwe aanbeveling uit deze audit. |
| N — nader testen | Niet uitgevoerd, niet toegankelijk of nog niet mogelijk. |

**Belangrijke begrenzing:** geen fysieke iPhone, geïnstalleerde iOS-PWA, echte rit, camera, scan bij een winkelkassa, twee apparaten, echte samenwerking of energie-/geheugenprofiler beschikbaar. Desktop Chrome is gebruikt voor live broninteractie en onboarding. De ketentests gebruiken daarnaast Node/JSDOM en fictieve opslag. Dit is een brede broncode- en uitvoeringsaudit met expliciete openstaande praktijkvalidatie, geen verklaring dat alle gebruiksfuncties productierijp zijn. Er is geen penetratietest uitgevoerd.

## Vastgestelde bron- en publicatiestatus

| Bron | Feitelijk vastgesteld | Betekenis en beperking |
|---|---|---|
| Sharon | Default branch `main`; v0.3.55 in package en kernbestanden; SHA `eeee0cd…`; 94 branches opgehaald | Geen andere branch als ‘actueler product’ aangemerkt op grond van alleen een branchnaam. Veel featurebranches zijn historisch. Niet-ancestor kan door squashmerge komen. |
| Sharon live | Opgehaalde `src/main.js` is bytegelijk aan deze checkout; live onboarding reageert | Dit controleert het startbestand, niet de cache van iedere bestaande gebruiker. |
| Pages | Run **39153152606**, `pages build and deployment`, op dezelfde SHA: **success** | Publicatie voltooid; functionele tests zijn een aparte workflow. |
| Kwaliteitsworkflow | Run **39153152526**, `Sharon controles`, dezelfde SHA: **cancelled** | Geen groen kwaliteitsbewijs voor deze publicatie. Lokale controles zijn wel uitgevoerd. |
| Bescherming | Branchlijst noemt `main` `protected:false`; regelslijst leeg | Detailverzoek branch protection gaf 403; afzonderlijke beheerdersconfiguratie niet volledig inzichtelijk. |
| Releases/tags | API-releasecollectie leeg; lokaal geen Sharon-tags | v0.3.55 is een applicatiebuild, geen formele GitHub Release met tag. |
| Log | `main`, SHA `a98a4a990f42ac0c867b5cad11bee2b69139337d`; commit ‘Improve Android PWA launch behavior in 0.40.11’ | Historische bron is aanzienlijk verder dan de oude README suggereert. Log is niet gewijzigd. Live Log-publicatie is niet als producttest uitgevoerd. |
| Flowcode | HTTPS 301 naar `/flowcode/`, daarna 200; HTML en `app.js` opgehaald; live tekstinvoer en parameters bekeken | HTTP Last-Modified HTML: 22-09-2025; geen betrouwbaar formeel release- of branchnummer aangetroffen. |
| Nesdeck | HTTPS 200; HTML, instellingen-script, hosted-sourcesmanifest en twee publieke decks gelezen; live zoeken en Balken getest | HTTP Last-Modified HTML: 16-05-2026. Dit is een servermetadatawaarde, geen bewijs van de laatste inhoudelijke release. |

Bronnen: [R01], [R02], [R03], [R04], [R05], [R18], [R19]. Aan het einde van het rapport staat het volledige bronregister met vaste commitlinks.

# A. Managementsamenvatting

Sharon heeft een bruikbare technische basis en drie inhoudelijk ontwikkelde reguliere modules: **Omgeving, Locaties en Kaarten**. De bredere persoonlijke assistent is nog een ontwikkelrichting. Het menu wekt een vollediger beeld dan de operationele functies rechtvaardigen. Personen, Objecten, Acties en Tijd zijn in de testomgeving generieke proefobjecten, zonder alle bijbehorende domeinfuncties. Notities en Agenda zijn voorbeelden/uitleg. Een zichtbare knop bewijst hier geen werkende functie.

De kernkeuze — lokaal vastleggen, later verbinden, gedeelde voorzieningen en zelfstandig modulegedrag — blijft passend. De audit adviseert de bestaande kern te verbeteren, zonder de volledige Log-app terug te plaatsen of de skeletproef rechtstreeks tot productie te verklaren.

**Sterke onderdelen, feitelijk gecontroleerd:**

- Alle **190 Sharon-tests slagen**, evenals syntax, importpaden en de bestaande PWA-versiecheck. De eerdere syntaxfout in `SkeletonDemoView.js` is in de huidige versie hersteld.
- `IdentifierService` maakt met cryptografische willekeur exact 12 tekens uit de gevraagde 64-tekenset. De implementatie levert 72 willekeurige bits.
- Locaties heeft hiërarchie, eigen en afgeleide adres-/GPS-gegevens, bewerken en samenvoegen. Kaarten heeft pasgegevens, eigen velden, QR/barcodeweergave en scannerimplementatie.
- Omgeving en Locaties hergebruiken `SharonMapRuntime`. De Wikipedia-laag heeft aanvraagannulering en uitgestelde vernieuwing. Board-prefetch is begrensd tot zes cache-items.
- Een aanvullende test maakte in het skelet een actie met alleen een omschrijving en koppelde later een persoon. De reguliere objectopslag bleef gelijk.

**Belangrijkste risico’s en concrete bevindingen:**

| ID | Prioriteit | Bevinding | Bewijs |
|---|---|---|---|
| F01 | P1 | Publiceren is niet aantoonbaar afhankelijk van geslaagde controles | Pages success naast cancelled kwaliteitsrun; geen gekoppelde deployjob in workflow. |
| F02 | P1 | Locaties samenvoegen mist Kaarten-verwijzingen en privé-webbronnen | JSDOM-test: pas houdt vervallen `locationId`; webbronnen blijven uitsluitend onder oude metadata-key. |
| F03 | P1 | Geen complete back-up/herstelvoorziening in reguliere Sharon-instellingen | Broncode; bestaande kaart-QR is geen complete back-up. |
| F04 | P1 | Offline/updatecontract onvolledig en versies versnipperd | 88 importverwijzingen niet exact aanwezig in de 59 precache-URL’s; oude queryversies; installatie accepteert individuele cachefouten. Geen volledige browser-updateketen uitgevoerd. |
| F05 | P1 | Testmodus is niet volledig geïsoleerd | Objecten deels afgeschermd, maar Wikipedia/filterlocalStorage en centrale locatie-triggerdienst delen reguliere voorzieningen. Broncodebevinding; geen persoonlijke data aangeraakt om dit te bewijzen. |
| F06 | P1 | Opslag heeft geen generieke atomische bewerking of commitgarantie | `put` wacht op request success, niet transaction complete; samenvoegen bestaat uit losse transacties. Risico, geen geobserveerd praktijkverlies. |
| F07 | P2 | UI-gebaren verschillen per boardtype | Kaartboard omlaag vegen klapt details in; sluit het board niet. Rechterswipe op strook heeft geen algemene deelactie. |
| F08 | P2 | Swipe-cancel en cleanup zijn onvolledig | Aanvullende test: pointercancel na 100 px laat actiestrook open; handlers blijven na release reageren op dezelfde DOM. |
| F09 | P2 | Relaties zijn nog geen productiebreed domeinmodel | Graph alleen in test; semantisch dubbele inverse relatie wordt toegelaten; richtingkeuze kan verkeerde betekenis geven. |
| F10 | P2 | ID-beleid wordt niet overal toegepast | Privé-webbronrelatie gebruikt UUID van 36 tekens; objectstore bewaakt externe uniciteit niet. |
| F11 | P2 | Kaarten omzeilt de centrale locatievoorziening | Dichtbij-sortering roept rechtstreeks browser-GPS aan. |
| F12 | P2 | Veel succesvolle tests controleren brontekst, geen complete gebruikersketen | Onder andere Locaties-UI-tests; browser-, storagefault- en apparaatdekking ontbreken. |
| F13 | P2 | Na succesvolle kaartaanmaak blijft het aanmaakformulier staan en kan dezelfde invoer opnieuw een object maken | Live Chrome: naam-only pas tweemaal bevestigd; twee rijen met verschillende 12-teken-IDs. |

Er is **geen nieuw, bevestigd P0-defect** vastgesteld op deze snapshot. Dat betekent niet dat gegevensverlies of beveiligingsproblemen zijn uitgesloten. De opgeloste syntaxfout was wel van een klasse die de hele appstart kon blokkeren: Shell importeert de skeletview ook buiten testmodus.

**Aanbevolen richting:** eerst publicatie, opslag, herstel en isolatie betrouwbaar maken; daarna één productiewaardig object-/relatiecontract en een consistent board-/navigatiecontract. Vervolgens de eerste samenhangende persoonlijke keten leveren: **actie → persoon/thema → notitie → agenda/locatie**. Ritten en Tijd volgen vanuit getoetst Log-gedrag. De contextmotor begint met één transparant voorstel, met bewuste bevestiging en meerdere opties uitsluitend bij gelijkwaardigheid. Samenwerking, externe organisaties en commerciële functies krijgen daarna hun eigen rechten- en synchronisatielaag.

**Nog nodig voor acceptatie:** fysieke iPhone/PWA-test, update tussen twee echte builds, offline tweede start, herstel na transactiefout/quota, camerascans en een proef met twee apparaten. De roadmap maakt deze tests expliciete oplevervoorwaarden.

# B. Modulematrix

## Functionaliteit en productstatus

De kolom ‘regulier’ beoordeelt de bruikbare module als geheel, niet alleen een losse pure functie. ‘Werkend en getest’ wordt hieronder alleen gebruikt voor afgebakende onderdelen waar uitvoering bewijs levert.

| Module | Regulier: status en aanwezige functies | Testomgeving | Uitgevoerd / kwaliteit | Ontbreekt en logische volgende stap |
|---|---|---|---|---|
| Omgeving | **Geïmplementeerd maar onvoldoende getest.** Vectorkaart, GPS-marker, zoom/pan, schaal, stijl/lagen/arcering, lokale objectgeometrie, Wikipedia-markeringen, filters, bronboards, lokale feedback | Echte viewer met afgeschermde ObjectStore-adapter en aparte camera-/meta-prefix. Andere opslag niet overal apart | U: bestaande kaart-/stijl-/lifecycle-unit- en mocktests slagen. S: netwerkadapters en cleanup. N: echte iPhone-touch, WebGL en lange sessie | P1 testisolatie en PWA-betrouwbaarheid; bronmodel en begrensde sessiecache; daarna bestaande #53 afronden. |
| Locaties | **Gedeeltelijk geïmplementeerd.** Aanmaken/bewerken, sublocaties, eigen/afgeleid adres en GPS, herkenningsstraal, melding bij buiten→binnen, samenvoegen, sorteren, zinnenbibliotheek, privé-URL’s | Generieke locatie-objecten zonder volledige reguliere locatie-editor | U: hiërarchie- en UI-brontests; merge integratie. Live onboarding met fictieve naam en openbare testplek voltooid, locatie opgeslagen en beginscherm bereikt. Bekende mergefout F02 | Eerst samenvoegen herstellen en atomisch maken, bronkoppelingen meenemen; archief/herstel toevoegen. Daarna domeinrelaties met organisatie/vestiging. |
| Kaarten | **Gedeeltelijk geïmplementeerd.** Pasje met alleen naam mogelijk; typen, kleur, optionele code/nummer/locatie/velden; zoeken, sorteren, barcode/QR-rendering, camera/fotoscan, kaartpayload om te delen | Generieke voorbeeldpas en graphrelaties; geen volledige productiescanner of ketenindex | U: codevalidatie en payloadtests slagen; card-locatie merge defect aangetoond. U: live pas met alleen naam opgeslagen en twee afzonderlijke IDs na herhaald bevestigen aangetoond. N: echte scan, camera en kassalezer | Centrale GPS en gedeeld levenscyclusbeleid; organisatie/vestiging koppelen; daarna #59 lokale pasherkenning. |
| Personen | **Concept of placeholder.** Regulier menu toont instructie, geen contactbeheer | **Gedeeltelijk geïmplementeerd:** generieke persoon aanmaken/hernoemen, verbinden en board | U: later koppelen van persoon aan actie in skelet. N: contactimport, organisatie, vestiging en werkadres | Productiedomein voor persoon/organisatie/vestiging, natuurlijk formulier, optionele relaties. |
| Objecten | **Concept of placeholder.** Geen zelfstandige inventarisfunctie; kaartgeometrie in Omgeving is niet deze module | **Gedeeltelijk geïmplementeerd:** naam, relaties en levenscyclus voor proefobject | U: skeletkern-tests. N: eigen objectvelden, bezit, onderhoud, code-router | Kleine objectkaart met naam/type en optionele context; bestaande objecten hergebruiken. |
| Thema’s | **Concept of placeholder.** Uitleg zonder productiebeheer | Ook placeholder; niet opgenomen in `SKELETON_MODULES` | S: menu versus registry en dispatch gecontroleerd | Thema’s als zelfstandige objecten en ordening boven Acties; geen verplichte thema-keuze bij actieaanmaak. |
| Acties | **Concept of placeholder.** Regulier geen actiebeheer. `location-action` is een aparte locatie-triggerfunctie | **Gedeeltelijk geïmplementeerd:** generieke actie, naam, relaties, board, archiveren/verwijderen | **Werkend en getest voor afgebakende keten:** omschrijving-only aanmaken en later persoon koppelen in JSDOM. Geen productie-taskflow | Eerste productie-MVP: omschrijving, optionele gereedstatus, later context; geen verplichte datum/persoon/thema. |
| Notities | **Concept of placeholder.** Preview-only menu met uitleg | Eveneens placeholder | S: Shell. Geen notitieobject of editor | Losse tekst opslaan; later aan actie/object/persoon koppelen. |
| Agenda | **Concept of placeholder.** Preview-only | Eveneens placeholder | S: Shell. Geen kalenderketen | Afspraken met tijd en optionele context; eenvoudige plaatselijke agenda. Externe kalenderkoppeling later. |
| Tijd | **Concept of placeholder.** Geen timer of boeking in regulier | Generiek `tasks`-object, titel Tijd/Taken; geen werkelijke tijdregistratie | U: skeletkern. H: Log-timers/getoetste registraties aanwezig | Heldere scheiding actie versus tijdboeking; hervatten, pauze, handmatig corrigeren en rapporteren uit Log-gedrag herbouwen. |
| Ritten | **Concept of placeholder.** Geen vertrek/aankomst/kilometerketen | Generieke voorbeeldrit en bestemmingsrelatie; geen voertuig of GPS-trackregistratie | U: skeletgraph. H: Log-kilometerketen en GPS-resume regressie slagen | Standaardvoertuig op moduleniveau; voertuig-ID per rit vastleggen; historische ritten onveranderd. |
| Codes | **Concept of placeholder.** Geen algemene code-module of objectresolver | Placeholder; geen generieke codescenario’s | U: codefuncties bestaan in Kaarten, niet als algemene resolver | Gedeelde parse/validate/resolve-service; eigen codepresentatie en expliciete acties per module. |
| Instellingen | **Geïmplementeerd maar onvoldoende getest.** Naam, privacy-uitleg, testschakelaar, graphinspectie alleen bij test, onboarding/reset, installatiehulp | Grotendeels dezelfde instellingen; testdataset apart in meta | U: instellingen-/skeleton-tests indirect; reset niet uitgevoerd. S: geen back-up/herstel, originbrede clear en geblokkeerde DB-delete te ruim behandeld | Back-up/herstel, veilige reset, opslag-/privacy-inzicht en zichtbare versie/update-status. |

Bronnen: [R06]–[R17]. Reguliere productiedispatch gaat naar `EnvironmentMapLibre`, `LocationsView`, `CardsView` en `SettingsView`; overige modules vallen terug op `openPlaceholder`. `EnvironmentView.js` is een oudere alternatieve renderer en is niet de normale live route.

## Opslag, relaties en hergebruik per module

| Module | Huidige opgeslagen gegevens / relaties | Hergebruik / dubbeling / aandachtspunt |
|---|---|---|
| Omgeving | Camera/voorkeuren in meta; Wikipedia-feedback, bronfilters, boardlayout en lessen ook in localStorage; leest productie-objectgeometrie | Runtime, schaal, gestures, boardviewer. Oud canvaspad naast huidig MapLibre-pad; afzonderlijk vaststellen welke exports nog nodig zijn vóór verwijderen. |
| Locaties | `objects`: envelope met `type:'location'`, `data.title/address/coordinates/parentId/kind/radiusM/shareRide`; `deletedAt`; losse `location-action`; voorkeuren/zinnen/webbronnen in meta | Locatiehiërarchie, geocoder, centrale GPS, Strip/SwipeRows en mapruntime. Samenvoegen is module-eigen code met onvolledig zicht op andere modulevormen. |
| Kaarten | `objects`: platte `name/cardKind/color/codeFormat/codeValue/locationId/cardNumber/fields`; ISO-timestamps | Strip/SwipeRows, codebibliotheken en hiërarchieresolutie. Afwijkende envelope en GPS-route; eigen CardBoard naast BoardViewer en skeletboard. |
| Personen/Objecten/Acties/Ritten/Tijd in test | Eén `meta`-record `skeleton.demo.dataset`: `{objects:[{id,module,title,status,fields}],relations:[{id,from,to,type}]}` | Gedeelde skelet-CRUD en graph; geen volwassen domeinmodellen. Niet verwarren met reguliere `objects`-store. |
| Thema’s/Notities/Agenda/Codes | Geen functionele productiegegevens vanuit deze menu’s | Voorbeeld/uitleg schrijft deze objecten niet weg. Reële codeverwerking zit alleen elders. |
| Instellingen | IndexedDB `settings.app`, meta-testschakelaar en testdataset; leest andere bronnen voor UI | SettingsService/EventBus; directe localStorage-consumenten omzeilen deze voorziening. |

Dit zijn drie parallelle vormen van objectopslag: location-envelope, platte card en geneste proefdataset. Het oplossen hiervan levert meer samenhang op dan nóg een generieke relatieschermlaag toevoegen.

# C. Historische vergelijking en ecosysteem

## C1. Log: wat is herbruikbaar?

Log op `main` is de historische 0.40.11-lijn. Onder `test/` bestaat daarnaast een brede parallelle appboom. Release-PR #80 bevorderde testfunctionaliteit naar live, maar bestandsnamen met `-test` en oude queryversies bewijzen niet dat elk bestand nog test-only is. De huidige scriptloader en de geassembleerde app-tests zijn gebruikt om die fout te voorkomen.

| Onderdeel | Log: historische/huidige staat | Sharon: huidige staat | Aanbeveling en soort hergebruik |
|---|---|---|---|
| Kilometerketen | Vertrek/eindstand, bestemming, privékilometers, tank-/via-/omrijpunten, periodeoverzicht; geassembleerde eerste rit en GPS-hervatten getest | Placeholder / generieke testrit | **Opnieuw bouwen**, functioneel hergebruik. Behoud administratieve waarheid eindstand−beginstand. |
| Voertuigen | Eigen module, actieve voertuigidentiteit, ritfiltering en voertuigrapporten; actieve voertuigketen in assembled test | Geen voertuigmodel | **Verbeteren/herbouwen**, functioneel; rit bewaart eigen voertuig-ID. |
| Routevoorstellen | Historische A→B, tijdstip/dagtype, actuele bestemming en spaarzame GPS-punten; code en eerdere PR’s | Geen productievariant | **Behouden als principe**, pure rekenregels isoleren en opnieuw testen; route-SVG P3. |
| Tijdregistratie | Timers, handmatige registraties, thema’s/taken en correcties in `time/app.js`; assembled test en activiteit-energietest slagen | Tijd is uitleg; test ‘tasks’ is alleen generiek object | **Opnieuw bouwen**, functioneel; geen wholesale scriptkopie. |
| Thema’s | Thema-/subthemastructuur gekoppeld aan tijd; filters | Placeholder | **Behouden/verbeteren**, conceptueel: thema groepeert acties, tijdboeking verwijst waar relevant. |
| Locaties | Logische nabijheidssortering, adressen, herkenning, samenvoegen, historie/tellers; specifieke regressies | Meer uitgewerkte map-/onboarding-UX en onbeperkte sublocaties, maar merge verwijzingen defect | **Selectief verbeteren**: historische gebruikscontext en referentiebehoud, Sharon-map behouden. |
| Locatieacties | Regelgestuurde enter/tijd/wacht-logica en één scheduler; directe scheduler- en energiecheck slagen | Eenvoudige enter-trigger met hysterese, geen volledig regelbeheer | **Functioneel hergebruik** van schedulerpatroon en grensgevallen; centrale GPS en modulepolicy houden. |
| Personen | Persoonkaart, contactimport, verbindingen, één-QR-identiteit en herstel van stale verbindingen; contactimport en awareness-test slagen; oudere people/collab-tests falen | Regulier placeholder | **Domein opnieuw ontwerpen**; contactimportparser hoogstens technisch hergebruik na validatie. |
| Acties / samenwerking | Actieregels, statusovergangen, gedeelde acties, meerdere partijen, diff-/rechten-/updatecode | Generieke testactie, geen werkelijke samenwerking | **Gedrag en scenario’s hergebruiken**, server-/rechtencontract afzonderlijk beoordelen; geen claim van end-to-end betrouwbaarheid. |
| Kaarten | Pasjes, barcodes, QR en payload/importscenario’s | Codeformaten en kaartpayloads gedeeltelijk overgebracht; tests aanwezig | **Bestaande Sharon behouden**, ontbrekende gedragscases doelgericht porteren; legacy cardtests falen en zijn geen bewijs dat alles werkt. |
| Codes/identiteit | Bare-ID-router, LogCode, QR-acties, JSON-payloads, lokale/externe ID-scheiding | CardCodes/CardPayload en IdentifierService; generieke Codes ontbreekt | **Conceptueel + selectief technisch hergebruik** van formaatdetectie, geen automatisch uitvoeren van gescande opdrachten. |
| Complete back-up | Log JSON v2 met catalogus, activiteiten, relaties, trackpunten en recovery; quota/rollback/export/restore in readiness-test | Geen volledige back-up | **Hoogste functionele hergebruikswaarde**; nieuw Sharon-contract en migratieadapter, hersteltests uit Log gebruiken als cases. |
| Archief/verwijderen | Verwijderbeleid, archief/herstel en afhankelijkheden; assembled test slagen | Alleen test heeft graphguard; productie verwijdert kaarten hard en locaties soft | **Principe behouden**, centrale lifecycle met module-eigen gevolgen. |
| Delen/configuratie | Offline payloads, online bridge, gedeelde kaarten, updatevergelijking en rechten | Card-QR, privé-link en Wikipedia-boards; geen generieke sync | **Stapsgewijs herbouwen** met expliciete scope, versies en conflictbeleid. |
| Navigatie | Veel incrementele shell- en swipepatches; herstelreleases en terugdraaiingen in historie | Kleinere shell maar meerdere boardvarianten | **UX-lessen behouden**; runtimepatchlagen en globale overrides laten vervallen. |
| Technologie | localStorage als grote bron, aanvullend IndexedDB, window-globals, meerdere hotfixlagen; beperkte afhankelijkheden | ES-modules, IndexedDB en services | **Technische structuur niet overnemen**. localStorage zelf is niet verouderd; de monolithische opslag en patchkoppeling zijn de schuld. |

**Wat werkte aantoonbaar verder in Log?** Onder gecontroleerde Node/JSDOM-omstandigheden: geassembleerd starten, actieve auto, eerste rit, back-up/herstel, archief, GPS-trackpunten na hervatten, scheduler en activiteit bij hervatten. ‘Beter’ betekent hier completer functioneel gedrag met tests; geen vergelijkende gebruikerstest of fysiek energieonderzoek.

**Bewust niet overnemen:** originbrede opslagpatches, aparte GPS-pollers per functie, directe globale UI-overrides, ongemarkeerde demo-/testafhankelijkheden, vaste koppeling aan oude storagekeys en automatische uitvoering van onbekende QR-inhoud. Oude navigatie-URI’s bleken eerder op iPhone onbetrouwbaar (Log PR #2–#4); ondersteuning opnieuw praktisch valideren.

Bronnen: [R18], [R20], [R21], [R22].

## C2. Flowcode: waargenomen concept versus mogelijke rol

Flowcode is in de aangetroffen publicatie primair een **tekst-/pixelinformatiedrager**, geen aangetoond centraal objectregister. De interface biedt tekst→RGB-preview, downloaden/uploaden, start-/routekeuze en instellingen voor gebruikte bits. De bron beschrijft een 12-bits Flowcode en structuurkeys; deze hebben een andere functie dan Sharons willekeurige 12-teken-ID. In Chrome veranderde fictieve tekst de pixelpreview en afmetingen; het Flowcode-paneel kon worden geopend.

Niet aangetoond: foutbestendige heen-en-terugoverdracht door fotocompressie, universele QR-/barcodescan, objectresolver, rechtenbeheer, serverpublicatie, authenticatie en cryptografische veiligheid. De pagina doet veiligheidsuitspraken; deze audit neemt ze niet als bewezen beveiliging over. Een grote beschreven sleutelruimte bewijst geen veilige versleuteling of integriteitsbescherming.

| Vergelijkingspunt | Conclusie |
|---|---|
| Codes | Experimentele extra drager mogelijk, achter de bestaande resolverinterface. Geen vervanging voor QR/barcode. |
| Kaarten | Pasjes hebben scanbaarheid en interoperabiliteit nodig; standaardcodes blijven eerste keuze. |
| Objecten | De inhoud of verwijzing kan van drager wisselen zonder objectidentiteit te veranderen. |
| Centrale ID | 12 **tekens** = 72 bits; Flowcode 12 **bits** = 4096 routevarianten. Niet uitwisselbaar. |
| Delen/publiceren | Neem gebruikersregie, formaat-/integriteitscontrole en preview over. Publicatie- en rechtenservice is apart nodig. |
| Veiligheid | Alleen als P3-proef, met roundtrip-, bitwijzigings- en compatibiliteitstests. Geen zelfontworpen cryptografie als productbeveiliging. |

Bron: [R19]. Aanbevelingen in deze tabel zijn A; de encode-interface is U/S.

## C3. Nesdeck: boards, views en rechten

Nesdeck toont een lokale kaartenbak met relaties, meerdere presentaties en externe JSON-decks. Live Chrome liet 21 uitlegkaarten zien; zoeken op ‘relaties’ beperkte dit tot vier; Balken veranderde de presentatie. `Stripes` is zichtbaar maar disabled. Broncode scheidt cards, views en styles en kent documentmetadata, owner-slugs en policies.

Het hosted-sourcesmanifest noemt leesdecks en invoerbare decks. Alle vier aangetroffen `saveUrl`-waarden zijn leeg. Policy-instellingen in de browser bewijzen geen serverautorisatie of werkelijke samenwerking. Het publieke database-roadmapdeck beschrijft accounts, API, uploads, sharelinks en governance als vervolgstappen. Organisaties volgen, betalingen en commerciële exploitatie zijn niet als werkende keten aangetoond.

**Advies voor Sharon (A):** hergebruik het onderscheid inhoud–weergave–rechten, tijdelijke uitlegkaarten en dezelfde inhoud in een compact overzicht of focusboard. Laat technische parent/sibling/child-bediening en uitgebreide stijlkeuzes buiten de gewone mobiele werkstroom. Een board is een presentatie van objecten plus toegestane handelingen, geen nieuw duplicaat van hun inhoud.

| Boardsoort in Sharon | Eigenaarschap en gedrag | Vereist contract |
|---|---|---|
| Persoonlijk | Gebruiker bezit eigen informatie; context wordt lokaal afgeleid | Object-ID, eigenaar/provenance, lokale lifecycle en expliciete deelactie. |
| Gedeeld | Meerdere deelnemers werken aan afspraken/acties; rechten verschillen | Deelnemer-ID’s, rollen, toestemmingen, versies, conflictafhandeling, intrekking en auditspoor. |
| Extern | Bron blijft bij organisatie/derde; gebruiker bekijkt of volgt vrijwillig | Bron-ID/URL, versie, licentie/scope, cachebeleid, volgen/stoppen, toegestane interacties. |

Deze driedeling is een **doelarchitectuur voor Sharon**. De aangetroffen Nesdeck-client ondersteunt delen daarvan als prototype, niet als bewezen volledig platform. Bron: [R23].

## C4. Vergelijking op alle gevraagde onderwerpen

Legenda: U/S aantoonbaar in huidige bron of beperkt uitgevoerd; H historisch; C beschreven concept; — ontbreekt in de onderzochte functionele route. ‘S’ is geen werkingsgarantie.

| Onderwerp | Sharon | Log | Flowcode | Nesdeck |
|---|---|---|---|---|
| Productvisie | C persoonlijke contextassistent; U/S lokale kern | H/U/S registratie plus bredere shell | S pixelboodschap en regie | U/S relationele informatiedecks; C platform |
| Gebruikerservaring | U/S mobiel, typemachine, drie werkmodules | H/U/S compacte registraties en vele patches | U/S encodepreview en instellingen | U zoeken/Balken; veel desktopbediening |
| Navigatie | S shell + verschillende boardroutes | H/S inline flows en shell | U panelen | U zones, kaarten en views |
| Stroken | S gedeelde Strip/SwipeRows, test en regulier | H/S compacte rijen/swipes | — generiek | S Balken; Stripes disabled |
| Boards | S Wikipedia-, kaart- en skeletvariant | H/S kaarten en gedeelde imports | S uitklapbare uitleg | U/S kaart-/focuspresentatie |
| Personen | C regulier; U beperkte testpersoon | H/S contact-/identiteitscode | — | — zelfstandige personenmodule |
| Locaties | U/S domein, hiërarchie; mergefout | H/U/S ritlocaties/acties | — | — zelfstandige locatiemodule |
| Objecten | C regulier, S test en kaartgeometrie | H/S generiek kaartenmodel | S afbeelding als drager | U/S generieke kaart |
| Acties | C regulier, U beperkte testactie | H/S uitgebreide regels/samenwerking | — | S generieke kaarten/voorstellen, geen bewezen Sharon-actieflow |
| Notities | C placeholder | H/S notities in andere registraties | S tekstinhoud | S beschrijving; geen losse notitiemodule bewezen |
| Agenda | C placeholder | Geen zelfstandige volwassen kalender bewezen | — | — |
| Tijd | C regulier, testobject | H/U/S registratie | — | — |
| Ritten | C regulier, testobject | H/U/S kilometerketen en trackpunten | — | — |
| Codes | U/S Kaarten, algemene module C | H/S router/QR/payloads | U/S eigen pixelformaat | S JSON/deelroutes; geen universele codeservice |
| Identifiers | U/S 12 tekens; UUID-uitzondering | H/S 12-tekenbeleid plus legacy mapping | S 12-bits route; andere identiteit | S lokale document/card-ID’s; niet overal cryptografisch |
| Relaties | U/S testgraph, productie losse verwijzingen | H/S model/relaties | — objectgraph | U/S parents/siblings/children |
| Context | S locatie; U/S beperkte testsuggesties | H/S tijd-/route-/locatieregels | — assistentmotor | S filters/views, geen persoonlijke contextmotor bewezen |
| Samenwerking | C | H/S code en tests met gemengd resultaat | — | C/S policy-/invoerprototype; backend niet bewezen |
| Delen | S kaartpayload, privé-URL, geen generieke dienst | H/S lokaal/online bridges | S PNG/download/key-concept | S JSON/export en bronroutes |
| Publiceren | C #57 | H/S server-/configcontract | Niet bewezen | C platform, S hosted JSON |
| Externe informatie | S Wikipedia/OSM en privélinks | H/S servers/config | Geen externe informatieregisterfunctie bewezen | S hosted manifest/decks |
| Privacy | S local-first; externe kaart/geocoderverzoeken | H/S lokale opslag plus optionele sync | S lokale encoding; veiligheid niet gevalideerd | S lokale opslag en clientpolicies; serverrechten niet bewezen |
| Verdienmodel | C vrijwillige relevante bedrijfsboards | Geen operationeel model bewezen | Niet bewezen | Niet bewezen; C platformgroei |

Geen conclusie over niet-openbare servers, beheerportalen of commerciële afspraken. Die bronnen zijn niet aangeleverd of ingezien.

# D. Architectuuranalyse

## D1. Huidige kern en gewenste verdeling

| Component | Beoordeling huidige staat | Nodige verbetering |
|---|---|---|
| ModuleRegistry | Tien eenvoudige descriptors, alleen list/get; geen modulemount-contract | Eén manifest voor titel, mount, capabilities en eigen contextregels. Nu drie lijsten met afwijkende namen: `people/persons`, `time/tasks`, ontbrekende notes/agenda. |
| Shell | Centrale viewwissel, header, menu, terugroute, live/testdispatch | Navigatie en lifecycle generiek maken; domeinforms blijven in modules. Laad moduleviews gericht. |
| ObjectStore | IndexedDB v1 met vijf stores en beperkte indexes | Transactie-API, wachten op commit, schemavalidatie, upgrade/versionchange/blocked-afhandeling, gerichte queries, lifecycle en herstel. |
| IdentifierService | Sterk klein onderdeel, correct alfabet en randombron | Eenduidig gebruik voor alle persistente deelbare entiteiten en relaties; collisionguard bij creatie/import; legacy aliasmapping. |
| EventBus | Sync events met unsubscribe; vangt sync listenerfouten | Documenteer eventvormen en async-foutbeleid; geen gevoelige inhoud in generieke logs; geen eventhistory zonder doel. |
| SettingsService | Kopieën en recursieve merge; commit in IndexedDB | Wijzig geheugen pas na succesvolle commit; gescheiden modulepreferences en omgevingsnamespace; geen dubbele settingsbron. |
| LocationService | Eén pending request, pauze bij verborgen app, actieve-rit-timer voorbereid | Kaarten via deze service; profiel handmatig/automatisch expliciet; late GPS-resolutie na verbergen afvangen. Nog geen ritmodule die actieve rit instelt. |
| LocationTriggerService | Hysterese, eerste meting geen trigger, buiten→binnen | Dataset/omgeving injecteren; evaluatieserialisatie zonder relevante nieuwste fix te verliezen; moduleacties via policies. |
| GraphService | Klein getypeerd woordenboek met inverse labels; alleen skelet | Canonieke semantiek, bron-/doeltypevalidatie, cardinaliteit, provenance en transactionele lifecycle. Geen module-UX in graphkern. |
| ContextSuggestions | Lokale deterministic ranking van testobjecten | Productiecontextproviders, expliciete context, drempels/gelijkwaardigheid, uitgestelde bevestiging en privacyvriendelijke feedback. |
| Stroken | Gedeelde renderer en swipebinder | Cancel, pointer capture/leave, cleanup, toetsenbord en deelrichting; module bepaalt eigen acties. |
| Boards | Drie varianten met verschillende gebaren/data | Gedeelde viewer-/navigation-/focusbasis, moduleadapter voor inhoud en acties. Externe fetch blijft bronadapter. |
| Synchronisatie | Geen generieke productiesync; kaartpayload en links zijn geen sync | Pas later outbox/inbox, objectversies, conflict- en rechtencontract. Local-first blijft bruikbaar zonder server. |
| PWA | Versioned cache, navigatie netwerk-eerst, skipWaiting/claim | Complete releaseassetset en veilige updateovergang; geen gedeeltelijk bruikbare nieuwe cache activeren. Externe MapLibre-assets ontbreken in eigen offlinecache. |
| Deployment | Syntax/tests/import/version workflow bestaat | Dezelfde succesvolle workflow levert exact geverifieerd Pages-artifact; branchregels en verplichte checks ter beoordeling. |

Bronnen: [R04], [R06]–[R17].

**Voorgestelde contracten (A):**

1. **ObjectRepository:** create/update/archive/restore/merge/get/query; versie en transactie centraal. De module levert validatie en betekenis van velden.
2. **RelationRepository/GraphService:** IDs, canonieke richting, integriteit en query’s. Moduleadapters leveren natuurlijke relaties zoals ‘werkzaam bij’, ‘vestiging’ of ‘voertuig’.
3. **BoardAdapter:** levert een viewmodel en toegestane capabilities voor één bestaand object. Het board schrijft geen tweede kopie van de inhoud.
4. **NavigationService:** een stack van module/object/viewmodus/scrollpositie, met onderscheid tussen sluiten, vorige plek en delen.
5. **ContextProvider per module:** expliciete startcontext en module-eigen regels. Een kleine centrale arbiter rangschikt; hij bevat geen grote verzameling winkel-, rit- en contactformulieren.
6. **Source/SharingAdapter:** provenance, rechten, versies en netwerkafhandeling; persoonlijke annotaties staan apart van externe broninhoud.

Een productiegraph hoeft geen database van alle veldwaarden als triples te maken. Objecteigenschappen blijven normale velden; alleen betekenisvolle objectverbindingen zijn relaties. De gebruiker ziet naam, plek, persoon, voertuig en afspraak, geen predicates of bron/doel.

## D2. Datamodel, identiteit en levenscyclus

**Huidig:** IdentifierService correct, maar `ObjectStore.put` is een upsert zonder centrale ID-/schemavalidatie. `externalId`-index is niet uniek. Location-creatie controleert botsing; card-creatie doet dat niet. Webbronrelaties gebruiken `crypto.randomUUID()`. Proef-ID’s zijn bewust vaste fictieve IDs; zij mogen nooit als echte willekeurige klantobjecten migreren.

**Aanbevolen envelope (voorstel, nog geen migratie):** `id`, `type`, `schemaVersion`, `createdAt`, `updatedAt`, `revision`, `archivedAt/deletedAt`, `data`, optionele provenance/externe aliases. Objectidentiteit verandert niet bij verrijken of toevoegen van relaties. Lokale db-sleutel en externe deelreferentie mogen verschillende concepten blijven; leg vast welke velden onder het 12-tekencontract vallen.

Bij 64 toegestane tekens en 12 posities is de ruimte 2^72. Dat maakt toevalsbotsingen bij persoonlijk gebruik zeer onwaarschijnlijk, maar is geen absolute wereldwijde uniciteitsgarantie. Controle bij lokaal creëren/importeren blijft nodig. Een openbare ID is ook geen geheim, toegangsbewijs of cryptografische sleutel.

**Relaties:** bevat en hoort-bij kunnen nu semantisch dubbel worden opgeslagen. De test liet A bevat B en B hoort-bij A toe: graphConnections toont twee keer dezelfde betekenis. `ContextSuggestions` maakt bovendien richting op basis van moduleparen zonder typecontract. Vanuit een locatie naar een rit kan zo ‘heeft bestemming’ ontstaan terwijl de rit juist de locatie als bestemming heeft. Kies één canonieke relatie, toon inverse labels afgeleid, sta meerdere verschillende zakelijke relaties tussen dezelfde objecten wel toe.

**Samenvoegen:** toon verschillen, behoud de primaire ID, laat de vervallen ID als alias/tombstone naar de primaire verwijzen en zet álle relaties/metadata atomisch om. De huidige preview telt cards met platte `locationId` niet mee. Controleer ook privéwebbronnen, onboardingpointer, sublocaties, locatieacties, boardvoorkeuren en toekomstige ritten. Historische feiten krijgen een expliciet beleid; een locatienaamwijziging mag een historische route niet stilzwijgend herschrijven.

**Archiveren/verwijderen:** test heeft afhankelijkheidsguard; regulier kent verschillende policies. Voeg archive/restore toe en verwijder alleen definitief met bewuste scope en consistente referentiecontrole. Locaties-delete blokkeert kinderen maar kent cards niet als beschermde afhankelijkheid. Kaarten-delete is hard. Reset gebruikt originbrede `localStorage.clear()` en behandelt geblokkeerde db-delete als afgerond; dat verdient een afzonderlijk herstelpad.

## D3. Natuurlijke en afgeleide relaties

| Module | Expliciet vastleggen | Afleiden zonder extra gebruikersinvoer | Belangrijke grens |
|---|---|---|---|
| Personen | Optioneel privéadres, werkt-bij organisatie, vestiging indien nodig | Werkadres via vestiging/organisatie als eenduidig | Meerdere vestigingen: pas vragen wanneer een werkplek nodig is; geen willekeurige keuze. |
| Organisatie/vestiging | Eigen organisatie en vestigings-ID; vestiging hoort bij organisatie | Adres en nabijheid voor kaart/afspraak hergebruiken | Organisatie ≠ vestiging ≠ persoonlijke herkenningszone. |
| Locaties | Parent bij bewuste keuze; eigen adres/GPS optioneel | Adres/GPS van bovenliggende plek als eigen waarde ontbreekt | Eigen waarde overschrijft afleiding; geen kopie maken die later veroudert. |
| Acties | Omschrijving verplicht; relaties optioneel | Startcontext kan een voorstel opleveren | Niets ongemerkt aan persoon/thema/locatie koppelen. |
| Notities | Eigen tekst en ID | Relevante verbinding vanuit huidig board voorstellen | Notitie blijft zelfstandig te bereiken. |
| Agenda | Tijd/afspraakgegevens; context optioneel | Adres via expliciet gekozen locatie/vestiging | Tijdzone en wijzigen reeks later apart toetsen. |
| Ritten | Start/einde, standen, voertuig-ID per rit; optionele persoon en bestemming | Nieuw ritvoorstel neemt standaardvoertuig uit modulevoorkeur over | Wijzigen voorkeur verandert bestaande ritten niet; wijziging voor één rit wijzigt de voorkeur niet. |
| Tijd | Tijdboeking met optionele actie/thema/locatie | Actie-/themacontext overnemen na bevestiging | Actie en registratie zijn verschillende objecten; geen registratie verplicht bij actie. |
| Kaarten | Pasje optioneel gekoppeld aan organisatie | Vestigingen en herkenning via bronregister en persoonlijke zone | Pascode blijft privé; niet alle winkels als eigen locaties opslaan. |
| Codes | Codeverwijzing naar bestaand object, formaat/payloadversie | Actieve module kiest passende weergave | Scan is lezen; handelen/publiceren vereist passende expliciete keuze. |

Organisatie en vestiging hoeven geen nieuwe prominente menu’s te worden. Het kunnen objecttypen zijn met natuurlijke toegang vanuit Personen, Kaarten en Locaties.

## D4. Contextmotor zonder AI

**Feitelijk aanwezig:** `suggestConnections` rangschikt objecten op modulepaar, zoekterm, focus en testscenario. Focus krijgt +100, modulematch +15, simulatieplek/rit +45; er is geen productiecontext uit agenda, weekdag, organisatie of echte rit. De huidige eenvoudige relatie-UI roept alleen zoekcontext aan en toont maximaal twaalf kandidaten. De oudere scenario-/focusmogelijkheden bestaan in de functie, maar zijn daarmee geen actuele proactieve assistent.

**Ontwerpvoorstel:**

- Geef context een expliciete herkomst: huidige handeling, gekozen board/strook, rechtstreeks gekozen persoon/rit, opgeslagen voorkeur, afgeleide relatie, actuele GPS met nauwkeurigheid, tijd/dag en beperkt lokaal gebruikssignaal.
- Orden eerst op **bewijsklasse**, daarna op score binnen die klasse. Zo kan een optelsom van zwakke signalen nooit een expliciete keuze verdringen. Een expliciet gekoppelde reiziger gaat boven een GPS-vermoeden.
- Laat modules kandidaatvoorstellen leveren: bijvoorbeeld Kaarten een bruikbaar pasje, Ritten voortzetten/afronden, Acties de relevante open actie. De centrale arbiter filtert geldigheid, toestemming, stale data, cooldown en gelijkwaardigheid.
- Standaard één beste voorstel; bij gelijke bewijsklasse en vergelijkbare relevantie meerdere compacte opties. Winkelcentrum met meerdere passende pasjes is een expliciete meervoudige test.
- Opslaan van een relatie gebeurt pas door een afzonderlijke geaccepteerde handeling. Voorstel tonen, afwijzen of alleen een locatie meten maakt geen relatie.
- Bewaar lokaal beperkte accept-/dismiss-tellers per regel/objectcontext, een cooldown en vervaltermijn. Geen precieze routegeschiedenis nodig. Afwijzing van een pasje op één plek is geen universele afkeer van de organisatie.
- Geef ‘Waarom dit voorstel?’ en wis-/uitschakelopties. Bij onvoldoende zekerheid liever geen voorstel dan extra invoervragen.

**Nog niet gerealiseerd:** productieproviders, privacyvriendelijke feedback, tie-/drempelcontract, stale-contexttests en proactieve UI. Relatiezoekresultaten zijn een goede bouwsteen, maar vertegenwoordigen niet de hele contextmotor.

## D5. UI, interactie en toegankelijkheid

| Eis | Huidige bevinding | Beoordeling |
|---|---|---|
| Strook tikken opent board | Locaties detail, Kaarten modal en testboard aanwezig | Gedeeltelijk consistent. |
| Linkerswipe beweegt mee | SwipeRows zet translate3d tijdens pointermove; menu heeft eigen gesturecode | U kort/long/cancel met synthetische pointers; N echte vinger/pointercapture. |
| Korte swipe veert terug | Test 20 px eindigt op 0 px | Werkend en getest binnen synthetische test. |
| Afbreken veilig | pointercancel gebruikt pointerUp en kan openklappen | Gereproduceerde afwijking; geen onbedoelde delete uitgevoerd, wel onbedoelde open actiezone. |
| Rechterswipe delen | Gesloten rij claimt rechts niet; geen generiek onShare-contract | Niet aanwezig als algemene functie; rand-terug is apart beleid nodig. |
| Board omlaag sluit | Skelet >70 px sluit; CardBoard >45 px verandert expanded-state | Inconsistent; Wikipedia-board weer eigen handler. |
| Vorige plek | Skelet bewaart objectHistory; Shell eigen browserhistory en terugroute | S/U beperkte skeletnavigatie; geen complete productiestack over modules. |
| Plus rechts naast titel | Voor concrete modules en test; placeholders hebben plus die uitleg opent | Uitleg is geen toevoegen. Markeer productstatus of maak minimale functie. |
| Presentatie vs bewerken | CardBoard leesmodus; Locaties swipebewerkingen; skelet formulier apart | Goede richting, meerdere implementaties. |
| Voorbeeldstroken | In placeholders/test; reguliere lege Locaties/Kaarten tonen lege tekst | Geen uniforme demo-adapter. Voorbeeld nooit zonder keuze migreren. |
| Typemachine en minder beweging | Boot/Story en meerdere animaties lezen voorkeur; niet iedere timer/marker | S; centrale toepassing en overslaan nodig. Niet alle animaties fysiek getest. |
| Schermhoogte/safe areas | Gemeten CSS-viewportvariable en eerdere fixes #95–#97 | Code en bestaande tests aanwezig; fysieke iPhone/keyboard/rotatie blijven N. |
| Toegankelijkheid | Diverse labels, role=dialog/status en toetsenbordknoppen | Geen volledige focusval/terugfocus in CardBoard; swipe-only acties hebben extra bereikbaarheid nodig. Contrast/VoiceOver niet getest. |

Een algemene boardkern moet gesture-eigenaarschap bepalen voor header/handgreep, scrollinhoud, kaart en rij. Verticale scroll in een artikel mag niet als sluiten eindigen. Rand-terug en rij-delen moeten onderscheiden zijn zonder dat de gebruiker precieze technische zones hoeft te kennen.

## D6. Kwaliteit, privacy, performance en energie

**Syntaxfout:** commit `f9b3c818…` herstelt een ongeldige stringconcatenatie in de relatiezoekresultaten. De huidige v0.3.55 is syntactisch geldig. Lange handgeschreven HTML-stringketens komen ook elders voor. Preventie: syntaxcheck verplicht vóór deploy, DOM-/templatehelpers en een echte boot-smoketest, niet alleen bronregels zoeken.

**PWA:** huidige versiecheck controleert alleen aanwezigheid van de actuele `?v=` in vier kernbestanden; hij controleert niet alle module-URL’s, package/Shell/manifestgelijkheid of een complete offline dependency closure. Verschillende URL-queryversies van hetzelfde ES-modulebestand kunnen meerdere module-instanties en cachesleutels opleveren. Een runtimecache kan een eerder bezochte versie opvangen; een onvolledige precache is daarom een risico en geen bewijs dat élke offline-start faalt. Upgrade + koud-offline na nieuwere build moet worden getest.

**Privacy:** lokale primaire opslag is een goede basis. Geocoding verstuurt gekozen adressen/coördinaten naar Nominatim; kaartproviders ontvangen tegel-/gebiedsverzoeken; Wikipedia krijgt kaartmiddelpunt en artikelverzoeken na activeren. Dit is te onderscheiden van het bewust delen van eigen objecten. Maak dit zichtbaar in instellingen en bronuitleg. Privé-URL koppelen kopieert momenteel geen hele webpagina. Een gegevens-ID maakt gegevens niet anoniem wanneer de inhoud persoonsgegevens bevat.

**Dataveiligheid:** schema-upgrades ontbreken nog buiten v1; geen complete herstelroute, opslagpersistentie-aanvraag of quota-UX aangetroffen. `settings.update` wijzigt geheugen vóór opslagbevestiging. Maak foutafhandeling bij commit en reset consistent. Onboarding vraagt op de eerste route naam en een plek; de onderzochte route biedt zonder geslaagde plekselectie geen directe ‘leg eerst een losse actie vast’-ingang. Maak een basisstart zonder GPS/adres mogelijk.

**Performance:** 62 bron-JS-bestanden, samen ongeveer 602 kB ongecomprimeerd; index circa 213 kB, veel CSS daarin. Dit is een inventaris, geen laadtijdmeting. Views en proefview worden vroeg geïmporteerd. `getAll` scant alle objecten voor lijsten en locatieacties; graph scant relaties in geheugen. Pas index/query’s toe wanneer datasets groeien. `knownFeatures` in Wikipedia groeit gedurende de sessie zonder aangetroffen maximum; boardcache is wél tot zes begrensd. Meet met realistische data vóór optimaliseren.

**Energie:** centrale LocationService gebruikt on-demand GPS en één timer voor een actieve rit; achtergrond pauzeert. Kaarten heeft nog een directe GPS-call. Wikipedia heeft een requestAnimationFrame-puls die op activering blijft lopen; reduce-motion/visibilitybeleid hier toetsen. Geen stroomverbruik, temperatuur, geheugengroei of echte GPS-frequentie op telefoon gemeten. De Log-energieproeven zijn gedragstests, geen batterijmetingen.

**Technische schuld:** dubbele objectvormen, drie boardpresentaties, meerdere versies in import-URL’s, oud canvaspad, menu/registry/skeletmodulelijsten en domeinregels in grote UI-bestanden. Refactor per werkende keten, met functionele acceptatie; geen langdurige allesomvattende herschrijving.

## D7. Uitgevoerde tests en 20 ketenscenario’s

### Testresultaten

| Controle | Resultaat tijdens deze audit | Praktische betekenis |
|---|---|---|
| Sharon `npm test` | **190 pass, 0 fail, 0 skip** | Unit-, mock- en bronasserties; geen volledige E2E-dekking of coveragepercentage. |
| `node --check` alle `src/*.js` recursief + serviceworker | Geslaagd | Inclusief SkeletonDemoView; geen JavaScript-syntaxfout op huidige snapshot. |
| `node scripts/check-imports.mjs` | Geslaagd | Relatieve importbestanden bestaan; externe CDN-runtime niet bewezen. |
| `node scripts/check-version.mjs` | Geslaagd | Beperkte kernbestandencheck; offlineversieclosure blijft risico. |
| Extra auditintegratie met echte bronmodules/JSDOM/in-memory store | Mergefout, UUID-afwijking, inverse duplicaten en swipeproblemen gereproduceerd; minimale actie en later persoon slagen | Geen repo-aanpassing, geen persoonlijke opslag, geen externe writes. |
| Log `npm run verify` | Geslaagd: production syntax **79 scripts**, readiness, assembled app, screen-idle, GPS-resume | Sterkste historische hergebruikscases. |
| Log `npm run verify:energy` | Mislukt bij `energy-connections-regression`: verwachte bevestigingscheck 2, werkelijk 1 | Ketenscript stopt daar. GPS-check ervoor slaagt. Geen bewezen oorzaak of fysiek energieprobleem. |
| Overige energiechecks afzonderlijk | activity, action-scheduler en location-actions slagen | In brede legacy-run had energy-location-actions een 15s-timeout; afzonderlijk slagen maakt dat een harness-/timingonderzoekspunt. |
| Log `npm run test:legacy` | **43 bestanden: 25 pass, 18 fail**, waarvan één timeout | Niet alle failures zijn productbugs; oude bronregex/versieaannames en harnessafhankelijkheden zitten ertussen. |
| Live Chrome | Sharon volledige onboarding met fictieve ‘Audit’/openbare auditplek, GPS-foutpad, Acties-placeholder en plus, Kaarten naam-only opslaan en herhaalde creatie; Flowcode invoer/preview/paneel; Nesdeck zoeken/Balken | Geen apparaatvalidatie; verdere Sharon-modules via bron en geïsoleerde tests beoordeeld. |

De volledige lijst van falende Log-regressies: `action-transitions`, `action-ui`, `actions-shell`, `cards`, `collaboration-v2`, `energy-connections`, `energy-location-actions` (timeout in runner), `executable-card-payload`, `location-polling`, `module-swipe`, `people`, `qr-action`, `scan-dispatcher`, `shared-card-import`, `shared-card-update`, `task-code`, `time-task-entry`, `version-label` (allemaal `-regression.cjs`). Onder meer `version-label` en `time-task-entry` bevatten bronstructuuraannames; zij mogen niet zonder analyse als defecte productfunctie worden gerapporteerd.

Tests draaiden lokaal met Node **v24.19.0**; CI schrijft Node 22 voor. Versiegelijkheid is een resterende verificatievoorwaarde. Voor Log zijn alleen devdependencies uit de bestaande lockfile geïnstalleerd; tracked bestanden bleven ongewijzigd.

### Gevraagde ketens

| # | Scenario | Feitelijke uitslag / resterende test |
|---|---|---|
| 1 | Locatie maken en later verrijken | S: productieform en persistence; U: live openbare plek gezocht, onboarding voltooid en nieuwe locatie opgeslagen; U hiërarchie/functietests. Later verrijken en locatie heropenen N. |
| 2 | Sublocatie koppelen | U: pure hiërarchie-/UI-brontests; S parent-form. Volledige browserketen N. |
| 3 | Persoon → organisatie → vestiging | Niet aanwezig als functionele productieketen; toekomsttest I13. |
| 4 | Werkadres afleiden | Niet aanwezig; toekomsttest met nul/één/meerdere vestigingen. |
| 5 | Actie zonder relaties | **U geslaagd** in skelet/JSDOM: alleen omschrijving, nul relaties. Regulier ontbreekt. |
| 6 | Later persoon/thema koppelen | **U persoon geslaagd** aan dezelfde skeletactie. Thema ontbreekt in skelet; productie N. |
| 7 | Notitie aan actie | Niet mogelijk; Notities placeholder. |
| 8 | Agenda aan locatie | Niet mogelijk; Agenda placeholder. |
| 9 | Rit met standaardvoertuig | Niet mogelijk in Sharon. U: Log assembled first ride/actieve auto; expliciet nieuw defaultcontract toekomsttest. |
| 10 | Eén rit andere auto | Sharon ontbreekt; toekomsttest: voorkeur en oude ritten onveranderd. |
| 11 | Klantenkaart aan organisatie | Sharon heeft locatiekoppeling, geen werkend organisatie-/vestigingscontract. Toekomsttest via #59. |
| 12 | Code scannen → object openen | U payload/formatvalidatie; S kaartscanner. Geen fysieke scan en geen algemene objectresolver. |
| 13 | Board van derde bekijken | S Wikipedia-board en Nesdeck JSON-bronnen; U Nesdeck uitlegkaarten. Geen generiek Sharon-organisatieboard E2E. |
| 14 | Gezamenlijke acties/afspraken | Sharon ontbreekt; Log-code en gemengde regressies. Geen tweegebruikersproef. |
| 15 | Archiveren zonder verlies | U skeletkern-guardtests; Log assembled archief. Reguliere algemene lifecycle ontbreekt. |
| 16 | Zelfde object uit meerdere modules | U bestaande graph-/named-objecttests; S skelet gelinkt board. Geen productiebrede routertest. |
| 17 | Aanbod gevolgde organisatie | Niet aanwezig; toekomstconcept, alleen vrijwillige opt-in en bronrechten. |
| 18 | Vorig board herstellen | S skelet objectHistory; bestaande regressies bron/graph. Complete browserverloop incl. scroll N. |
| 19 | Swipe onderbreken | **U deels fout**: korte swipe veert terug; pointercancel na drempel laat actieruimte open. Geen onbedoelde delete gezien. |
| 20 | PWA naar nieuwere versie | U versie-/publicatiestatus; N echte twee-build-update, offline cache en iOS standalone. |

# E. Gefaseerde ontwikkelroadmap

## Ontwikkelvolgorde en opleverpoorten

Dit is een volgorde op afhankelijkheden, geen kalenderbelofte. S = beperkt afgebakend, M = meerdere samenwerkende onderdelen, L = domein-/migratie-/serverketen. Capaciteit, beschikbaarheid van testtelefoons en servertoegang bepalen de uiteindelijke doorlooptijd. Eén L-item moet vóór uitvoering in reviewbare increments worden geknipt.

| Fase | Doel / uitvoeringsvolgorde | Voorstellen | Oplevervoorwaarde |
|---|---|---|---|
| 0 — betrouwbaar vrijgeven | Publicatiepoort; minimale bootcheck; exacte release-assets | I01 → I02; I11 testbasis parallel voorbereiden | Geen publicatie bij syntax-/test-/offlineassetfout; dezelfde SHA getest en gepubliceerd. |
| 1 — gegevens beschermen | Direct mergeverlies aanpakken, commit-API, back-up/herstel, testisolatie, reset | I03, I04, I05, I06, I07; I09 ID-contract | Herstelbare snapshot; merge behoudt alle verwijzingen; geen writes tussen test/privé; faulttests slagen. Tijdelijk merge blokkeren bij niet-gecontroleerde afhankelijke data is een aanvaardbaar veilig increment. |
| 2 — samenhangende kern | Productieobjecten/relaties, modulemanifest, navigatie/boards, swipes/toegankelijkheid | I08, I09 → I10, I12, I14, I15, I33; I16 centrale GPS; bestaande #54/#55 beoordelen | Zelfde ID vanuit twee modules; canonieke relaties; view sluiten en terug betrouwbaar; fysiek iPhone-testpakket. |
| 3 — persoonlijke assistentbasis | Thema’s/Acties → Notities → Personen/organisatie → Agenda; kleine Objecten/Codes | I17 → I18; I13; I19; I20; I21 | Eerst vastleggen werkt zonder verplichte context; relaties later; juiste afgeleide werk-/afspraaklocatie. |
| 4 — dagelijks registreren en context | Tijd en Ritten uit Log; echte contextproviders; begrensde feedback; Log-import per gereed doeltype | I22, I23, I32; I24 → I25; #59 na organisatie/indexcontract | Historische voertuigfeiten blijven; geen dubbele GPS; één voorstel of expliciete gelijkwaardige keuzes; geen stilzwijgende relaties. |
| 5 — bronnen en samenwerking | Bronboards, opt-in volgen, rechten/sync en gedeelde acties | I26, I27, I28; bestaande #52/#53/#56/#57/#59/#60; I29 metadata-/cacheprestatie | Offline eigen werk blijft werken; rechten serverzijdig; intrekken/conflicten getest; bron- en persoonlijke gegevens gescheiden. |
| 6 — verdere groei | Persoonlijke aanbevelingen, publicatie/businessproef en Flowcode | #58, I30, I31 | Alleen na product-/privacybesluit en aantoonbare waarde; geen afhankelijkheid voor gewone registratie. Een eventuele route-SVG blijft optionele latere scope van Ritten. |

**Kritieke afhankelijkheden:** I04 → I05/I08; I08/I09 → I10; I10 → I13/I17–I23; I13 + #59 → organisatiegebonden pasvoorstellen; I24 → I25; I26/I27 → I28; I26/I27/#57 → I30. De gebruiker mag al eerder kleine zelfstandige modules gebruiken zodra hun gegevens veilig en herstelbaar zijn.

**Eerste concrete werkpakket:** I01, I03 en I04/I05 zijn het hoogste waarde-/risicopakket. I03 is één onderliggend referentieprobleem, ook al raken kaarten én webbronnen het. Los die niet in twee losse inconsistent uitgevoerde issues op. I02 en I06 komen vóór nieuwe proefpromotie naar regulier.

## Voorstel GitHub Project

Naam: **Sharon — persoonlijke contextassistent**. Kolommen exact: **Te beoordelen → Gepland → In uitvoering → Testen → Gereed**.

Velden: Prioriteit P0–P3; Type; Epic; Module(s); Complexiteit S/M/L; Afhankelijkheden; Bron; Bewijsniveau; Acceptatiestatus. Gebruik ‘Geblokkeerd’ als veld/reden binnen de bestaande werkstap, zonder extra verplichte kolom. Maak toekomstige ontwerpen niet automatisch Gepland. ‘Gereed’ vereist testbewijs en, voor regulier gedrag, de relevante publicatie-/apparaatcontrole.

Epics: Betrouwbare technische basis; Consistente gebruikersinterface; Gegevens en relaties; Contextmotor; Persoonlijke modules; Samenwerking en gedeelde boards; Externe informatie en organisaties; Publiceren en verdienmodel.

## Bestaande issues en PR’s: deduplicatie

Alle **102 Sharon-items** zijn gepagineerd geïnventariseerd: **9 open issues en 93 gesloten, gemergede PR’s**; geen open PR’s aangetroffen. Alle **80 Log-items**: 1 gesloten issue, 79 gesloten PR’s, waarvan 76 gemerged. Alle items zijn op metadata, titel en beschikbare bodytekst geïnventariseerd voor relevantie; de negen open Sharon-issues zijn volledig gelezen en relevante implementatie is aan broncode getoetst. Niet iedere PR-diff of reviewcommentaar is uitputtend onderzocht. De negen open Sharon-issues hadden ieder nul comments bij inventarisatie.

| Bestaand issue | Auditbesluit | Koppeling roadmap |
|---|---|---|
| #52 gedeelde kaartviewer/winkelherkenning/pasjes | **Hergebruiken als epic/overkoepelende scope.** Viewer en pure geografische index bestaan al. #59 vervangt eerdere tegenstrijdige herkenningskeuzes | Fase 2/4/5; geen duplicaat ‘bouw kaartviewer’. |
| #53 Wikipedia-laag | **Aanvullen en herbeoordelen.** Veel reeds geïmplementeerd, tekst ‘niet geïmplementeerd’ verouderd; compacte lokale Q-index/limieten blijven open | Fase 2/5; afrondtest en resterende scope. |
| #54 boards positioneren | **Aanvullen.** Hoogte-/layoutcode bestaat; vrij volledig boarddraggen en gebaarconflicten nog N | Fase 2 na I14/I15. |
| #55 prefetch/kompas | **Hergebruiken voor validatie/afronding.** Prefetch, cachelimiet zes en sessiekompas bestaan | Niet opnieuw bouwen; bewijs #55 bijwerken na lifecycle-/apparaatproef. |
| #56 privéwebpagina locatie | **Aanvullen.** URL-opslag en UI bestaan; UUID-contract en mergepad vragen herstel | I03/I09 zijn afhankelijkheden; #56 na regressietest afronden. |
| #57 publicatie/Sharon Button | **Hergebruiken** voor expliciete bronrechten, verificatie/intrekken | Fase 5; geen nieuw identiek publicatiecontrole-issue. |
| #58 aanbevelingen | **Behouden P3**, onderscheiden van contextregels voor directe handelingen | Fase 6 na I25; alleen lokale transparante signalen. |
| #59 lokale pasherkenning/zones/delta | **Hergebruiken**; pure GeographicBranchIndex bestaat, productieketen ontbreekt | Fase 4/5 na I13/I16/I24; actuele tekst leidend boven #52. |
| #60 vrijwillige locatiebijdragen | **Behouden als ontwerp/latere uitbreiding** | Fase 5/6, expliciete publicatie; geen persoonlijke zones meesturen. |

Relevante gesloten PR’s: #39/#50/#51 (Locaties), #61/#71–#84 (Kaarten), #68/#69 (webbronboard), #85–#94 (skelet/graph/boards), #95–#97 (viewport), #98–#102 (moduleuitleg/swipes/relaties). Een merge sluit alleen de beschreven verandering af; hij bewijst niet de gehele oorspronkelijke issuevisie. De syntaxhotfix na #102 staat afzonderlijk in de commithistorie. Log #55/#72/#76/#80 zijn belangrijke referenties voor data-export, herstel en promotie; geen verzoek om Log-issues te heropenen.

# F. GitHub-backlog ter beoordeling

De identifiers I01–I32 en E52–E60 zijn **rapportnummers**, geen nieuw aangemaakte GitHub-issuenummers. Alle voorstellen starten in **Te beoordelen**. Er zijn 33 nieuwe kandidaatissues en 9 voorstellen voor bestaande issues. Epics zijn groeperingen, geen extra dubbel werk. Onder ‘waarde/noodzaak/risico’ staat de motivatie; risico betreft de wijziging of het probleem en is geen onbewezen incidentclaim.

De volgende sectie bevat voor ieder voorstel de gevraagde titel, beschrijving, huidige en gewenste situatie, bron, toetsbare criteria, technische aandachtspunten, test, prioriteit, complexiteit en afhankelijkheden.
## F1. Overzicht voorstellen

| ID | Prioriteit | Type | Complexiteit | Titel / bestemming |
|---|---|---|---|---|
| I01 | P1 | Test | M | [P1][Test][Publicatie] Publiceer alleen het exact gecontroleerde applicatie-artifact |
| I02 | P1 | Bug | L | [P1][Bug][PWA] Maak cache en moduleversies één controleerbare release-eenheid |
| I03 | P1 | Bug | M | [P1][Bug][Locaties] Behoud alle verwijzingen en webbronnen bij samenvoegen |
| I04 | P1 | Architectuur | L | [P1][Architectuur][Opslag] Bevestig writes pas na commit en ondersteun atomische bewerkingen |
| I05 | P1 | Functionaliteit | L | [P1][Functionaliteit][Instellingen] Voeg complete back-up en gecontroleerd herstel toe |
| I06 | P1 | Bug | M | [P1][Bug][Testomgeving] Isoleer alle testdata, voorkeuren en locatie-effecten |
| I07 | P1 | Bug | M | [P1][Bug][Instellingen] Maak reset begrensd, controleerbaar en herstelbaar |
| I08 | P1 | Architectuur | L | [P1][Architectuur][Kern] Breng productie en proef naar één versioneerbaar objectcontract |
| I09 | P2 | Technische schuld | M | [P2][Technische schuld][Identifiers] Pas het 12-tekencontract en aliasbeleid consequent toe |
| I10 | P2 | Architectuur | L | [P2][Architectuur][Relaties] Borg canonieke richting en veilige levenscyclus in productie |
| I11 | P1 | Test | M | [P1][Test][Kwaliteit] Test echte gebruikersketens en uitval naast bronasserties |
| I12 | P2 | Architectuur | M | [P2][Architectuur][Modules] Gebruik één modulemanifest met eigen adapters en capabilities |
| I13 | P2 | Functionaliteit | L | [P2][Functionaliteit][Personen] Koppel personen aan organisaties en vestigingen met afgeleid werkadres |
| I14 | P2 | UX-verbetering | L | [P2][UX][Boards] Maak sluiten, terug en objectpresentatie consistent |
| I15 | P2 | Bug | M | [P2][Bug][Stroken] Herstel swipe-cancel en cleanup en scheid delen van terug |
| I16 | P2 | Architectuur | S | [P2][Architectuur][Locatie] Laat Kaarten de centrale GPS-voorziening gebruiken |
| I17 | P2 | Functionaliteit | L | [P2][Functionaliteit][Acties] Lever zelfstandige acties met optionele thema’s en relaties |
| I18 | P2 | Functionaliteit | M | [P2][Functionaliteit][Notities] Bewaar notities zelfstandig en verbind ze later |
| I19 | P2 | Functionaliteit | L | [P2][Functionaliteit][Agenda] Maak lokale afspraken met optionele context |
| I20 | P2 | Functionaliteit | M | [P2][Functionaliteit][Objecten] Leg voorwerpen eenvoudig vast en bereik ze vanuit hun context |
| I21 | P2 | Functionaliteit | L | [P2][Functionaliteit][Codes] Resolve gescande codes naar bestaande objecten met expliciete acties |
| I22 | P2 | Functionaliteit | L | [P2][Functionaliteit][Tijd] Bouw tijdregistratie op de nieuwe kern met Log-gedrag |
| I23 | P2 | Functionaliteit | L | [P2][Functionaliteit][Ritten] Registreer ritten met standaardvoertuig en vaste historische koppeling |
| I24 | P2 | Architectuur | L | [P2][Architectuur][Context] Rangschik echte context met expliciete keuzes als hoogste bewijs |
| I25 | P2 | Functionaliteit | M | [P2][Functionaliteit][Context] Leer lokaal van voorstellen met beperkte en wisbare feedback |
| I26 | P2 | Architectuur | L | [P2][Architectuur][Externe boards] Scheid broninhoud, persoonlijke annotaties en modulehandelingen |
| I27 | P2 | Architectuur | L | [P2][Architectuur][Delen] Ontwerp rechten, synchronisatie en conflicten vóór gedeelde mutaties |
| I28 | P2 | Functionaliteit | L | [P2][Functionaliteit][Samenwerking] Ondersteun gedeelde acties en afspraken met aantoonbare rechten |
| I29 | P3 | Technische schuld | M | [P3][Technische schuld][Performance] Begrens broncaches en meet opslag, rendering en energie |
| I30 | P3 | Toekomstige uitbreiding | M | [P3][Toekomstige uitbreiding][Organisaties] Beproef vrijwillige bedrijfsboards en het verdienmodel |
| I31 | P3 | Historisch concept | M | [P3][Historisch concept][Codes] Evalueer Flowcode als aanvullende informatiedrager |
| I32 | P2 | Functionaliteit | L | [P2][Functionaliteit][Migratie] Importeer waardevolle Log-data via een herhaalbare adapter |
| I33 | P2 | Bug | S | [P2][Bug][Kaarten] Rond opslaan af en voorkom herhaalde creatie vanuit hetzelfde formulier |
| E52 | P2 | Architectuur | S | [P2][Architectuur][Kaartbasis] Actualiseer #52 als overkoepelende kaart- en pasjesroadmap |
| E53 | P2 | Test | M | [P2][Test][Omgeving] Valideer #53 en begrens de resterende Wikipedia-indexscope |
| E54 | P2 | UX-verbetering | M | [P2][UX][Boards] Rond #54 af binnen het gedeelde gebarencontract |
| E55 | P2 | Test | S | [P2][Test][Boards] Bewijs en rond #55 prefetch en kompasbehoud af |
| E56 | P2 | Test | S | [P2][Test][Locaties] Werk #56 bij voor bestaande privéwebbronnen en hersteltesten |
| E57 | P2 | Functionaliteit | L | [P2][Functionaliteit][Publiceren] Behoud #57 voor bronrechten en intrekking |
| E58 | P3 | Toekomstige uitbreiding | M | [P3][Toekomstige uitbreiding][Context] Behoud #58 voor transparante bronaanbevelingen |
| E59 | P2 | Functionaliteit | L | [P2][Functionaliteit][Kaarten] Voer #59 lokale pasherkenning en persoonlijke zones uit |
| E60 | P3 | Toekomstige uitbreiding | L | [P3][Toekomstige uitbreiding][Locaties] Behoud #60 voor vrijwillige bronbijdragen |

## F2. Uitgewerkte voorstellen

### I01 — [P1][Test][Publicatie] Publiceer alleen het exact gecontroleerde applicatie-artifact

**Epic:** Betrouwbare technische basis. **Classificatie:** Test. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge waarde/noodzaak: voorkomt appbrede uitval. Risico M bij aanpassen releasepad.

**Huidige situatie:** Pages op eeee0cd is geslaagd terwijl Sharon controles geannuleerd is. De repositoryworkflow koppelt deployment niet aan testresultaat.

**Gewenste werking:** Iedere publicatie wordt geblokkeerd door mislukte of afgebroken vereiste controles; geteste SHA en gedeployde artifact horen aantoonbaar bij elkaar.

**Bron:** Sharon [R02–R05]; F01/F12.

**Acceptatiecriteria:**

- [ ] Syntax, npm test, imports, releaseassetcheck en boot-smoke zijn verplichte afhankelijkheden van deployment.
- [ ] Een bewust ongeldig testartifact wordt niet gepubliceerd.
- [ ] Annuleren of een nieuwere commit maakt een oud artifact niet alsnog publiceerbaar.
- [ ] SHA, buildversie en testresultaat zijn terug te vinden; branchregels ter beoordeling vastgelegd.

**Technische aandachtspunten:** .github/workflows/sharon-checks.yml, Pages-workflow/configuratie; checknamen stabiel houden. Geen release maken tijdens deze audit.

**Testscenario:** In afzonderlijke testbranch syntaxfout, testfailure en cancelled-run simuleren; deployassertie controleert dezelfde artifacthash/SHA. Daarna correcte build en offline-smoke.

**Prioriteit en complexiteit:** P1 / M. **Afhankelijkheden:** Geen; koppelt later aan I02/I11.

### I02 — [P1][Bug][PWA] Maak cache en moduleversies één controleerbare release-eenheid

**Epic:** Betrouwbare technische basis. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge betrouwbaarheid; risico L door cachemigratie.

**Huidige situatie:** Oude queryversies, ontbrekende exacte precache-importen en installatie die losse fetchfouten negeert. check-version controleert slechts vier bestanden.

**Gewenste werking:** De shell en noodzakelijke moduleclosure zijn samen beschikbaar; een onvolledige update verdringt de vorige werkende build niet.

**Bron:** Sharon [R04], [R06], [R16]; F04.

**Acceptatiecriteria:**

- [ ] Bouwmanifest bevat de volledige start- en afgesproken offline-moduleclosure.
- [ ] Buildidentiteit is gelijk in package, Shell, entrypoints en serviceworker; geen onbedoelde dubbele module-URL’s.
- [ ] Mislukte noodzakelijke assetdownload houdt oude build bruikbaar.
- [ ] Herstart offline na upgrade werkt; externe kaartafhankelijkheden hebben expliciete offlinegrens.

**Technische aandachtspunten:** service-worker.js, main.js, import-URL’s, scripts/check-version.mjs. Beleid voor skipWaiting/claim en open tabbladen expliciet kiezen; geen blind alle externe tegels precachen.

**Testscenario:** Twee versies, oud tabblad, tweede tab, onderbroken download, offline heropenen en rollback; op desktop en geïnstalleerde iPhone.

**Prioriteit en complexiteit:** P1 / L. **Afhankelijkheden:** I01/I11; geen afhankelijkheid van nieuwe domeinmodules.

### I03 — [P1][Bug][Locaties] Behoud alle verwijzingen en webbronnen bij samenvoegen

**Epic:** Gegevens en relaties. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge gegevenswaarde; concreet defect. Risico M, migratie zorgvuldig.

**Huidige situatie:** Reproductie: kaart blijft naar vervallen platte locationId verwijzen; privéwebbronnen blijven onder oude meta-key. Preview telt die afhankelijkheden niet.

**Gewenste werking:** Samenvoegen behoudt hoofd-ID, zet alle afhankelijke verwijzingen en bronnen om en laat de oude identiteit traceerbaar doorverwijzen.

**Bron:** Sharon [R07], [R08], [R12]; extra auditintegratie F02.

**Acceptatiecriteria:**

- [ ] Kaarten, sublocaties, triggers, privéwebbronnen en onboardingpointer verwijzen na merge correct.
- [ ] Preview toont echte gevolgen en uitsluitend inhoudelijke verschillen, zonder technische ID’s.
- [ ] Dubbele bron-URL’s worden zonder verlies gededupliceerd.
- [ ] Vervallen ID heeft alias/tombstone; cyclusmerge blijft geblokkeerd.
- [ ] Onderbreking schrijft alles of niets; geen half omgezette dataset.

**Technische aandachtspunten:** LocationsView.mergeLocations, CardsView.records en LocationWebSources. Eerst bestaande veldvormen ondersteunen; daarna I08-adapter. Eén issue voor het onderliggende referentieprobleem.

**Testscenario:** Fixture met twee locaties, kaart, kind, trigger, bronlinks en onboarding; beide bewaar-keuzes; fout midden in commit; heropen lijst en kaart.

**Prioriteit en complexiteit:** P1 / M. **Afhankelijkheden:** I04 voor atomische eindoplossing; veilig tijdelijk blokkeren kan direct.

### I04 — [P1][Architectuur][Opslag] Bevestig writes pas na commit en ondersteun atomische bewerkingen

**Epic:** Betrouwbare technische basis. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge technische noodzaak en gegevensbescherming. Risico L aan kern.

**Huidige situatie:** ObjectStore wacht op requests, biedt geen multirecordtransactie en geen versionchange-/blocked-protocol; settings verandert geheugen vóór opslag.

**Gewenste werking:** Writes, merge en migraties krijgen commit-/abortgarantie en voorspelbare foutmeldingen zonder in-memory schijnsucces.

**Bron:** Sharon [R10], [R11], [R07]; F06.

**Acceptatiecriteria:**

- [ ] API voor één transactie over benodigde stores en wachten op complete.
- [ ] Abort/quota wijzigt noch blijvende data noch bevestigd settingsgeheugen.
- [ ] Upgrade en tweede tab verwerken versionchange/blocked zichtbaar en veilig.
- [ ] Module schrijft alleen via gevalideerd repositorycontract.

**Technische aandachtspunten:** ObjectStore.js, SettingsService.js, events pas na commit. IndexedDB-transacties niet door willekeurige externe awaits laten verlopen.

**Testscenario:** fake-indexeddb en browser: request success gevolgd door transaction abort, quota, tweede tab, upgrade en onderbroken merge; rollback aantonen.

**Prioriteit en complexiteit:** P1 / L. **Afhankelijkheden:** Geen; basis voor I03/I05/I08.

### I05 — [P1][Functionaliteit][Instellingen] Voeg complete back-up en gecontroleerd herstel toe

**Epic:** Betrouwbare technische basis. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge waarde; voorkomt onherstelbare afhankelijkheid van browseropslag. Risico L.

**Huidige situatie:** Geen complete export/herstel in Sharon; kaart-QR omvat slechts één kaart zonder lokale relaties.

**Gewenste werking:** Gebruiker kan een herstelbare, gevalideerde snapshot maken en met preview veilig terugzetten.

**Bron:** Sharon [R10/R11], Log backup-state.js en log-json-v2.js [R20]; F03.

**Acceptatiecriteria:**

- [ ] Export omvat objects, relevante settings/meta, relaties en tracks, met schema/build en expliciete private scope.
- [ ] Herstel valideert versie, IDs en referenties vóór schrijven.
- [ ] Preview toont aantallen/conflicten; ongeldige of te grote invoer blijft zonder gevolg.
- [ ] Restore is atomisch en roundtrip behoudt IDs, timestamps, archief en historische voertuigkoppelingen.
- [ ] Geen upload/publicatie van back-up zonder afzonderlijke keuze.

**Technische aandachtspunten:** Nieuw Sharon-backupcontract; Log alleen adapter/gedragsbron. Geheimen/permissions niet automatisch exporteren. Toekomstige niet-lokale broncaches onderscheidbaar.

**Testscenario:** Export→nieuw leeg profiel→import→deep comparison; malformed JSON, unsupported schema, quota, halve restore en herstel na upgrade.

**Prioriteit en complexiteit:** P1 / L. **Afhankelijkheden:** I04 en versiecontract uit I08.

### I06 — [P1][Bug][Testomgeving] Isoleer alle testdata, voorkeuren en locatie-effecten

**Epic:** Betrouwbare technische basis. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge testbetrouwbaarheid en privacywaarde. Risico M.

**Huidige situatie:** Testkaart schermt objects/meta deels af, maar Wikipedia-feedback/filterlocalStorage en LocationTriggerService delen productieroutes.

**Gewenste werking:** Testmodus gebruikt een eigen opslag-/servicecontext en fictieve contextsignalen; reguliere privégegevens blijven onveranderd.

**Bron:** Sharon app.js, Shell.js, WikipediaLayer.js, BoardViewer.js [R06/R15]; F05.

**Acceptatiecriteria:**

- [ ] Objecten, boardfeedback, bronfilters, camera en contextfeedback hebben eigen testnamespace.
- [ ] Test-GPS of testevents verwerken geen reguliere location-actions.
- [ ] Omschakelen stopt alle listeners/timers van vorige context.
- [ ] Voorbeeld-ID’s kunnen niet ongemerkt als echte objecten worden geïmporteerd.
- [ ] Snapshot van reguliere stores/localStorage vóór en na alle testhandelingen is gelijk.

**Technische aandachtspunten:** Context-injectie in appbootstrap en bronadapters; geen overal hardgecodeerde prefixpatches. Publieke kaarttegels mogen gedeelde neutrale cache houden.

**Testscenario:** Reguliere fixture plus testmodus; wijzig filters, feedback, objecten, GPS, triggers en wissel terug; assert alle reguliere waarden gelijk.

**Prioriteit en complexiteit:** P1 / M. **Afhankelijkheden:** I04 gewenst; kan gefaseerd vóór I08.

### I07 — [P1][Bug][Instellingen] Maak reset begrensd, controleerbaar en herstelbaar

**Epic:** Betrouwbare technische basis. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge waarde bij herstel; risico L bij destructieve functie.

**Huidige situatie:** Reset gebruikt localStorage.clear/sessionStorage.clear en accepteert blocked db-delete als voltooid, terwijl open DB niet gesloten wordt.

**Gewenste werking:** Alleen gekozen Sharon-gegevens worden gewist; geblokkeerd verwijderen geeft herstelbare uitleg en geen onterecht succes.

**Bron:** Sharon SettingsView.js [R11]; F06 en D6.

**Acceptatiecriteria:**

- [ ] Geen originbrede clear voor niet-Sharon-keys.
- [ ] DB-verbinding wordt beheerst gesloten; blocked/abort meldt juiste status.
- [ ] Scope privé/test en effect worden vooraf getoond.
- [ ] Back-up-ingang beschikbaar en opnieuw starten toont aantoonbaar gekozen staat.

**Technische aandachtspunten:** Resetservice met specifieke keyregisters; voorkom loops bij andere open tab. Geen reset in deze audit uitvoeren.

**Testscenario:** Testprofiel met vreemde key en tweede tab; reset privé/test afzonderlijk, blocked state, herstart en back-upterugzet.

**Prioriteit en complexiteit:** P1 / M. **Afhankelijkheden:** I04/I05.

### I08 — [P1][Architectuur][Kern] Breng productie en proef naar één versioneerbaar objectcontract

**Epic:** Gegevens en relaties. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Blokkeert consistent samenwerken; hoge noodzaak, risico L.

**Huidige situatie:** Locatie-envelope, platte card en geneste skeletdataset verschillen; types en timestamps zijn niet uniform.

**Gewenste werking:** Module-eigen data past in één persistente envelope met gerichte adapters en migraties; geen betekenisverlies.

**Bron:** Sharon [R07–R10/R13], Log migratieprincipes [R20].

**Acceptatiecriteria:**

- [ ] Envelope, typecatalogus, schemaVersion, revision en tijdformaat beschreven en gevalideerd.
- [ ] Locaties en kaarten blijven leesbaar na idempotente migratie met dezelfde IDs.
- [ ] Proefdata wordt niet stilzwijgend echte persoonlijke data.
- [ ] Modules behouden eigen validatie/velden en mogen zelfstandig bestaan.
- [ ] Query-/migratiecontract ondersteunt toekomstige relaties en export.

**Technische aandachtspunten:** ObjectRepository boven ObjectStore; moduleadapters. Niet alle velden als triples opslaan; niet alles naar één grote JSON-dataset kopiëren.

**Testscenario:** Oude location/card-fixtures, tweemaal migreren, fout halverwege, onbekend type en ontbrekende optionele velden; ID-/referentievergelijking.

**Prioriteit en complexiteit:** P1 / L. **Afhankelijkheden:** I04/I05; I09 ID-policy samen beoordelen.

### I09 — [P2][Technische schuld][Identifiers] Pas het 12-tekencontract en aliasbeleid consequent toe

**Epic:** Gegevens en relaties. **Classificatie:** Technische schuld. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge consistentiewaarde; risico M migratie.

**Huidige situatie:** IdentifierService is correct; privéwebbron-ID is UUID; create/import en externe index bewaken uniciteit niet centraal.

**Gewenste werking:** Elke persistente object-/relatie-identiteit onder het productcontract gebruikt 12 random tekens; legacy/externe codes krijgen expliciete aliases.

**Bron:** Sharon [R09/R10/R12], Log identity separation; F10.

**Acceptatiecriteria:**

- [ ] Scope lokaal-ID versus publieke deel-ID expliciet vastgelegd.
- [ ] Webbronrelaties en nieuwe cards gebruiken centrale creatie met collisionguard.
- [ ] Import behandelt dezelfde identiteit idempotent en andere inhoud met ID-conflict zichtbaar.
- [ ] Geen geografische code als willekeurig object-ID; geen ID als autorisatiegeheim.

**Technische aandachtspunten:** IdentifierService, ObjectRepository, LocationWebSources; externe Q-ID/OSM-ID als provenance bewaren. Oude URL-relaties migreren met alias.

**Testscenario:** Geforceerde randomcollision, fout alfabet/lengte, UUID-legacy, import twice en twee bronnen met hetzelfde externe ID.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I08/I04.

### I10 — [P2][Architectuur][Relaties] Borg canonieke richting en veilige levenscyclus in productie

**Epic:** Gegevens en relaties. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge samenhang en datawaarde; risico L.

**Huidige situatie:** Graph is test-only; A contains B en B belongs-to A worden dubbel toegelaten. Productie verwijzingen hebben geen gezamenlijke lifecycle.

**Gewenste werking:** Relaties hebben type-/richtingscontract, inverse presentatie en archive/merge/remove-beleid met provenance.

**Bron:** Sharon GraphService/ContextSuggestions/SkeletonCore [R13/R14], Log removal-policy.js [R21]; F09.

**Acceptatiecriteria:**

- [ ] Semantisch inverse duplicaten geweigerd of gecanoniseerd.
- [ ] Bron-/doeltypen en benodigde cardinaliteit getest; rit heeft bestemming locatie, niet omgekeerd.
- [ ] Verschillende zinvolle relaties tussen hetzelfde paar blijven mogelijk.
- [ ] Archive/restore behoudt verbonden data; delete volgt referentiebeleid.
- [ ] Alle mutaties na expliciete keuze en atomisch.

**Technische aandachtspunten:** RelationRepository/GraphService; natuurlijke modulepolicies buiten centrale technische kern. Historische snapshots/valid-from indien betekenis dat vraagt.

**Testscenario:** Omgekeerd dubbelpaar, verkeerde types, meerdere legitieme relaties, archiveren/herstellen, merge en verwijderen met referenties.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I04/I08/I09.

### I11 — [P1][Test][Kwaliteit] Test echte gebruikersketens en uitval naast bronasserties

**Epic:** Betrouwbare technische basis. **Classificatie:** Test. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge noodzaak; risico S/M aan harness.

**Huidige situatie:** 190 tests slagen, maar veel UI-tests zoeken strings. Geen volledige apparaat-/update-/storagefaultdekking.

**Gewenste werking:** Compacte regressiesuite dekt boot, opslaan, relaties, navigatie en fouten in echte geassembleerde app.

**Bron:** Sharon tests [R17], Log assembled/readiness-tests [R22]; F12.

**Acceptatiecriteria:**

- [ ] CI-runtime gelijk aan gecontroleerde lokale Nodeversie of beide expliciet getest.
- [ ] Boot-smoke opent regulier én test zonder consolefout.
- [ ] Hoogrisicoketens merge/restore/upgrade krijgen gedragstests.
- [ ] 20 scenario’s uit audit zijn traceerbaar met pass/fail/nog niet mogelijk.
- [ ] iPhone/PWA-handtestresultaat met toestel/build wordt bij relevante releases vastgelegd.

**Technische aandachtspunten:** Geen dubbele tests die implementatietekst kopiëren; gebruik fake storage en lokale fixtures, geen persoonlijke data of externe writes.

**Testscenario:** Negatieve mutant in tempfixture moet suite laten falen; netwerk uit, GPS denied, quota, camera denied en nieuw tabblad.

**Prioriteit en complexiteit:** P1 / M. **Afhankelijkheden:** I01 als releasepoort; domeintests groeien mee.

### I12 — [P2][Architectuur][Modules] Gebruik één modulemanifest met eigen adapters en capabilities

**Epic:** Consistente gebruikersinterface. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Minder dubbele logica en duidelijker UI; risico M.

**Huidige situatie:** Registry, Shell-menu en skeletmodulelijst verschillen in people/persons en time/tasks; placeholders hebben schijnbaar functionele plus.

**Gewenste werking:** Eén definitie stuurt titel, beschikbaarheid, mount/unmount en module-eigen acties; productstatus blijft eerlijk.

**Bron:** Sharon ModuleRegistry/Shell/SkeletonCore [R06/R13].

**Acceptatiecriteria:**

- [ ] Alle 13 gevraagde onderdelen expliciet geregistreerd of als concept gemarkeerd.
- [ ] Geen dubbele ID-vertalingen in Shell.
- [ ] Elke mount heeft werkende cleanup en errorscreen.
- [ ] Plus voegt informatie toe of is als toekomstfunctie herkenbaar; geen opgeslagen voorbeelden.

**Technische aandachtspunten:** Lichte descriptors, lazy import en context-/boardadaptercontract. Geen centrale verzameling moduleforms.

**Testscenario:** Manifestconsistentie, iedere module openen/sluiten, mislukte lazy load, lege dataset en test/live dispatch.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I08; UI-contract afstemmen I14.

### I13 — [P2][Functionaliteit][Personen] Koppel personen aan organisaties en vestigingen met afgeleid werkadres

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge assistentwaarde; risico M/L domein.

**Huidige situatie:** Personen is regulier placeholder; organisatie/vestiging en afgeleid werkadres ontbreken.

**Gewenste werking:** Persoon met naam direct bewaren; privé- en werkrelaties optioneel, werkadres via eenduidige vestiging afleiden.

**Bron:** Sharon visie, testpersonen; Log people/contact-import [R18/R21].

**Acceptatiecriteria:**

- [ ] Persoon/organisatie/vestiging heeft eigen stabiele ID en kan zonder relaties bestaan.
- [ ] Eén bekende werkvestiging levert afgeleid adres zonder dubbele invoer.
- [ ] Bij meerdere vestigingen pas vragen wanneer adres nodig is.
- [ ] Privéadres blijft apart en eigen expliciete informatie heeft voorrang.
- [ ] Organisatie herbruikbaar vanuit Kaarten/Agenda/Locaties zonder duplicaat.

**Technische aandachtspunten:** Type-/relatiepolicies, geen nieuwe verplichte hoofdmenu’s; provenance bij import; vergelijk naamnormalisatie met bestaande organisatie.

**Testscenario:** Nul/één/twee vestigingen, verhuizing organisatie, historische afspraak, eigen override, typo/case en dubbele import.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I08/I09/I10.

### I14 — [P2][UX][Boards] Maak sluiten, terug en objectpresentatie consistent

**Epic:** Consistente gebruikersinterface. **Classificatie:** UX-verbetering. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge gebruikswaarde; risico M aan bekende interacties.

**Huidige situatie:** CardBoard, Wikipedia BoardViewer en skelet hebben eigen sluit-/teruggedrag; CardBoard omlaag klapt alleen in.

**Gewenste werking:** Tik op strook opent board; omlaag sluit; terug gaat naar vorige plek met toestand; bewerken blijft een aparte handeling.

**Bron:** Sharon [R06/R08/R15], Nesdeck inhoud/view-principe [R23]; F07.

**Acceptatiecriteria:**

- [ ] Kaart-, locatie-, extern en testboard volgen hetzelfde basiscontract.
- [ ] Vorige module/object/scrollpositie herstelt zonder nieuw object te maken.
- [ ] Scrollende boardinhoud en kaartpan veroorzaken geen onbedoeld sluiten.
- [ ] Moduleadapter bepaalt informatie en toegestane acties.
- [ ] Dialog focusval, Escape en terugfocus werken.

**Technische aandachtspunten:** NavigationService, gedeelde boardframe/lifecycle, moduleviews gescheiden; geen grote samensmelting van Wikipedia-fetch en pasjescode.

**Testscenario:** A→gelinkt B→terug A, edit→annuleer, downward close, lange tekst scroll, desktop toetsenbord en iPhone touch.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I12/I15; #54/#55 hierop aansluiten.

### I15 — [P2][Bug][Stroken] Herstel swipe-cancel en cleanup en scheid delen van terug

**Epic:** Consistente gebruikersinterface. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Middel/hoge betrouwbaarheid; risico M gesturewijziging.

**Huidige situatie:** pointercancel behandelt gesture als pointerup; release verwijdert rijhandlers niet; rechterswipe heeft geen generiek deelcontract.

**Gewenste werking:** Strook volgt vinger, korte of geannuleerde gesture herstelt veilig; links toont acties en rechts biedt alleen toegestane deelpreview.

**Bron:** Sharon SwipeRows/SwipeHome/Shell [R06/R15]; auditpointertest F08.

**Acceptatiecriteria:**

- [ ] pointercancel, lostpointercapture en verlaten oppervlak resetten zonder uitvoeren.
- [ ] Cleanup verwijdert alle handlers/timers en reageert niet meer op oude DOM.
- [ ] Verticaal scrollen blijft leidend bij verticale richting.
- [ ] Delen wordt eerst preview; geen automatische verzending.
- [ ] Rand-terug en rij-delen hebben toetsbaar onderscheiden gebaarzones en toetsenbordalternatief.

**Technische aandachtspunten:** Gesture-eigenaarschap en pointer capture zorgvuldig; gebruik AbortController of named listeners. Delen-capability per module, geen payloadregels in binder.

**Testscenario:** 20 px, 100 px cancel, snelle diagonaal, multi-touch, scroll, cleanup/rebind en mouse/touch; geen dubbele callback of ongewenste delete/share.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I14-contract; technische fix kan eerder.

### I16 — [P2][Architectuur][Locatie] Laat Kaarten de centrale GPS-voorziening gebruiken

**Epic:** Betrouwbare technische basis. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Duidelijke noodzaak/energieconsistentie; risico S.

**Huidige situatie:** Dichtbij in CardsView vraagt direct navigator.geolocation; geen gedeeld pending-/pauze-/cachebeleid.

**Gewenste werking:** Alle modules gebruiken één LocationService; UI bepaalt alleen waarom en welke actualiteit nodig is.

**Bron:** Sharon CardsView/LocationService [R08/R11], Log energy-location-actions [R22]; F11.

**Acceptatiecriteria:**

- [ ] Geen directe GPS-call meer buiten locatieprovider.
- [ ] Gelijktijdige aanvragen delen één pending meting.
- [ ] Hidden/resume en denied/offline hebben rustige fallback.
- [ ] Eén lopende rit bepaalt frequentie, kaarten voegen geen timer toe.

**Technische aandachtspunten:** location via openCardsView injecteren; expliciete policy voor handmatig Dichtbij en late callbacks.

**Testscenario:** Tegelijk Kaarten/Locaties, verborgen app tijdens pending, denied en cacheduur; GPS-callteller en geen idle timer.

**Prioriteit en complexiteit:** P2 / S. **Afhankelijkheden:** Geen; ondersteunt I23/#59.

### I17 — [P2][Functionaliteit][Acties] Lever zelfstandige acties met optionele thema’s en relaties

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge dagelijkse waarde; risico M.

**Huidige situatie:** Regulier placeholder; proef ondersteunt al omschrijving-only en later persoon, maar geen productiedomein.

**Gewenste werking:** Actie met alleen omschrijving opslaan; thema’s ordenen boven acties; personen/locaties/tijd later verbinden.

**Bron:** Sharon visie/testactie [R13/R14], Log actionregels [R21].

**Acceptatiecriteria:**

- [ ] Opslaan met uitsluitend omschrijving levert stabiele ID.
- [ ] Geen verplichte persoon/thema/datum/locatie.
- [ ] Thema kan zelfstandig bestaan; actie kan later aan één of meer thema’s volgens policy.
- [ ] Bekijken, bewerken, gereed/open en archiveren zijn gescheiden en herroepbaar.
- [ ] Relatie toevoegen verandert oorspronkelijke ID niet.

**Technische aandachtspunten:** Actie- en themamoduleadapters; generieke search voor bestaande objecten, niet verplicht technisch relatietype kiezen.

**Testscenario:** Leeg profiel→omschrijving→heropen→persoon/thema→archive/restore; vergelijk ID en back-up.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I08/I10/I12/I14.

### I18 — [P2][Functionaliteit][Notities] Bewaar notities zelfstandig en verbind ze later

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge lage-invoerdrempelwaarde; risico S/M.

**Huidige situatie:** Notities is preview-only zonder persistente editor.

**Gewenste werking:** Tekst snel vastleggen en later vanuit actie/persoon/object bereiken met dezelfde identiteit.

**Bron:** Sharon visie/placeholder [R06], Log registratienotities [R18].

**Acceptatiecriteria:**

- [ ] Alleen tekst volstaat; relaties optioneel.
- [ ] Vanuit actie gestart levert voorstel, geen ongemerkte relatie.
- [ ] Bewerken, heropenen, archiveren en zoeken behouden inhoud/ID.
- [ ] Lange en Unicode-tekst blijven bruikbaar en veilig weergegeven.

**Technische aandachtspunten:** Plain-text als eerste scope; geen richtext/HTML-import nodig voor MVP. Boardview apart van editor.

**Testscenario:** Notitie→actie koppelen→beide routes→edit→restore; XSS-achtige tekst verschijnt als tekst.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I17/I10/I14.

### I19 — [P2][Functionaliteit][Agenda] Maak lokale afspraken met optionele context

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge assistentwaarde; risico M tijdmodel.

**Huidige situatie:** Agenda toont uitsluitend uitleg; geen afspraak of locatierelatie.

**Gewenste werking:** Afspraak zelfstandig plannen en optioneel koppelen aan persoon, organisatie, vestiging of locatie.

**Bron:** Sharon oorspronkelijke visie [R06], natuurlijke relatievoorstellen audit.

**Acceptatiecriteria:**

- [ ] Afspraak kan zonder persoon/locatie worden opgeslagen.
- [ ] Tijdzone en start/einde gevalideerd; datumloze actie blijft aparte actie.
- [ ] Locatieadres wordt afgeleid zonder dubbele kopie waar mogelijk.
- [ ] Contextmotor leest expliciete afspraak vóór GPS-vermoeden.
- [ ] Wijziging en annuleren behouden traceerbare identiteit.

**Technische aandachtspunten:** Eerst lokale eenmalige afspraken; herhaling/externe kalender apart scopen. Geen accountconnector als MVP-afhankelijkheid.

**Testscenario:** Afspraak met/zonder locatie, zomertijdgrens, eind vóór start, organisatie met meerdere vestigingen en latere adreswijziging.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I13/I17/I10.

### I20 — [P2][Functionaliteit][Objecten] Leg voorwerpen eenvoudig vast en bereik ze vanuit hun context

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Middelhoge waarde, risico M.

**Huidige situatie:** Regulier geen objectbeheer; testrij heeft alleen generieke velden.

**Gewenste werking:** Voorwerp met naam en optionele type-/locatie-/persoon-/codekoppeling vastleggen zonder duplicatie.

**Bron:** Sharon visie/skelet [R13], Flowcode dragerprincipe [R19].

**Acceptatiecriteria:**

- [ ] Naam volstaat; object zonder locatie kan bestaan.
- [ ] Locatie/persoon/code later koppelen met dezelfde ID.
- [ ] Andere module opent hetzelfde objectboard.
- [ ] Archive/restore bewaart relaties; verwijderen volgens lifecycle.

**Technische aandachtspunten:** Objectadapter; geen complete inventaris-/onderhoudssoftware als eerste increment.

**Testscenario:** Los object→persoon→locatie→code→andere module→archive/restore; idempotente import.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I08/I10/I14; I21 voor code-ingang.

### I21 — [P2][Functionaliteit][Codes] Resolve gescande codes naar bestaande objecten met expliciete acties

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge verbindingswaarde; risico M op trust boundary.

**Huidige situatie:** Codes is placeholder; Kaarten heeft eigen scanner/payloads. Geen algemene veilige objectrouter.

**Gewenste werking:** Gedeelde resolver herkent formaat en opent bestaand object; module bepaalt presentatie/handelingen.

**Bron:** Sharon CardCodes/CardPayload [R08], Log bare-id-router/log-code [R21], Flowcode [R19].

**Acceptatiecriteria:**

- [ ] QR/barcode, Sharon-ID/payload en onbekende invoer krijgen duidelijke uitkomst.
- [ ] Exact object geopend zonder automatisch duplicaat; ontbrekend object wordt niet verzonnen.
- [ ] Schemaversie, lengte en onveilige URL’s/commando’s gevalideerd.
- [ ] Scannen voert geen opdracht, share of publicatie stilzwijgend uit.
- [ ] Camera stopt bij sluiten/background; foto en handmatig invoeren blijven alternatief.

**Technische aandachtspunten:** Parse/validate/resolve gescheiden; scanner technisch hergebruiken, Kaarten-eigen pasregels blijven lokaal. Flowcode optioneel later.

**Testscenario:** Bekende ID, onbekende ID, oversize payload, script-URL, offline, denied camera, foto en echte QR/barcode op iPhone/Android.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I09/I10/I20.

### I22 — [P2][Functionaliteit][Tijd] Bouw tijdregistratie op de nieuwe kern met Log-gedrag

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge dagelijkse waarde; risico M/L tijdconsistentie.

**Huidige situatie:** Regulier placeholder; proef tasks heeft geen tijdmetingen. Log heeft geteste timer-/herstelcases.

**Gewenste werking:** Timer/handmatige registratie kan zelfstandig starten, later aan actie/thema/context koppelen en correct hervatten.

**Bron:** Log time/app.js, filtermodel, assembled en energy-activity [R18/R22]; Sharon [R06].

**Acceptatiecriteria:**

- [ ] Start/stop, handmatig corrigeren en dag-/weekoverzicht werken.
- [ ] App verbergen verbruikt geen renderlus; elapsed tijd correct na resume.
- [ ] Actie/thema optioneel; latere relatie maakt geen dubbele registratie.
- [ ] Boeking exporteerbaar/herstelbaar; meerdere actieve timers expliciet beleid.

**Technische aandachtspunten:** Nieuwe tijdboeking als object; geen window-globals overnemen. Eventgestuurde updates; modulespecifiek timerbeleid.

**Testscenario:** Start→hidden→resume→stop, klokcorrectie, crash/heropen, overlap, handmatige invoer en back-up.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I17/I04/I05/I10.

### I23 — [P2][Functionaliteit][Ritten] Registreer ritten met standaardvoertuig en vaste historische koppeling

**Epic:** Persoonlijke modules. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Zeer hoge bestaande gebruikerswaarde; risico L administratieve historie.

**Huidige situatie:** Geen reguliere ritfunctie; Log heeft vertrek/aankomst, actieve auto, kilometerketen en hervatten van trackpunten.

**Gewenste werking:** Standaardvoertuig wordt als ritvoorstel overgenomen; iedere rit behoudt eigen gekozen voertuig en standen.

**Bron:** Log vehicle-*, index, GPS-resume [R18/R22]; Sharon LocationService [R11].

**Acceptatiecriteria:**

- [ ] Nieuwe rit neemt modulenorm over; één rit afwijken verandert standaard niet.
- [ ] Wijzigen standaard verandert historische voertuig-ID’s niet.
- [ ] Eindstand−startstand is gereden afstand; voorstel is herkenbaar schatting.
- [ ] Via/tank/privédeel wijzigen de A→B-keten niet onbedoeld.
- [ ] Spaarzame trackpunten horen na resume bij dezelfde rit; achtergrondbeperking eerlijk getoond.

**Technische aandachtspunten:** Voertuigtype in Objecten; ritdomeinadapter, centrale GPS; legacy import apart via I32/migratie-increment. Geen gegarandeerde iOS-achtergrondmeting beloven.

**Testscenario:** Twee auto’s, voorkeurwissel, één afwijkende rit, resume/crash, onmogelijke stand, omweg en export/restore.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I04/I05/I10/I16/I20.

### I24 — [P2][Architectuur][Context] Rangschik echte context met expliciete keuzes als hoogste bewijs

**Epic:** Contextmotor. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Kern van assistentvisie; risico M/L verkeerde suggesties.

**Huidige situatie:** ContextSuggestions werkt op proefdataset en moduleparen; actuele locatie/tijd/agenda/ritproviders en tie-contract ontbreken.

**Gewenste werking:** Deterministische moduleproviders leveren kandidaten; arbiter toont één beste of meerdere gelijkwaardige voorstellen met verklaring.

**Bron:** Sharon ContextSuggestions [R14], oorspronkelijke visie; Log tijd-/routevoorstellen [R18].

**Acceptatiecriteria:**

- [ ] Expliciete board-/persoon-/ritcontext kan niet door optelsom van afgeleide signalen worden verdrongen.
- [ ] Actieve module, startstrook, locatieaccuracy, tijd/dag, agenda en relaties hebben traceerbare providers.
- [ ] Geen voorstel bij onvoldoende bewijs; meerdere equivalente pasjes mogelijk.
- [ ] Afwijzen of tonen slaat geen relatie op; acceptatie vraagt betekenisvolle handeling.
- [ ] Geen AI of netwerk voor lokale beslisregels.

**Technische aandachtspunten:** ContextEnvelope met herkomst/actualiteit, policy per module, regelprioriteit vóór numerieke score; pure functies testbaar.

**Testscenario:** Expliciete reiziger vs GPS, stale positie, winkelcentrum met vijf passen, meerdere vestigingen, ontbrekende permissie en gelijkspel.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I10/I13/I17; providers voor I19/I23 aansluiten zodra beschikbaar.

### I25 — [P2][Functionaliteit][Context] Leer lokaal van voorstellen met beperkte en wisbare feedback

**Epic:** Contextmotor. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge rust/voorspelbaarheid; risico M privacy en feedbacklussen.

**Huidige situatie:** Geen algemene accept/dismissfeedback; Wikipedia-feedback is brongebonden en #58 gaat over latere informatieaanbevelingen.

**Gewenste werking:** Eenvoudige deterministische tellers en cooldowns verbeteren voorstellen zonder onnodige locatiegeschiedenis.

**Bron:** Sharon [R14/R15], bestaande #58 grensafbakening.

**Acceptatiecriteria:**

- [ ] Accepteren/afwijzen telt lokaal per relevante regel/context met vervaltermijn.
- [ ] Eén afwijzing verandert niet stilzwijgend andere organisaties of plekken.
- [ ] Cooldown voorkomt herhaald terugkomen tijdens hetzelfde bezoek.
- [ ] Uitleg, uitschakelen en wissen beschikbaar.
- [ ] Geen precieze GPS-historie of extern profiel nodig.

**Technische aandachtspunten:** Beperk opslag tot noodzakelijk contexttoken/telling/tijdvak; namespace en exportbeleid; geen aanbevelingen-issue #58 dupliceren.

**Testscenario:** Zelfde bezoek, later bezoek, reset, expired feedback, andere vestiging, offline en test/live-isolatie.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I24/I06/I05.

### I26 — [P2][Architectuur][Externe boards] Scheid broninhoud, persoonlijke annotaties en modulehandelingen

**Epic:** Externe informatie en organisaties. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge oorspronkelijke productwaarde; risico L bronrechten/updates.

**Huidige situatie:** Wikipedia heeft eigen viewer/feedback; privé-URL is een link; geen algemeen bronboard- en vrijwillig volgen-contract.

**Gewenste werking:** Externe boards behouden bron/eigendom, lokale annotaties blijven persoonlijk en actieve module bepaalt passief of interactief gebruik.

**Bron:** Sharon [R15/R12], Nesdeck hosted-sources [R23], oorspronkelijke Sharon-visie.

**Acceptatiecriteria:**

- [ ] Bron-ID, versie, licentie/toegestane scopes en cachebeleid expliciet.
- [ ] Volgen/stoppen is vrijwillig; geen ongevraagde aanbiedingen.
- [ ] Annotaties verdwijnen niet bij bronupdate en veranderen bron niet.
- [ ] Board kan informatie en toegestane acties tonen via moduleadapter.
- [ ] Offline/foutbron blokkeert eigen persoonlijke gegevens niet.

**Technische aandachtspunten:** SourceAdapter, BoardAdapter, lokale subscriptions; geen scraping/publicatie zonder rechten. #57 verzorgt publicatiecontrole, geen dubbel issue.

**Testscenario:** Read-only bron, bronupdate, verwijderde bron, annotatiebehoud, stop volgen, modules met andere capabilities en offline.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I14/I10; #57 voor publicatie, I27 voor sync.

### I27 — [P2][Architectuur][Delen] Ontwerp rechten, synchronisatie en conflicten vóór gedeelde mutaties

**Epic:** Samenwerking en gedeelde boards. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Noodzakelijk voor betrouwbare samenwerking; risico L.

**Huidige situatie:** Geen generieke Sharing/Sync-service; clientpolicies en random IDs zijn geen serverautorisatie.

**Gewenste werking:** Gedeelde objecten werken met expliciete deelnemers, rollen, versies, intrekking en local-first synchronisatie.

**Bron:** Sharon visie [R01], Log sharing/collaboration-v2/shared-diff-rights [R21], Nesdeck platformroadmap [R23].

**Acceptatiecriteria:**

- [ ] Persoonlijk/gedeeld/extern hebben afzonderlijk eigenaarschap en capabilitybeleid.
- [ ] Server controleert identiteit/rechten bij iedere mutatie; ID alleen geeft geen toegang.
- [ ] Offline outbox is idempotent en conflicten hebben zichtbaar beleid.
- [ ] Intrekken, verwijderen en kopierechten hebben vastgelegd gedrag.
- [ ] Geen automatische upload van hele lokale dataset.

**Technische aandachtspunten:** Contract en dreigingsmodel eerst; prototype met nepserver vóór echte migratie. Payloadminimisatie, revisies, aliasmapping, secrets niet in repository.

**Testscenario:** Twee gebruikers tegelijk/offline, dubbele verzending, onbevoegde mutatie, ingetrokken toegang, bronversieconflict en lekvrije export.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I04/I05/I08/I10; scheiding I26.

### I28 — [P2][Functionaliteit][Samenwerking] Ondersteun gedeelde acties en afspraken met aantoonbare rechten

**Epic:** Samenwerking en gedeelde boards. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge strategische waarde; risico L samenwerking.

**Huidige situatie:** Regulier ontbreekt; Log bevat meerdere samenwerkingslagen met gemengde tests. Nesdeck heeft geen aangetoonde actieve backendketen.

**Gewenste werking:** Deelnemers kunnen afspraken/acties delen, accepteren en bijwerken binnen rechten, met eigen gegevenscontrole.

**Bron:** Oorspronkelijke Sharon-visie, Log [R21/R22], Nesdeck concept [R23].

**Acceptatiecriteria:**

- [ ] Uitnodiging en deelname zijn bewuste keuzes.
- [ ] Rol bepaalt bekijken/bijwerken; actiehistorie en herkomst zichtbaar waar nodig.
- [ ] Afspraak en gerelateerde actie behouden eigen IDs.
- [ ] Offline wijziging en intrekken geven voorspelbaar herstel/conflict.
- [ ] Geen chat of automatische berichten als verborgen afhankelijkheid.

**Technische aandachtspunten:** Bouw boven I27; geen oude Log servercontracten blind overnemen. Start met één gedeelde actie en twee deelnemers.

**Testscenario:** Twee apparaten: uitnodigen→accepteren→offline update→conflict→intrekken; derde gebruiker geweigerd.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I17/I19/I27.

### I29 — [P3][Technische schuld][Performance] Begrens broncaches en meet opslag, rendering en energie

**Epic:** Betrouwbare technische basis. **Classificatie:** Technische schuld. **Status:** Te beoordelen.

**Beschrijving / waarom:** Optimalisatie na betrouwbaarheid; risico M.

**Huidige situatie:** getAll-scans en sessiebrede knownFeatures kunnen groeien; GPS/puls/DOMgedrag niet op fysieke telefoon geprofiled.

**Gewenste werking:** Realistische datasets blijven soepel met begrensde caches, gerichte queries en zichtbaarheid-/bewegingsbeleid.

**Bron:** Sharon [R10/R15], Log energychecks [R22]; D6.

**Acceptatiecriteria:**

- [ ] Baseline met datasetomvang, requests, frame-/heapindicatoren en toestel vastgelegd.
- [ ] Wikipedia-sessiecache heeft limiet/evictie zonder feedbackverlies.
- [ ] Animaties/puls pauzeren hidden en respecteren minder beweging.
- [ ] Optimalisatie voorkomt duplicaat mapworkers/listeners en onnodige full scans.

**Technische aandachtspunten:** ObjectStore type/indexquery’s, WikipediaLayer, lazy imports; alleen aangetoonde bottlenecks optimaliseren. Boardcachelimiet zes behouden.

**Testscenario:** Lang pannen, 10.000 objecten/relaties als benchmarkfixture, twintig modulewissels, background/resume en batterijprofiel op toestel.

**Prioriteit en complexiteit:** P3 / M. **Afhankelijkheden:** I11/I14; broncache kan eerder.

### I30 — [P3][Toekomstige uitbreiding][Organisaties] Beproef vrijwillige bedrijfsboards en het verdienmodel

**Epic:** Publiceren en verdienmodel. **Classificatie:** Toekomstige uitbreiding. **Status:** Te beoordelen.

**Beschrijving / waarom:** Strategische kans, onzeker nut; risico M.

**Huidige situatie:** Visie beschreven; werkende organisatievolg-/commerciële keten niet aangetoond.

**Gewenste werking:** Kleine productproef waarin gebruiker vrijwillig een organisatie volgt en relevante informatie krijgt met transparante commerciële herkomst.

**Bron:** Oorspronkelijke Sharon-visie, #52 marketingrichting, Nesdeck concept [R23].

**Acceptatiecriteria:**

- [ ] Gebruiker kiest volgen en kan direct stoppen.
- [ ] Commerciële inhoud herkenbaar; neutrale locatie-/kaartfuncties blijven zelfstandig.
- [ ] Geen persoonlijke pascode/GPS naar organisatie voor alleen bekijken.
- [ ] Waardeproef, succesmaat en prijs-/servicehypothese vooraf vastgesteld.
- [ ] Publiceren en hergebruik alleen volgens #57-rechten.

**Technische aandachtspunten:** Geen betaalinfrastructuur in eerste proef; publieke bedrijfsbron naast privécontext. Verdienmodel pas na gebruikersvalidatie.

**Testscenario:** Opt-in→relevante context→uitleg→stop volgen; geen aanbod buiten interesse; offline en ingetrokken bron.

**Prioriteit en complexiteit:** P3 / M. **Afhankelijkheden:** I26/I27/#57; geen blocker voor dagelijkse modules.

### I31 — [P3][Historisch concept][Codes] Evalueer Flowcode als aanvullende informatiedrager

**Epic:** Publiceren en verdienmodel. **Classificatie:** Historisch concept. **Status:** Te beoordelen.

**Beschrijving / waarom:** Experimentele waarde, geen technische noodzaak; risico M.

**Huidige situatie:** Flowcode encode-interface bestaat; transportbestendigheid en veiligheid zijn niet gevalideerd.

**Gewenste werking:** Een afgebakende technische proef bepaalt of pixelpayloads een nuttige extra drager zijn, met behoud van centrale object-ID.

**Bron:** Flowcode [R19], Sharon CardPayload/Codes [R08].

**Acceptatiecriteria:**

- [ ] Formaat, header, versie en integriteitscontrole beschreven.
- [ ] Tekst→PNG→decode roundtrip met Unicode en grenslengtes getest.
- [ ] Pixelwijziging/compressie geeft betrouwbare fout, geen schijnbaar geldig object.
- [ ] Geen claims dat sleutelruimte op zichzelf veilige encryptie bewijst.
- [ ] Alleen achter generieke resolver; QR/barcode blijft beschikbaar.

**Technische aandachtspunten:** Isolatie als optionele adapter; geen zelfontworpen encryptie in productkern. Securityreview apart indien ooit vertrouwelijke data.

**Testscenario:** Exact PNG, herschalen, JPEG, bitflip, ontbrekende key, oversize en kruiscompatibele decoder.

**Prioriteit en complexiteit:** P3 / M. **Afhankelijkheden:** I21; productbesluit vóór integratie.

### I32 — [P2][Functionaliteit][Migratie] Importeer waardevolle Log-data via een herhaalbare adapter

**Epic:** Gegevens en relaties. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge hergebruikswaarde; risico L migratie.

**Huidige situatie:** MIGRATION.md beschrijft volgorde maar volledige Log→Sharon-migratielaag ontbreekt; kaartgedragoverdracht is geen complete data-import.

**Gewenste werking:** Gebruiker importeert Log-export met preview en behoud van historie/identiteit zonder dubbele invoer.

**Bron:** Sharon MIGRATION.md [R01], Log log-json-v2/backup-state [R20].

**Acceptatiecriteria:**

- [ ] Ondersteunde exportversies expliciet; onbekende versie veilig geweigerd.
- [ ] Locaties, thema’s, kaarten, tijd, ritten/voertuigen en relaties gefaseerd ondersteund.
- [ ] Legacy-ID mapping stabiel en tweemaal importeren idempotent.
- [ ] Historische ritstanden/voertuigen/trackpunten blijven intact.
- [ ] Bronbestand en bestaande Sharon-data blijven bij fout herstelbaar.

**Technische aandachtspunten:** Alleen adapter kent oude storagekeys; per objecttype pas vrijgeven wanneer doelmodule klaar is. Gebruik Log-exports als fixtures, geen repo-storage rechtstreeks kopiëren.

**Testscenario:** Leeg/vol profiel, oude en huidige export, duplicate IDs, deelimport, unsupported module en export→import→restore-vergelijking.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I05/I08/I09 plus doelmodules I13/I17/I22/I23.

### I33 — [P2][Bug][Kaarten] Rond opslaan af en voorkom herhaalde creatie vanuit hetzelfde formulier

**Epic:** Persoonlijke modules. **Classificatie:** Bug. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge eenvoudige UX-/datakwaliteitswaarde; risico S.

**Huidige situatie:** Live gereproduceerd: kaart met alleen naam opslaan opent board boven het aanmaakformulier. Na sluiten blijft Nieuwe kaart en dezelfde invoer staan; opnieuw opslaan maakt een tweede ID.

**Gewenste werking:** Een succesvolle aanmaak beëindigt het formulier of gaat over naar bewerken van het zojuist gemaakte object; dezelfde bevestiging maakt geen onbedoeld duplicaat.

**Bron:** Sharon CardsView.js [R08]; live auditfixture Auditpas zonder code, twee verschillende 12-teken-IDs; F13.

**Acceptatiecriteria:**

- [ ] Opslaan met alleen naam blijft toegestaan.
- [ ] Na succes klopt moduletitel en de terugroute eindigt in vernieuwde lijst of bestaand object.
- [ ] Tweemaal bevestigen/dubbeltik levert één aanmaak op.
- [ ] Netwerk-/storagefout laat invoer behouden en laat opnieuw proberen toe.
- [ ] Bewust twee kaarten met dezelfde naam blijft mogelijk via een nieuwe aanmaakhandeling.

**Technische aandachtspunten:** showForm-submit, showDetail en onClose in CardsView; saving-guard en objectidentiteit na succes. Geen globale deduplicatie op naam invoeren.

**Testscenario:** Naam-only→opslaan→board sluiten→nogmaals bevestigen; dubbelklikken tijdens save; opslagfout→retry; nieuwe expliciete kaart met zelfde naam.

**Prioriteit en complexiteit:** P2 / S. **Afhankelijkheden:** Geen voor directe fix; I14 navigatiecontract afstemmen.

### E52 — [P2][Architectuur][Kaartbasis] Actualiseer #52 als overkoepelende kaart- en pasjesroadmap

**Epic:** Externe informatie en organisaties. **Classificatie:** Architectuur. **Status:** Te beoordelen.

**Beschrijving / waarom:** Minder dubbel werk; risico S.

**Huidige situatie:** #52 noemt deels gerealiseerde viewer/index en herkenningskeuzes die door #59 zijn vervangen.

**Gewenste werking:** Bestaand issue blijft scopehouder; gerealiseerd en resterend werk gescheiden met actuele afhankelijkheden.

**Bron:** Bestaand Sharon #52; SharonMapRuntime/GeographicBranchIndex [R16].

**Acceptatiecriteria:**

- [ ] Viewer en pure index als bestaand gemarkeerd.
- [ ] #59 expliciet leidend voor herkenning/zones/delta.
- [ ] Geen tweede kaartimplementatie of dubbele issueketen.
- [ ] Resterende stappen en tests gelinkt aan I13/I16/I24 en #59.

**Technische aandachtspunten:** Hergebruiken/aanvullen van bestaand issue; geen nieuw issue.

**Testscenario:** Documentcontrole plus runtime/index-regressies; productieketen via #59.

**Prioriteit en complexiteit:** P2 / S. **Afhankelijkheden:** I12/I16/#59.

### E53 — [P2][Test][Omgeving] Valideer #53 en begrens de resterende Wikipedia-indexscope

**Epic:** Externe informatie en organisaties. **Classificatie:** Test. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge bronbetrouwbaarheid; risico M.

**Huidige situatie:** #53 zegt niet geïmplementeerd, maar laag/filters/boards bestaan. Lokale compacte Q-index en volledig gebiedscontract niet klaar.

**Gewenste werking:** Bestaand issue beschrijft aantoonbaar gerealiseerde onderdelen en concrete resterende schaal-/netwerk-/offline-eisen.

**Bron:** Bestaand Sharon #53, WikipediaLayer/BoardViewer [R15].

**Acceptatiecriteria:**

- [ ] Aan/uit, zoom<11, debounce, abort, lege/offlinetoestand gevalideerd.
- [ ] Verschil tussen huidige 10km-centerquery en werkelijk zichtbaar gebied gedocumenteerd.
- [ ] Lokale Q-index alleen implementeren als afgesproken vervolgscope, met bron/provenance.
- [ ] Geen Wikipediarequests wanneer uit; groei in lange sessie begrensd.

**Technische aandachtspunten:** Geen dubbele laag bouwen; I29 cachebeleid.

**Testscenario:** Echte browser map-pan/zoom/offline en requestteller; grenscel/Q-ID-deduplicatie in pure fixtures.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I02/I11/I29.

### E54 — [P2][UX][Boards] Rond #54 af binnen het gedeelde gebarencontract

**Epic:** Consistente gebruikersinterface. **Classificatie:** UX-verbetering. **Status:** Te beoordelen.

**Beschrijving / waarom:** Middel gebruikswaarde; risico M gestureconflict.

**Huidige situatie:** Layout-/hoogtecode bestaat; vrij boardpositioneren en conflictsituaties zijn niet volledig uitgevoerd.

**Gewenste werking:** Bestaand issue krijgt één helder onderscheid tussen boardpositie, inhoudscroll, hoogtegrepen en sluiten.

**Bron:** Bestaand #54; BoardViewer [R15].

**Acceptatiecriteria:**

- [ ] Volledig boarddraggen op grip, geen drag bij gewone tekstscroll.
- [ ] Mobiel/desktop-scope exact gekozen.
- [ ] Sluiten/back/hoogte en positieherstel werken samen.
- [ ] Minder beweging en toetsenbordalternatief.

**Technische aandachtspunten:** I14/I15 eerst; geen aparte gesture-engine per board.

**Testscenario:** iPhone scroll/drag/close/interrupted swipe; desktop resize en heropen.

**Prioriteit en complexiteit:** P2 / M. **Afhankelijkheden:** I14/I15/I11.

### E55 — [P2][Test][Boards] Bewijs en rond #55 prefetch en kompasbehoud af

**Epic:** Consistente gebruikersinterface. **Classificatie:** Test. **Status:** Te beoordelen.

**Beschrijving / waarom:** Gericht afronden; risico S/M.

**Huidige situatie:** Prefetch, zes-items-cache en sessiekompas zijn al in broncode aanwezig; praktijk/lifecyclevalidatie ontbreekt.

**Gewenste werking:** Bestaand issue afronden op gedrag, zonder opnieuw implementeren.

**Bron:** Bestaand #55; preloadWikipediaBoard/boardCompassEnabled [R15].

**Acceptatiecriteria:**

- [ ] Vorige/volgende laden maximaal één gedeelde fetch per item.
- [ ] Cachelimiet en late resolutie na close getest.
- [ ] Kompas blijft binnen sessie aan bij boardwissel; weigering/intrekking correct.
- [ ] Geen extra MapLibre-instantie per bronboard.

**Technische aandachtspunten:** Cachekey/cleanup behouden; sensorpermissie alleen op passende handeling.

**Testscenario:** Snelle reeks next/back/close, offline, late fetch en echte iPhone sensortoestemming.

**Prioriteit en complexiteit:** P2 / S. **Afhankelijkheden:** I11/I14.

### E56 — [P2][Test][Locaties] Werk #56 bij voor bestaande privéwebbronnen en hersteltesten

**Epic:** Persoonlijke modules. **Classificatie:** Test. **Status:** Te beoordelen.

**Beschrijving / waarom:** Bestaande waarde behouden; risico S.

**Huidige situatie:** URL-normalisatie/opslag/weergave bestaan al; UUID en mergeondersteuning wijken af.

**Gewenste werking:** Issue aanvullen met gecontroleerde bestaande scope en resterende integriteit; na tests afronden.

**Bron:** Bestaand #56; LocationWebSources [R12].

**Acceptatiecriteria:**

- [ ] Veilige HTTPS-link koppelen/bewerken-verwijderen; standaard privé.
- [ ] Geen externe scraping of publicatie door koppelen alleen.
- [ ] Relatie-ID voldoet aan gekozen contract; locatie-ID blijft gelijk.
- [ ] Merge, restore en deduplicatie behouden bronnen.

**Technische aandachtspunten:** I03/I09 bevatten kernfixes; #56 bevat end-to-end acceptatie, geen dubbele implementatietaak.

**Testscenario:** URL met credentials/schemafout, duplicate, verwijderen, merge en export/herstel.

**Prioriteit en complexiteit:** P2 / S. **Afhankelijkheden:** I03/I05/I09.

### E57 — [P2][Functionaliteit][Publiceren] Behoud #57 voor bronrechten en intrekking

**Epic:** Publiceren en verdienmodel. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Noodzakelijk vóór publicatie; risico L.

**Huidige situatie:** Ontwerp bestaat; geen aangetoonde volledige publicatie-/verificatieketen.

**Gewenste werking:** Bestaand issue implementeert expliciete publicatie met brongebonden scope, verificatie en intrekking.

**Bron:** Bestaand #57 en BOARDS_WEBBRONNEN_SHARON_BUTTON.md [R24].

**Acceptatiecriteria:**

- [ ] Onbekende rechten leveren hoogstens een link.
- [ ] Domeinchallenge bewijst beheer, geen automatische auteursrechten.
- [ ] Toestemming per bron/inhoudsoort, verval en voorwaarden bewaard.
- [ ] Intrekking blokkeert nieuw delen en heeft zichtbaar cache-/copiebeleid.
- [ ] Auditspoor zonder onnodige persoonsgegevens.

**Technische aandachtspunten:** SourceAdapter en servervalidatie; niet buiten userkeuze publiceren.

**Testscenario:** Valse token, andere pagina, verlopen toestemming, ingetrokken beeldrecht en offline oude cache.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I26/I27.

### E58 — [P3][Toekomstige uitbreiding][Context] Behoud #58 voor transparante bronaanbevelingen

**Epic:** Contextmotor. **Classificatie:** Toekomstige uitbreiding. **Status:** Te beoordelen.

**Beschrijving / waarom:** Onzeker nut vóór gebruiksdata; risico M.

**Huidige situatie:** Lokale boardfeedback bestaat; algemene aanbevelingsfunctie is toekomstidee.

**Gewenste werking:** Bestaand issue blijft later experiment, onderscheiden van directe contextactievoorstellen.

**Bron:** Bestaand #58; Wikipedia-feedback [R15].

**Acceptatiecriteria:**

- [ ] Geen aanbevelingen zonder gekozen personalisatie.
- [ ] Herkomst/uitleg en uitzetten/wissen.
- [ ] Ongelezen is ontdekstatus, geen afkeur/interessebewijs.
- [ ] Brongebonden categorieën houden eigen betekenis.
- [ ] Lokale minimale signalen; geen onnodige GPS-historie.

**Technische aandachtspunten:** Gebruik gedeelde feedbackvoorziening waar zinvol, geen duplicaat van I25.

**Testscenario:** Filter/feedback/reset, nieuwe onderwerpen, bronwissel en neutraliteit bij koude start.

**Prioriteit en complexiteit:** P3 / M. **Afhankelijkheden:** I25/I26.

### E59 — [P2][Functionaliteit][Kaarten] Voer #59 lokale pasherkenning en persoonlijke zones uit

**Epic:** Externe informatie en organisaties. **Classificatie:** Functionaliteit. **Status:** Te beoordelen.

**Beschrijving / waarom:** Hoge zichtbare assistentwaarde; risico L data/sync.

**Huidige situatie:** Pure GeographicBranchIndex is aanwezig; ketenregister, synchronisatie, persoonlijke zones en automatische paspresentatie niet als productieketen.

**Gewenste werking:** Bestaand issue realiseren met lokale herkenning voor relevante ketens en eigen zone per vestiging.

**Bron:** Bestaand #59, #52; GeographicBranchIndex [R16].

**Acceptatiecriteria:**

- [ ] Openen/GPS met twintig passen doet nul herkenningsnetwerkverzoeken.
- [ ] Meerdere passende passen compact beschikbaar; gekozen vestiging ondubbelzinnig.
- [ ] Slider loslaten bewaart persoonlijke zone; die onderdrukt grove match voor die vestiging.
- [ ] Maandelijkse bundelcheck/delta; lastCheckedAt pas na succes, netwerkfout behoudt data.
- [ ] Sync verstuurt geen GPS/pascode/persoonlijke zone; centrale wijzigingen overschrijven die niet.

**Technische aandachtspunten:** Organisatie≠vestiging≠kaart≠persoonlijke zone; gedeelde runtime/GPS. Groot issue vóór uitvoering in increments binnen dezelfde scope opdelen.

**Testscenario:** Offline onbekende stad, celgrenzen, twee vestigingen in één vak, GPS-onzekerheid, vijf passen, mislukte delta en zone override.

**Prioriteit en complexiteit:** P2 / L. **Afhankelijkheden:** I13/I16/I24/I26; I02 offlinebasis.

### E60 — [P3][Toekomstige uitbreiding][Locaties] Behoud #60 voor vrijwillige bronbijdragen

**Epic:** Externe informatie en organisaties. **Classificatie:** Toekomstige uitbreiding. **Status:** Te beoordelen.

**Beschrijving / waarom:** Toekomstwaarde; risico L misbruik/provenance.

**Huidige situatie:** Ontwerpnotitie, geen implementatie; persoonlijke zone is nog geen publieke bijdrage.

**Gewenste werking:** Bestaand issue blijft opt-in registervoorstel met provenance en onafhankelijke verificatie.

**Bron:** Bestaand #60; #59 en oorspronkelijke visie.

**Acceptatiecriteria:**

- [ ] Expliciete preview van uitsluitend gedeelde vestigingswaarneming.
- [ ] Geen pascode, persoonlijke straal of locatiegeschiedenis mee.
- [ ] Zelfde bron telt niet als onafhankelijke bevestiging.
- [ ] Twijfel blijft kandidaat, persoonlijke data van anderen onveranderd.
- [ ] Correctie/intrekking en bron-/licentievoorwaarden vastgelegd.

**Technische aandachtspunten:** Publicatierechten via #57; apart van persoonlijke herkenning en relevante-keten-deltas.

**Testscenario:** Dubbele bijdrage, valse positie, twee nabije vestigingen, intrekken en geen override op persoonlijke zone.

**Prioriteit en complexiteit:** P3 / L. **Afhankelijkheden:** E59/I26/I27/#57.

## F3. Beoordelingsbesluiten

Voor uitvoering moeten vier concrete keuzes worden vastgesteld: (1) het voorgestelde release-/herstelpakket I01–I07 als eerste werk; (2) scope van het productieobject-/relatiecontract I08–I10; (3) welke eerste persoonlijke keten de gebruiker het vaakst nodig heeft, met I17–I19 als inhoudelijk voorstel; (4) welke bestaande issues na bewijs kunnen worden afgerond. Dit rapport autoriseert geen implementatie, publicatie of issuecreatie.

# Bronregister en controleerbaarheid

Repositorylinks gebruiken de onderzochte commits. Externe websites en API-collecties zijn momentopnamen van 18 oktober 2026 en kunnen later veranderen. Samengevoegde verwijzingen zoals R07–R10 verwijzen naar de afzonderlijke regels hieronder.

- **R01:** [Sharon snapshot, architectuur en migratie](https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3).
- **R02:** [Pages-publicatie op peil-SHA, success](https://github.com/Stefan-van-Dijk/sharon/actions/runs/39153152606).
- **R03:** [Sharon controles op peil-SHA, cancelled](https://github.com/Stefan-van-Dijk/sharon/actions/runs/39153152526).
- **R04:** [CI-workflow en controleopdrachten](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/.github/workflows/sharon-checks.yml).
- **R05:** [GitHub branchcollectie en repositorymetadata](https://api.github.com/repos/Stefan-van-Dijk/sharon/branches?per_page=100).
- **R06:** [Shell: menu, live/testdispatch en placeholders](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/Shell.js).
- **R07:** [Locaties: formulieren, afhankelijkheden en samenvoegen](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/LocationsView.js).
- **R08:** [Kaarten: objectvorm, scannerroute, opslaan en GPS](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/CardsView.js).
- **R09:** [IdentifierService](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/ids/IdentifierService.js).
- **R10:** [ObjectStore](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/storage/ObjectStore.js).
- **R11:** [Locatie- en instellingenservices](https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core).
- **R12:** [Privéwebbronnen en UUID-relaties](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/LocationWebSources.js).
- **R13:** [Skeletobjecten, levenscyclus en testdataset](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton/SkeletonCore.js).
- **R14:** [GraphService en ContextSuggestions](https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton).
- **R15:** [BoardViewer, CardBoard, WikipediaLayer en swipecomponenten](https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui).
- **R16:** [GeographicBranchIndex](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/GeographicBranchIndex.js).
- **R17:** [Alle huidige Sharon-tests](https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/tests).
- **R18:** [Log snapshot 0.40.11-lijn](https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d).
- **R19:** [Flowcode live publicatie](https://sharon.life/flowcode/).
- **R20:** [Log JSON v2 en herstelcontract](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/docs/log-json-v2.md).
- **R21:** [Log samenwerkings-, identiteit-, verwijder- en deelcode](https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d).
- **R22:** [Log regressie- en geassembleerde tests](https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d/tests).
- **R23:** [Nesdeck live publicatie en publieke decks](https://nesdeck.com/).
- **R24:** [Boards, webbronnen en Sharon Button-ontwerp](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/docs/BOARDS_WEBBRONNEN_SHARON_BUTTON.md).

## Aanvullende precieze bronnen

- [ModuleRegistry](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/modules/ModuleRegistry.js).
- [SettingsView/reset](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/SettingsView.js).
- [SettingsService](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/settings/SettingsService.js).
- [LocationService](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/LocationService.js).
- [LocationTriggerService](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/LocationTriggerService.js).
- [GraphService](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton/GraphService.js).
- [ContextSuggestions](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton/ContextSuggestions.js).
- [SkeletonDemoView](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/SkeletonDemoView.js).
- [SwipeRows](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/SwipeRows.js).
- [CardBoard](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/CardBoard.js).
- [BoardViewer](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/BoardViewer.js).
- [WikipediaLayer](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/WikipediaLayer.js).
- [SharonMapRuntime](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/SharonMapRuntime.js).
- [PWA/serviceworker](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/service-worker.js).
- [Versiecheck](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/scripts/check-version.mjs).
- [Architectuurdocument](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/docs/ARCHITECTURE.md).
- [Migratiedocument](https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/docs/MIGRATION.md).
- [Herstel van de eerdere syntaxfout](https://github.com/Stefan-van-Dijk/sharon/commit/f9b3c81888104fd233d515303ba163b88bf4a154).
- [Log backup-state.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/backup-state.js).
- [Log log-json-v2.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/log-json-v2.js).
- [Log removal-policy.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/removal-policy.js).
- [Log location-actions.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/location-actions.js).
- [Log collaboration-v2.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/collaboration-v2.js).
- [Log shared-diff-rights.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/shared-diff-rights.js).
- [Log contact-import.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/contact-import.js).
- [Log time/app.js](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/time/app.js).
- [Log docs/RELEASE-0.40.4.md](https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/docs/RELEASE-0.40.4.md).
- [Flowcode app.js](https://sharon.life/flowcode/app.js).
- [Nesdeck hosted sources](https://nesdeck.com/nesdeck-hosted-sources.json).
- [Nesdeck platformuitleg](https://nesdeck.com/nesdeck-platform-uitleg.json).
- [Nesdeck database-roadmap](https://nesdeck.com/nesdeck-database-roadmap.json).
- [Nesdeck instellingen](https://nesdeck.com/settings-panel.js).

## Bestaande issues en relevante PR’s

- [Sharon #52](https://github.com/Stefan-van-Dijk/sharon/issues/52).
- [Sharon #53](https://github.com/Stefan-van-Dijk/sharon/issues/53).
- [Sharon #54](https://github.com/Stefan-van-Dijk/sharon/issues/54).
- [Sharon #55](https://github.com/Stefan-van-Dijk/sharon/issues/55).
- [Sharon #56](https://github.com/Stefan-van-Dijk/sharon/issues/56).
- [Sharon #57](https://github.com/Stefan-van-Dijk/sharon/issues/57).
- [Sharon #58](https://github.com/Stefan-van-Dijk/sharon/issues/58).
- [Sharon #59](https://github.com/Stefan-van-Dijk/sharon/issues/59).
- [Sharon #60](https://github.com/Stefan-van-Dijk/sharon/issues/60).
- [Alle Sharon-issues en PR-items, pagina 1](https://api.github.com/repos/Stefan-van-Dijk/sharon/issues?state=all&per_page=100&page=1) en [pagina 2](https://api.github.com/repos/Stefan-van-Dijk/sharon/issues?state=all&per_page=100&page=2).
- [Alle Log-issues en PR-items](https://api.github.com/repos/Stefan-van-Dijk/log/issues?state=all&per_page=100).
- sharon: [PR #39](https://github.com/Stefan-van-Dijk/sharon/pull/39), [PR #50](https://github.com/Stefan-van-Dijk/sharon/pull/50), [PR #51](https://github.com/Stefan-van-Dijk/sharon/pull/51), [PR #61](https://github.com/Stefan-van-Dijk/sharon/pull/61), [PR #68](https://github.com/Stefan-van-Dijk/sharon/pull/68), [PR #69](https://github.com/Stefan-van-Dijk/sharon/pull/69), [PR #71](https://github.com/Stefan-van-Dijk/sharon/pull/71), [PR #74](https://github.com/Stefan-van-Dijk/sharon/pull/74), [PR #80](https://github.com/Stefan-van-Dijk/sharon/pull/80), [PR #84](https://github.com/Stefan-van-Dijk/sharon/pull/84), [PR #85](https://github.com/Stefan-van-Dijk/sharon/pull/85), [PR #91](https://github.com/Stefan-van-Dijk/sharon/pull/91), [PR #92](https://github.com/Stefan-van-Dijk/sharon/pull/92), [PR #94](https://github.com/Stefan-van-Dijk/sharon/pull/94), [PR #95](https://github.com/Stefan-van-Dijk/sharon/pull/95), [PR #96](https://github.com/Stefan-van-Dijk/sharon/pull/96), [PR #97](https://github.com/Stefan-van-Dijk/sharon/pull/97), [PR #98](https://github.com/Stefan-van-Dijk/sharon/pull/98), [PR #99](https://github.com/Stefan-van-Dijk/sharon/pull/99), [PR #100](https://github.com/Stefan-van-Dijk/sharon/pull/100), [PR #101](https://github.com/Stefan-van-Dijk/sharon/pull/101), [PR #102](https://github.com/Stefan-van-Dijk/sharon/pull/102).
- log: [PR #2](https://github.com/Stefan-van-Dijk/log/pull/2), [PR #3](https://github.com/Stefan-van-Dijk/log/pull/3), [PR #4](https://github.com/Stefan-van-Dijk/log/pull/4), [PR #50](https://github.com/Stefan-van-Dijk/log/pull/50), [PR #55](https://github.com/Stefan-van-Dijk/log/pull/55), [PR #72](https://github.com/Stefan-van-Dijk/log/pull/72), [PR #75](https://github.com/Stefan-van-Dijk/log/pull/75), [PR #76](https://github.com/Stefan-van-Dijk/log/pull/76), [PR #79](https://github.com/Stefan-van-Dijk/log/pull/79), [PR #80](https://github.com/Stefan-van-Dijk/log/pull/80).

## Auditproeven: exacte opdrachten en kernuitkomsten

```text
Sharon:
  npm test                       190 pass / 0 fail
  node --check src/**/*.js       alle 62 bronmodules (recursief uitgevoerd) geldig
  node --check service-worker.js geldig
  node scripts/check-imports.mjs alle relatieve modulepaden bestaan
  node scripts/check-version.mjs PWA-versie 0.3.55 in gecontroleerde kernbestanden

Log:
  npm ci --ignore-scripts --no-audit --no-fund
  npm run verify                 geslaagd
  npm run verify:energy          mislukt: energy-connections expected 2, actual 1
  npm run test:legacy             25 pass / 18 fail, 43 regressionbestanden
  node tests/energy-activity-regression.cjs         geslaagd
  node tests/location-action-scheduler-regression.cjs geslaagd
  node tests/energy-location-actions-regression.cjs geslaagd bij afzonderlijke run
```

De extra auditproef laadde ongewijzigde Sharon ES-modules in JSDOM, met een Map-backed clone-store en fictieve ID’s. Geen echte GPS, geen persoonlijke data en geen netwerkmutaties. Kernuitvoer:

```text
merge preview available true
merged location {
  id: 'AuditPlace02',
  type: 'location',
  data: {
    title: 'Vervallen',
    kind: 'other',
    coordinates: null,
    address: {},
    radiusM: 100,
    mergedInto: 'AuditPlace01'
  },
  deletedAt: 1792348572271,
  updatedAt: 1792348572271
}
card reference after merge {
  id: 'AuditCard001',
  type: 'card',
  name: 'Auditpas',
  locationId: 'AuditPlace02'
}
websources retained only at old key {
  key: 'location.webSources.v1:AuditPlace02',
  value: [
    {
      id: 'historical-source',
      locationId: 'AuditPlace02',
      url: 'https://example.org',
      visibility: 'private'
    }
  ]
} undefined
websource id length 36 18e03a31-a2e0-4fb1-b3fc-df597a2faf38
semantic inverse duplicates allowed 2 [ 'bevat', 'bevat' ]
short swipe transform translate3d(0px,0,0)
cancelled swipe transform translate3d(-176px,0,0)
swipe listeners active after release translate3d(-176px,0,0)
standalone action created true relations 0 live unchanged true
person subsequently linked true
```

De UUID in deze uitvoer is fictieve auditdata en uitsluitend bewijs van het afwijkende formaat. De live kaartproef leverde twee verschillende IDs na dezelfde invoer: `LGbisOZF_LC0` en `v0ECcgkL070u`. Beide hebben 12 tekens. Dit toont herhaalde creatie, geen ID-botsing.

## Nog nader onderzoeken vóór productacceptatie

- Fysieke iPhone Safari en geïnstalleerde PWA: full-height/safe areas, toetsenbord, oriëntatie, camera, sensorpermissies, interrupted swipes, update en offline heropenen.
- Android en desktop: back, keyboard/focus, schermgrootte, install/update.
- Opslagfaults: quota, transaction abort na request success, crash in merge/restore en upgrade met twee tabbladen.
- Privacy en samenwerking: echte serverautorisatie, intrekken, conflicten, deelnemeridentiteit en bronpublicatierechten.
- Gedrag/performance: echte lange rit, GPS-verbruik, batterij/temperatuur en heap-/workerprofilering.
- Legacy: oorzaak van iedere relevante Log-testfailure vaststellen vóór technisch hergebruik; volledige reviewdiscussies/PR-diffs alleen waar zij een te porteren contract verduidelijken.

De hoofdbranch is aan het einde van de broncontrole opnieuw opgevraagd en stond nog op `eeee0cdbe20202136d26c7dcf82bcd39c76998b3`. De tracked werkbomen van Sharon en Log waren schoon. Er zijn geen issues, PR’s, releases of projectborden aangemaakt of gewijzigd.

[R01]: https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3
[R02]: https://github.com/Stefan-van-Dijk/sharon/actions/runs/39153152606
[R03]: https://github.com/Stefan-van-Dijk/sharon/actions/runs/39153152526
[R04]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/.github/workflows/sharon-checks.yml
[R05]: https://api.github.com/repos/Stefan-van-Dijk/sharon/branches?per_page=100
[R06]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/Shell.js
[R07]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/LocationsView.js
[R08]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui/CardsView.js
[R09]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/ids/IdentifierService.js
[R10]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/storage/ObjectStore.js
[R11]: https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core
[R12]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/LocationWebSources.js
[R13]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton/SkeletonCore.js
[R14]: https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/skeleton
[R15]: https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/ui
[R16]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/src/core/location/GeographicBranchIndex.js
[R17]: https://github.com/Stefan-van-Dijk/sharon/tree/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/tests
[R18]: https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d
[R19]: https://sharon.life/flowcode/
[R20]: https://github.com/Stefan-van-Dijk/log/blob/a98a4a990f42ac0c867b5cad11bee2b69139337d/docs/log-json-v2.md
[R21]: https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d
[R22]: https://github.com/Stefan-van-Dijk/log/tree/a98a4a990f42ac0c867b5cad11bee2b69139337d/tests
[R23]: https://nesdeck.com/
[R24]: https://github.com/Stefan-van-Dijk/sharon/blob/eeee0cdbe20202136d26c7dcf82bcd39c76998b3/docs/BOARDS_WEBBRONNEN_SHARON_BUTTON.md
