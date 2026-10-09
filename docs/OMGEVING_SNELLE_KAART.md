# Snellere Omgeving-kaarten — Sharon 0.1.50

## Doel
Snelle kaartinteractie, zonder het bestaande Sharon-id-systeem of gedeelde
objectgegevens te wijzigen. Kaartweergave en identificatie zijn verschillende
verantwoordelijkheden.

## In deze wijziging
- Wikipedia/Wikidata-markeringen, knoppen en `objects.php`-requests uit de
  **Omgeving-interface** verwijderd. De serverdata wordt niet gewist.
- Lijnen van de vorige kaart blijven zichtbaar terwijl nieuwe tegels laden.
- De verzameling zichtbare gebiedsidentifiers (in plaats van een bijna continu
  veranderende middelpuntscoördinaat) bepaalt of een request nodig is.
- Cachevolgorde: geheugen → IndexedDB → online bundel → afzonderlijke tegel.
- Op hetzelfde moment gevraagde online tegels worden samengevoegd.
- Opslaan in IndexedDB blokkeert het tekenen niet meer.
- De service worker onderschept externe vectortegels/CDN-verzoeken niet langer
  met `cache: reload`: de browser kan normale HTTP-caching gebruiken.
- Versie-/app-shell-cache verhoogd naar **0.1.50**.

## Twee kaartweergaven vergelijken
1. Bestaande kaart (standaard): `https://sharon.life/`.
2. MapLibre-vectorkaart (proef): `https://sharon.life/?kaart=vector`.

De tweede variant vraagt uitsluitend een **openbare OpenStreetMap-vectorkaart**
op van OpenFreeMap, getekend met MapLibre. Het gekozen uiterlijk is sober
(Positron, zonder automatische kaartlabels). Lokale Sharon-locaties verschijnen
als eigen markeringen. GPS en Sharon-geografische identifiers blijven bruikbaar.
De brongegevens van die vectorkaart worden **niet** omgezet naar Sharon-tegels.

De proefweergave gebruikt:
- MapLibre GL JS 6.13.0 via de officiële UNPKG-distributie
- `https://tiles.openfreemap.org/styles/positron`
- OpenStreetMap-data, met bronvermelding via MapLibre

Als CDN of WebGL niet werkt, valt de proef terug naar de huidige Canvas-kaart.
De keuze wordt uitsluitend geactiveerd met de URL-parameter. Er is nog
geen standaardoverstap naar de MapLibre-weergave.

## Bewuste grenzen
- De huidige JSON/Overpass-backend blijft werken en wordt **niet** aangepast.
- Het verschil tussen 2/4/6/8-tekengebiedsniveaus is relatief groot. Op de
  bestaande Canvas-kaart kan het detailniveau daarom nog terugvallen naar
  bovenliggende tegels zodra meer dan 9 tegels nodig zijn.
- De eigen Sharon-objectgeometrie is nog niet als MapLibre-vectoroverlay
  gekoppeld; alleen lokaal opgeslagen locaties worden weergegeven.
- Externe kaartbronnen krijgen netwerkverzoeken die de opgevraagde kaartregio
  kunnen onthullen. Controleer privacy, beschikbaarheid en eventuele
  leveringsgaranties voordat deze proefweergave standaard wordt gemaakt.
- OpenFreeMap heeft op dit moment geen individuele SLA voor de openbare dienst.
- MapLibre gebruikt bij het tonen van haar basemap direct netwerkverzoeken;
  dus de eerste keer is internet nodig. Daarna kan HTTP-cache helpen.

## Vervolgstap
1. Meet koud en warm starten, slepen en inzoomen op iOS en Android.
2. Leg vast welke geometrieën tot de gedeelde kaart horen en welke tot
   persoonlijke/gepubliceerde Sharon-objecten.
3. Ontwikkel een koppeling van Sharon-identifiers naar GeoJSON/vectortegels
   voor eigen objecten; referenties naar het originele object blijven bestaan.
4. Beslis of een eigen PMTiles/MBTiles-hosting of een externe vectortegeldienst
   gewenst is voordat MapLibre de standaard wordt.

## Testlijst
- Start app normaal; de bestaande kaart moet zonder Wiki-requests openen.
- Verschuif de kaart een klein stukje; lijnen mogen niet verdwijnen.
- Ga van gebied A naar B en snel terug naar A tijdens het laden.
- Wissel zoom en GPS tijdens een lopend netwerkverzoek.
- Bezoek een gebied zonder online tegel; controleer de fallback.
- Start met `?kaart=vector`; controleer wegen, gebouwen en basemap.
- Controleer GPS-icoon en lokaal opgeslagen locaties in de vectorvariant.
- Controleer bronvermelding, browseroffline en herstart van de PWA.
- Draai `npm test` voor identifier- en tileplanregressies.

## Uitrol
Deze branch betreft GitHub-bronbestanden. De live-app verandert **niet**
totdat wijzigingen gemerged en gepubliceerd zijn op de hosting. De PHP
serveromgeving wordt in deze wijziging niet aangepast. Houd bij uitrol
ook de webapp-cache en eventuele FTP-publicatie in de gaten.
