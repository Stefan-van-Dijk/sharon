# Architectuur Sharon

## Kernidee

Sharon wordt niet opgebouwd als één steeds groter script, maar als een kleine local-first kern waarop modules aansluiten.

```text
UI / modules
    ↓
Events + services
    ↓
ObjectStore
LocationService
IdentifierService
Sharing / Sync
    ↓
Browser / externe bron
```

## Locatie

Er bestaat exact één `LocationService`.

Modules mogen om een actuele locatie vragen en mogen een actieve rit aanmelden. Modules starten zelf geen `watchPosition()`, geen eigen periodieke GPS-timer en geen losse permissiepolling.

Energiebeleid:

- app niet zichtbaar → geen GPS;
- zichtbaar en niets actief → alleen op aanvraag;
- locatieacties aanwezig → nog steeds op aanvraag;
- actieve rit → één centrale controle per minuut;
- handmatige controle → één high-accuracy meting.

## Opslag

IndexedDB is de primaire lokale opslag.

Stores:

- `objects`
- `settings`
- `events`
- `tracks`
- `meta`

Lokale database-id's en externe deel-identifiers zijn verschillende concepten.

## Identifiers

Extern formaat:

`^[A-Za-z0-9_-]{12}$`

De identifier verwijst naar een uitwisselbare bron en hoeft nooit gelijk te zijn aan een lokale database-id.

## Modules

Eerste functionele modules:

- Ritten
- Tijd / Taken
- Locaties
- Acties
- Kaarten
- Thema's

Samenwerking, personen en voertuigen worden op dezelfde kern aangesloten zodra objectmodel en rechtenmodel stabiel zijn.

## Share on

Delen is geen opslagmodel van een losse module. Het wordt een generieke capability van Sharon. Daardoor kan hetzelfde mechanisme later voor kaarten, locaties, thema's, acties, personen en samenwerkingen worden gebruikt.
