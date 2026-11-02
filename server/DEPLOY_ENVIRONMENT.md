# Deploy gedeelde Omgeving-cache op sharon.life

Sharon kan kaartgeometrie lokaal cachen, maar gebruikt nu ook een gedeelde online cache zodat een gebied maar één keer uit OpenStreetMap/Overpass hoeft te worden opgebouwd.

## Upload

Kopieer via FileZilla:

`server/environment.php`

naar:

`/environment/api/tiles.php`

op sharon.life.

De PHP-endpoint maakt daarna zelf deze structuur aan:

`/environment/tiles/<2 tekens>/<4 tekens>/<6 tekens>/<schaal>.json`

Daarnaast wordt automatisch:

`/environment/coverage.json`

bijgehouden. Daarin staat per gebiedsidentifier welke schaal al is opgebouwd, wanneer dat gebeurde, hoe actueel de OSM-bron was en hoeveel lijnobjecten de tegel bevat.

Voor een 4-tekengebied stopt het pad eerder. Voorbeeld:

`/environment/tiles/Aa/AaAd/place.json`

of:

`/environment/tiles/Aa/AaAd/AaAdhF/street.json`

## Identifierhiërarchie

Dezelfde 64 tekens als Sharon gebruikt voor identifiers worden gebruikt:

`A-Z a-z 0-9 - _`

Een gebiedsidentifier heeft 2, 4, 6 of 8 tekens.

Iedere twee extra tekens verfijnen het bestaande gebied:

- 2 tekens: wereldregio;
- 4 tekens: grof lokaal gebied;
- 6 tekens: fijn lokaal gebied;
- 8 tekens: zeer specifiek puntgebied.

De prefix blijft behouden. Een 8-tekengebied hoort dus altijd bij zijn 6-, 4- en 2-tekenouders.

## Werking

Bij openen van Omgeving gebruikt Sharon deze volgorde:

1. lokale IndexedDB-cache;
2. gedeelde tegel op sharon.life;
3. als die ontbreekt: POST naar `tiles.php`;
4. de server haalt de benodigde openbare OpenStreetMap-geometrie via Overpass op;
5. de server schrijft een compact JSON-bestand naar de hiërarchische tegelmap;
6. volgende apparaten lezen direct hetzelfde bestand.

Als de PHP-endpoint nog niet is geplaatst of tijdelijk niet bereikbaar is, valt Sharon terug op de bestaande directe Overpass-opvraging. Omgeving blijft daardoor functioneren.

## Rechten

Aanbevolen:

- `/environment`: 755
- `/environment/api`: 755
- `tiles.php`: 644
- `/environment/tiles`: door PHP aan te maken; directories 755, bestanden 644

Gebruik geen 777 als permanente instelling.

## Eerste controle

Na upload:

`https://sharon.life/environment/api/tiles.php?id=AAAA&scale=place`

hoort JSON terug te geven. Als dit gebied nog niet is opgebouwd, is een 404 met:

`{"error":"Gebied is nog niet opgebouwd."}`

correct.

Daarna bouwt Sharon zo'n ontbrekend gebied automatisch op zodra Omgeving het nodig heeft.

Na de eerste opgebouwde tegel hoort ook:

`https://sharon.life/environment/coverage.json`

beschikbaar te zijn. Dit bestand vormt later de basis om op wereldniveau te laten zien welke gebieden Sharon al heeft uitgetekend.
