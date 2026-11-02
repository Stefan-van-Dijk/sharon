# Releasecontrole en testdekking — voorstel bij #103 en #104

## Wat verandert

Er verandert geen applicatiecode of gebruikersgegevens. De app blijft v0.3.55.
De kwaliteitsketen gebruikt lokaal en in Actions Node **24.19.0** (`.nvmrc`),
`npm ci` en dezelfde opdracht `npm run verify`. De lockfile legt de testdependencies vast.
De VM-module-API van Node is experimenteel; de expliciete runtimepin maakt wijzigingen zichtbaar.

De keten controleert syntaxis (ook SkeletonDemoView, scripts en tests), bestaande
tests, relatieve imports, de bestaande kernversiecontrole, publicatie-assets,
DOM-opstart en gebruikersketens, en SHA-256-hashes van het geteste pakket.
De versiecontrole controleert nog niet alle queryversies: dat blijft #105.
Alleen src, assets, vendor, de HTML, manifest en serviceworker worden verpakt;
documentatie, tests en serverbestanden worden niet naar Pages gestuurd.
`release.json` vermeldt commit-SHA, appversie, Node-versie en bestandshashes.
Bij lokale niet-gecommitteerde wijzigingen is SHA alleen de basiscommit; lokale
hashes identificeren de werkelijke inhoud. CI test altijd een schone checkout.

De deployjob heeft `needs: controle` en publiceert uitsluitend het geüploade
pakket uit dezelfde run. Geen nieuwe checkout of rebuild tijdens deployment.
Een geannuleerde/mislukte controle levert geen deployment op. Concurrency annuleert
verouderde runs; direct voor deployment wordt de actuele main-SHA vergeleken.
Een handmatig gestarte run op een andere branch kan niet publiceren.
Geen padfilters: een vereiste controle blijft ook bij documentatiewijzigingen lopen.
De controlelog en release-manifest worden als afzonderlijk Actions-artifact bewaard.

## Activeren na beoordeling, zonder de bestaande website voortijdig te vervangen

Op 18 oktober 2026 gecontroleerd: Pages gebruikt nog **Deploy from a branch → main → /(root)**.
Zolang dat zo blijft, is de oude publicatieroute een bypass van deze poort.
Deze PR activeert daarom nog geen sluitende bescherming op de liveomgeving.

1. Laat de PR-check `Sharon releasecontrole` slagen. Bekijk log en artifact.
2. Stel onder Settings → Branches/Rulesets voor main een PR-plicht en de vereiste
   check `Sharon releasecontrole` in. Kies actuele-branchcontrole, blokkeer force-push
   en verwijdering; beoordeel expliciet eventuele beheerdersbypass. Selecteer de
   daadwerkelijk door GitHub getoonde checknaam. Deze instellingen staan buiten git.
3. Controleer dat omgeving `github-pages` alleen main accepteert. Voeg indien gewenst
   een beschikbare reviewerregel toe. Bewaar hersteloptie en de vorige deployment.
4. Zet Pages **vóór de merge** op Source → **GitHub Actions**. De bestaande site kan
   blijven staan; de oude branch-publicatie wordt niet meer voor nieuwe commits gebruikt.
5. Merge de goedgekeurde PR. Dit is de expliciete publicatiestap. Controleer dat alleen
   de afhankelijke deployjob draait en de live `release.json` dezelfde main-SHA bevat.
6. Controleer na de eerste publicatie echte browseropstart, herladen en offline/PWA-gedrag.
   De bestaande SW-cacheproblematiek hoort bij #105 en wordt hier niet gerepareerd.

Deze repository-instellingen, daadwerkelijke annulering/oude-runweigering en de
live publicatie zijn **nog niet uitgevoerd** door deze PR. #103 kan pas dicht na
activering en controle op GitHub. Oude Actions-runs en handmatige bypasses vallen
onder de ingestelde repository- en omgevingsrechten, niet onder een lokale test.

## Uitgevoerde automatische controles

`npm run verify` is lokaal uitgevoerd met Node 24.19.0: **190 bestaande tests en
12 nieuwe integratietests geslaagd**, geen mislukkingen of overgeslagen tests.
Syntaxis-, import-, versie-, asset- en hashcontroles zijn eveneens geslaagd.
Dezelfde opdracht draait in de PR op GitHub Actions.
De integratietests evalueren de ongewijzigde modules uit `_site` met JSDOM en
fake-indexeddb; elke test krijgt een eigen database en DOM. Alle netwerkverzoeken
worden geweigerd en GPS geeft een toestemmingsfout. SW en camera worden niet nagebootst.
Animatiewachttijden worden verkort: dit valideert geen timing, CSS of touchkwaliteit.
De lege installatie wordt tot het naamformulier getest; de volledige onboarding niet.
Een geweigerde database moet de entry laten afwijzen: dit bewijst detectie door de
poort, niet dat de huidige app al een gebruiksvriendelijke herstelpagina heeft.

Nieuwe uitvoerbare ketens:

