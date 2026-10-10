# Omgeving 2.0 — standaard vectorkaart (Sharon v0.1.55)

## Nieuwe werkwijze

De normale module Omgeving gebruikt nu MapLibre GL JS met een bestaande
wereldwijde vectorkaart van OpenFreeMap. Pannen en zoomen veroorzaken geen
Overpass-verzoeken en geen POST naar `/environment/api/tiles.php`.

**Kaartweergave en Sharon-data zijn afzonderlijke lagen.**

| Laag | Bron | Opslag |
|---|---|---|
| Basiskaart (wegen, gebouwen, water, grenzen) | OpenFreeMap / OpenStreetMap | Provider, eigen browsercache |
| Sharon-locaties | `objects` in IndexedDB | Uitsluitend lokaal |
| Eigen Sharon-geometrieën (punt, lijn, vlak) | Expliciet voor kaart gemarkeerde objecten | Uitsluitend lokaal |
| Identifiers | Sharon-object ID en optionele externe `sourceId` | In object, niet in kaarttegel |

Het oude `EnvironmentView.js` blijft voorlopig als ongebruikte broncode
beschikbaar voor terugval tijdens ontwikkeling, maar wordt niet meer door
`Shell.js` ingeladen. De oude PHP-tegels worden niet verwijderd.

## Objecten op de kaart

Bestaande objecten van `type: 'location'` met
`data.coordinates: { lat, lng }` worden direct getoond.

Andere objecten zijn alleen zichtbaar wanneer ze expliciet zijn gemarkeerd:
`data.environment.visible === true` of `data.showOnMap === true`.

Voorbeelden:

```json
{
  "id": "building-12",
  "type": "building",
  "externalId": "AbCdEfGhIj12",
  "data": {
    "title": "Gevelgebouw",
    "environment": {
      "visible": true,
      "sourceId": "osm:way:12345",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[6.1,52.5],[6.11,52.5],[6.11,52.51],[6.1,52.5]]]
      }
    }
  }
}
```

Een object dat meerdere kaarttegels overlapt blijft één object met één
identifier. MapLibre verzorgt eventuele interne uitsplitsing van geometrie
voor het scherm. De volledige geometrie blijft aan het Sharon-object gekoppeld.

Een optionele `sourceId` kan verwijzen naar OSM of later Overture. De
app verzint zelf geen externe bronidentifier.

De naar MapLibre doorgestuurde lokale GeoJSON bevat uitsluitend voor weergave
noodzakelijke velden (`id`, `externalId`, `title`, `kind`, `sourceId`).
Notities, privé-adressen, taakinhoud of volledige objectpayloads worden niet
doorgegeven. MapLibre rendert deze laag lokaal in de browser; de externe
kaartprovider ontvangt geen lokale objectgegevens via deze toepassing.

## Versie en caching

- MapLibre 6.11.2 via UNPKG (vastgepinde versie).
- Eigen monochrome stijl, afgeleid van OpenFreeMap Positron; meegeleverd in `EnvironmentStyle.js`.
- Geen namen, tekstlabels, glyph-, sprite-, raster- of externe stijlverzoeken.
- Gebouwen vanaf zoom 14, zoom tot 22 (extra zoom vergroot beschikbare geometrie).
- Expliciete MapLibre 6 module-worker en maximaal twee workers.
- Laatste kaartpositie/zoom lokaal opgeslagen; +/- knoppen en knijpzoom.
- Appbestanden met het huidige versienummer komen direct uit de shell-cache.
- Sharon applicatie/shell-cache: 0.1.55.
- Standaard HTTP-/browsercache van de kaartdienst; geen eigen tegelgenerator.
- De serviceworker precachet de lokale kaartmodule en GeoJSON-adapter.
- De basiskaart bevat alleen geometrie; Wikipedia wordt niet opgehaald.

## Beperkingen en vervolg

De nieuwe module is direct bruikbaar met de huidige hosting zonder
database-migraties of PHP-aanpassingen.

**Dit is geen geïnstalleerde PostGIS-database.** Bij groei naar publiek
gedeelde objecten moet een afzonderlijke beveiligde API toegevoegd worden.
Aanbevolen vervolgrichting:

1. PostgreSQL/PostGIS als geografische index voor gedeelde objecten.
2. Een API die de objecten binnen de zichtbare bounding box en de rechten
   van de aanvrager ophaalt, met paginering en cacheheaders.
