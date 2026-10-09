# Omgeving 2.0 — standaard vectorkaart (Sharon v0.1.51)

## Nieuwe werkwijze

De normale module Omgeving gebruikt nu MapLibre GL JS met een bestaande
wereldwijde vectorkaart van OpenFreeMap. Pannen en zoomen veroorzaken geen
Overpass-verzoeken en geen POST naar `/environment/api/tiles.php`.

**Kaartweergave en Sharon-data zijn afzonderlijke lagen.**

| Laag | Bron | Opslag |
|---|---|---|
| Basiskaart (wegen, gebouwen, water, grenzen, plaatsnamen) | OpenFreeMap / OpenStreetMap | Provider, eigen browsercache |
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
- OpenFreeMap Positron (basiskaart).
- Sharon applicatie/shell-cache: 0.1.51.
- Standaard HTTP-/browsercache van de kaartdienst; geen eigen tegelgenerator.
- De serviceworker precachet de lokale kaartmodule en GeoJSON-adapter.
- Kaartlabels voor straten en plaatsen blijven zichtbaar; Wikipedia wordt
  niet opgehaald; provider-POI-overlays worden waar mogelijk verborgen.

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

- Open Sharon > Omgeving: Positron vectorkaart met straten en gebouwen.
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
