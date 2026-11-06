# Lokale AI-teststart

Start met `npm run test:preview` en open http://127.0.0.1:4174.
De afzonderlijke lokale testbuild slaat de begroeting en kennismaking over.
Een leeg testprofiel krijgt de naam AI-testprofiel. GPS is fictief, standaard
Antwerpen (51.22111, 4.39971). Kies andere coördinaten met:

```
npm run test:preview -- 52.09 5.12
```

De gele melding maakt de testomgeving herkenbaar. De server luistert uitsluitend
op 127.0.0.1. De normale productiebuild bevat geen teststart en de gewone
begroeting blijft behouden. De service worker is in de testbuild uitgeschakeld;
PWA-updates moeten via de bestaande PWA-tests worden getest.

Gebruik een afzonderlijk browserprofiel of context voor tests. Bestaande settings
op deze testorigin worden niet overschreven. Gebruik deze origin niet voor echte
persoonsgegevens. Zoekopdrachten voor winkels gebruiken de echte bronroute en
het fictieve kaartgebied. De teststart simuleert geen geslaagde winkelresultaten.

De gegenereerde map `.ai-test-site` is tijdelijk en mag niet worden gepubliceerd.
WebGL2 blijft nodig om de kaart visueel te kunnen testen. De teststart verandert
de mogelijkheden van de browser niet.

## Twee controlerondes

- `npm run test:intro`: de echte lege installatie tot aan de kennismaking.
- `npm run verify:app`: overige controles, met vooraf ingestelde testprofielen
  voor de opstarttests. Browser- en PWA-tests blijven afzonderlijk behouden.
- `npm run verify`: beide rondes bij lokaal volledig controleren.

CI voert de introronde alleen uit wanneer de intro of gedeelde afhankelijkheden
(opstartcode, opslag, locatievoorziening, stijlen, pakketten of testinrichting)
veranderen. Een losse verhoging van import-queryversies telt niet als inhoudelijke
wijziging. Bij handmatig starten of een onbekende vergelijkingsbasis wordt de
intro uit voorzorg wel getest. De introronde controleert DOM en de overgang naar
naam invoeren; dit bewijst geen animatietiming of complete visuele kennismaking.
