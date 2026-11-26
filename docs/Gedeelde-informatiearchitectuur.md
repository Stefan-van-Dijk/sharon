# Gedeelde informatiearchitectuur

## Bronnen en bestaande sleutels

| Bron | Eigenaarschap | Bestaande opslag |
| --- | --- | --- |
| Sharon | Persoonlijk overzicht, lokale relaties en persoonlijke tijdkoppelingen | IndexedDB met lokale object-ID en eventueel externe ID12. Deelbestanden en verbindingen hebben eigen contracten. Locatie-ID6/ID8 en geometrie blijven in hun eigen registers. |
| Event Line | Evenementen, organisatieworkflow en deelname | JSON per organisatie, met bestaande 32-hex sleutels en inclusieve datums. Een aanvullende ID12 kan bij de bron een verwijzing naar hetzelfde evenement identificeren. |
| ShopList | Lijsten, catalogus, recepten en activiteiten | De actieve repository is `Stefan-van-Dijk/shop`. Lokale sleutels zijn opaak. Centrale producten en gedeelde collecties kunnen ID12 hebben. De bestaande samenwerking gebruikt gekoppelde catalogus- en lijstcontracten. |

Een gedeelde verwijzing heeft de vorm `{"source":"event-line","id":"Abcdef123456","class":"event"}`.
De combinatie bron en ID identificeert het object. De klasse beschrijft hoe de app het object interpreteert.
Bestaande `type`-velden, boardverbindingen en locatiereferenties behouden hun eigen contract.
Een app publiceert een verwijzing pas zodra de bron de ID12 duurzaam heeft uitgegeven.

## Tijdregister v1

Sharon bewaart persoonlijke tijdkoppelingen in de bestaande IndexedDB-objectstore.
Elke koppeling heeft een eigen ID12, klasse `time-entry`, versie en `data.target`-verwijzing.
Het register is generiek. De eerste bediening koppelt lokale notities, locaties en bekende personen.
Agenda toont de tijdkoppelingen en Tijd voegt ze toe of verwijdert ze.
Een verwijderde koppeling laat het doelobject intact. De bestaande databasestructuur hoeft niet te worden gemigreerd.

| Vorm | Velden in `data.extent` | Grenzen |
| --- | --- | --- |
| Tijdstip | `kind: instant`, `at` | Eén tijdstip met bekende UTC-offset |
| Tijdvak | `kind: interval`, `start`, `end` | Begin inclusief, einde exclusief en later dan begin |
| Kalenderperiode | `kind: date-range`, `start`, `end` | Beide kalenderdatums inclusief. Dezelfde datum mag als begin en einde. |

Tijdstippen volgen een beperkte ISO 8601/RFC 3339-vorm met seconden, bekende offset en maximaal drie cijfers voor fracties. Opslag normaliseert naar UTC met milliseconden. Datumwaarden behouden hun kalenderdatum. Een datum uit Event Line krijgt dus geen stilzwijgende UTC-middernacht. De openbare bronadapter leest de tijd van een evenement bij Event Line. Een tijdkoppeling in Sharon blijft een eigen annotatie.

## Uitwisseling

- [Linked Data](https://www.w3.org/DesignIssues/LinkedData.html) ondersteunt verwijzen naar bronobjecten via stabiele HTTP-IRI's. Een interne ID12 in combinatie met een bronnamespace kan later op zo'n IRI worden afgebeeld zodra de bron een vast resolutiecontract heeft.
- [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) biedt een representatie voor een uitwisselprojectie met `@id` en `@type`. De bestaande opslag gebruikt gewone JSON. Publicatie van een context vereist eerst stabiele afspraken over de IRI's en vocabulaire.
- [OWL-Time](https://www.w3.org/TR/owl-time/) geeft `time:Instant` en `time:ProperInterval` voor tijdstippen en tijdvakken. De expliciete grensconventie van Sharon blijft onderdeel van het appcontract. Een inclusieve kalenderperiode vraagt een eigen mapping om betekenis en precisie te bewaren.
- [ISO 8601](https://www.iso.org/standard/70907.html) en [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) onderbouwen de datum- en tijdnotatie. De app beperkt de toegestane syntaxis tot wat zij valideert en behoudt.

## Uitrol

Het lokale tijdregister vereist geen Strato-migratie, databasewijziging of nieuw serverbestand. Voor appoverschrijdende functies gelden de uitrolinstructies van de bron die de serverroute beheert. Een app die tijd of persoonsgegevens bij een andere bron leest, gebruikt de toegangscontrole van die bron.

## Openbare evenementen in Agenda

Agenda accepteert een openbare evenementlink van de bestaande Event Line-route op `sharon.life/eventline/`. Sharon bewaart alleen de ID12-verwijzing, de bronselector en de eigen verbindingen met locaties, personen en notities. Titel, tijd en locatie leest Agenda bij openen rechtstreeks uit de openbare projectie van Event Line, zonder accountcookies en zonder lokale kopie van die bronvelden. Zodra Event Line toegang intrekt, toont Agenda dat het evenement niet meer openbaar is. Event Line bepaalt de zichtbaarheid en de inhoud. Evenementen van vóór de bron-ID12 blijven bereikbaar via hun bestaande Event Line-link.