- Reguliere en testomgeving starten zonder consolefouten, offline en zonder GPS.
- Kaart met alleen naam opslaan, board sluiten, via het menu de opgeslagen kaart heropenen.
- Testactie zonder relaties opslaan, later een persoon koppelen, heropenen via een
  nieuwe ObjectStore-verbinding; de persoonlijke objects-store blijft gelijk.
- Een oude testworkspace behoudt bewerkte personen en relaties bij toevoeging van
  de omgevingsmodule (bestaand upgradepad, geen algemene migratietest).
- Syntaxisfout in SkeletonDemoView en bewust falende test laten de echte
  `npm run verify` stoppen vóór pakketbouw. Een ontbrekende precache-asset ruimt
  het onvolledige pakket op. Gewijzigde bytes/extra bestanden falen de hashcontrole.
- Een syntaxisfout in de meegeïmporteerde demo laat ook de echte reguliere entry falen.

## Twintig auditscenario's: dekking en open werk

“Bestaand” verwijst naar de opnieuw uitgevoerde Node-suite; bronasserties zijn geen E2E.
De oorspronkelijke audit bevat de onderliggende bevindingen en bronverwijzingen.

| Nr. | Scenario | Status in deze wijziging / resterende test |
|---|---|---|
| 1 | Locatie maken en verrijken | Bestaande deeltests; volledige DOM-/browserketen open. |
| 2 | Sublocatie koppelen | Bestaande hiërarchie-/brontests; volledige keten open. |
| 3 | Persoon → organisatie → vestiging | Nog niet mogelijk als productieketen. |
| 4 | Werkadres afleiden | Nog niet mogelijk. |
| 5 | Actie zonder relaties | Nieuwe DOM-/IndexedDB-keten geslaagd in testomgeving; reguliere module ontbreekt. |
| 6 | Later persoon of thema koppelen | Persoon geslaagd in dezelfde testketen; thema/productie open. |
| 7 | Notitie → actie | Nog niet mogelijk; placeholder. |
| 8 | Agenda → locatie | Nog niet mogelijk; placeholder. |
| 9 | Rit met standaardvoertuig | Nog niet mogelijk in productie. |
| 10 | Afwijkende auto per rit | Nog niet mogelijk. |
| 11 | Klantenkaart → organisatie | Organisatiecontract ontbreekt; nieuwe kaart-opslagtest valideert dit niet. |
| 12 | Scan → object openen | Bestaande payloadtests; fysieke camera en algemene resolver open. |
| 13 | Board van derde | Generieke bronboardketen open; geen externe netwerktoegang in deze tests. |
| 14 | Gezamenlijke acties/afspraken | Nog niet mogelijk als Sharon-productieketen. |
| 15 | Archiveren zonder verlies | Bestaande skeletkern-deeltest; productiebrede lifecycle open. |
| 16 | Zelfde object vanuit modules | Nieuwe relatie-opslagtest is gedeeltelijke dekking; routerketen open. |
| 17 | Aanbod gevolgde organisatie | Nog niet mogelijk. |
| 18 | Vorig board herstellen | Nieuwe kaart sluiten/heropenen via menu; exacte teruggeschiedenis/scroll open. |
| 19 | Swipe onderbreken | Bekend defect uit audit, herstel en gedragstest bij #111. |
| 20 | PWA bijwerken | Nieuwe pakket-/opstartcontroles; echte tweebuild-/offline-update open bij #105. |

## Risicoketens die #104 nog openhouden

- Merge met kaarten, webbronnen en inkomende/uitgaande relaties: regressie bij #108.
- Volledige export/herstel, corrupte back-up, onderbroken commit en quotafout: #106/#107.
- Databaseschema-upgrade met bestaande persoonlijke gegevens: toevoegen wanneer een
  schemawijziging wordt ingevoerd; huidige databaseversie blijft 1.
- Echte browser-/PWA-cachetest over twee builds: #105. JSDOM vervangt deze niet.

## Handtestregistratie voor iPhone en PWA

Nog **niet uitgevoerd**: geen fysieke iPhone of geïnstalleerde PWA beschikbaar.
Leg bij uitvoering vast: datum, tester, toestel, iOS/Safari-versie, browser of standalone,
oude/nieuwe appversie en commit-SHA, ingestelde bewegingsvoorkeur, netwerk/GPS-toestemming,
scenario, verwacht resultaat, werkelijk resultaat en schermafbeelding indien relevant.
Controleer safe areas, schermhoogte/rotatie, toetsenbord, verticaal scrollen,
vingervolgende swipe/cancel, terugnavigatie, offline start en update zonder gegevensverlies.
Gebruik fictieve gegevens en een afzonderlijke testinstallatie.

## Bronnen

- [Audit en oorspronkelijke bevindingen](Sharon-integrale-audit-2026-10-18.md)
- [#103 Releasepoort](https://github.com/Stefan-van-Dijk/sharon/issues/103)
- [#104 Testbasis](https://github.com/Stefan-van-Dijk/sharon/issues/104)
- [GitHub: custom Pages-workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: publicatiebron](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
