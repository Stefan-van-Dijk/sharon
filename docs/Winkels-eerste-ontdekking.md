# Eerste winkelgegevens — 0.4.74

De bestaande serverroute gaf in Parijs geen gegevens: private.coffee timeout,
overpass-api.de ongeldig antwoord. Ook een leeg maar verouderd deel van een
viertekens-bestand kon als resultaat terugkomen zonder zichtbare winkels.

De app controleert opgeslagen gebieden maximaal één seconde. Bij ontbrekende,
lege onvolledige of onbereikbare opslag haalt de app de bron rechtstreeks op.
Binnen het conservatieve Europese venster [-12,35,32,60] gebruikt deze route
Overpass Europe van dresel.systems, met dagelijkse Geofabrik-data. Buiten dit
venster blijft de wereldwijde bron gebruikt; deze release bewijst daar geen
betere beschikbaarheid. Geen API-sleutel, PHP-upload of nieuw identifiersysteem.

Verse lege dekking blijft een geldig antwoord. Oude niet-lege gegevens verschijnen
met achtergrondverversing. Direct opgehaalde details worden hergebruikt bij openen
van een board. Na bronfouten is er een bronpauze van 30 seconden; die verhindert
geen raadpleging van de eigen opslag. Een ontbrekende/legacy gebiedsservice kan
nog terugvallen op de bestaande chains-route.

Direct opgehaalde resultaten worden lokaal in de bestaande begrensde IndexedDB
cache bewaard. Deze appwijziging schrijft de nieuwe bronresultaten NIET naar de
gezamenlijke PHP-opslag: die server heeft nog de oude bronconfiguratie. Dit is een
expliciete beperking, geen stilzwijgende claim dat gedeelde opslag nu gevuld is.

Live verificatie: `node scripts/check-shop-live.mjs` vraagt één klein Parijs-vak
op via de werkelijke ChainBrowse/ShopSource-route en controleert details. Op
13 november 2026 werden 32 winkel-/horecapunten ontvangen in circa 6,3 seconden,
waarvan circa 1 seconde opslagbudget. Dit is geen browser- of telefoonmeting.
Een aparte browserregressie gebruikt een echte opgenomen OSM-respons uit Parijs.
De fixture bevat openbare OSM-data, © OpenStreetMap contributors, ODbL-1.0;
bron https://ovp.dresel.systems/api/interpreter, dataset 2026-11-12T21:23:05Z.

De totale internetlatentie is niet gelijk aan bestandstijd op de server. Deze
release maakt daarom geen millisecondenbelofte voor de netwerkcontrole.