3. Authentificatie, autorisatie, objectversies en publicatiecontrole.
4. Servergepubliceerde objecten als extra GeoJSON of vectortegellaag,
   nooit rechtstreeks in de externe OSM-basiskaart.
5. Indien onafhankelijkheid van de kaartprovider nodig is, eigen PMTiles
   voor de statische basiskaart via geschikte objecthosting.

Zonder zo'n server zijn nu uitsluitend de reeds lokaal opgeslagen objecten
zichtbaar. Dit voorkomt onbedoelde publicatie van persoonlijke gegevens.

De OpenFreeMap-dienst is extern en heeft geen individuele SLA. Een geopende
kaartlocatie wordt via standaard tegelverzoeken aan die provider bekend.
Controleer privacy, beschikbaarheid, CORS/CSP en internetbereik op echte
telefoons voor brede uitrol.

## Acceptatietests

- Open Sharon > Omgeving: witte vectorkaart met grijze straten en gebouwen.
- Navigeren, in-/uitzoomen en GPS-positie bepalen.
- Opgeslagen lokale locaties worden als punten getoond.
- Eigen lijn of polygoon met `data.environment.visible` verschijnt.
- Geen Wikipedia/Overpass/tiles.php-verzoeken vanuit de standaardkaart.
- Geen duplicaatobject bij tegelgrenzen.
- Bronvermelding in de kaart zichtbaar.
- Ontbrekende WebGL/kaartverbinding toont foutmelding, geen zware fallback.
- App terug naar Home, weer naar Omgeving; geen oude kaartcanvas.
- `npm test` en mobiele Safari iOS/Android controles.

### Uitrol
GitHub `main` en webhosting `sharon.life` zijn mogelijk gescheiden.
Merge wijzigt de repository; bij FTP/Strato publicatie is aparte upload van
gewijzigde statische bestanden nodig. `/environment/tiles` en `/private`
blijven onaangeroerd.

## Projecties (0.1.53)

`data.environment.color` ondersteunt een kleur als `#316a86`. `opacity` is
een getal van 0 tot 1; `seen: true` vervaagt punt, lijn én vlakcontour.
Standaard blijven objecten donkergrijs. Een import of bronadapter bepaalt
welke objecten al gezien zijn; de kaart leidt dat niet zelfstandig af.
Na aanpassen van opgeslagen objecten kan die adapter
`events.emit('environment.objects.changed')` aanroepen. De kaart leest
dan de lokale objecten opnieuw, zonder de basiskaart te reconstrueren.

De bronidentifier blijft aan het hele object gekoppeld. Alleen de
weergavevelden gaan naar de lokale GeoJSON-laag. Automatisch vergelijken
met externe bronnen en een projectie-editor vallen buiten deze versie.

Validatie: volledige Node-tests en MapLibre Style Specification-validatie
van basiskaart plus objectlagen. Visuele mobiele QA en tijdmetingen zijn
nog op een echt apparaat nodig.

## Schaalbediening (0.1.54)

Tik op de schaalchip om naar het volgende niveau te gaan, zoals bij de
oorspronkelijke canvasweergave: Dichtbij (70 m), Detail (220 m), Straat
(700 m), Wijk (3 km), Plaats (15 km), Regio (70 km), Land (700 km),
en daarna weer Dichtbij. De schaal gebruikt de langste zichtbare schermzijde,
zoals de oorspronkelijke kaart. Knijpzoom blijft vrij; de chip volgt steeds
het dichtstbijzijnde niveau.

Knijp- en sleepzoom heeft 60% van de oorspronkelijke gevoeligheid; muiswiel
en trackpad zijn rustiger ingesteld. +/- en dubbeltikken veranderen de
zoom met een halve stap in 420 ms. Niveauovergangen duren 650–1400 ms,
afhankelijk van de afstand. Ze blijven onderbreekbaar door een nieuw gebaar.
Straat- en plaatsnamen zijn verwijderd. Dit behoudt de kale geometrische
basis voor latere projecties en vermijdt fontverzoeken.

In 0.1.55 hebben kaartgebaren voorrang op de swipe naar Home, ook aan de
linkerkant van het scherm. Terugkeren kan via de bestaande Home-knop.
