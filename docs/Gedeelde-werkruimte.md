# Eén werking, gescheiden gegevens — v0.3.59

Locaties, Kaarten, Omgeving en de pasvoorstellen op Home gebruiken in beide omgevingen dezelfde schermen en regels. Bij het starten wordt één werkruimte gekozen. De modules en de locatie-triggerdienst ontvangen de opslag van die werkruimte. Instellingen voor het wisselen van omgeving blijven op appniveau; wisselen herstart Sharon.

## Gegevens

- Regulier: de bestaande persoonlijke objectopslag.
- Test: één gedeelde opslagadapter voor locaties, passen, locatieacties en modulevoorkeuren. Deze schrijft alleen testmetadata.
- Bestaande testobjecten behouden hun identifiers en relaties. Locatiegegevens uit v0.3.58 en oude kaart-/locatievoorkeuren blijven leesbaar.
- Passen gebruiken de bestaande `usable-at`-relatie. Bewerken van een pas werkt de koppeling bij; de graph en de kaartmodule zien dezelfde koppeling.
- Bij een gekoppelde testpas heet de actie expliciet Archiveren: de pas en zijn relaties blijven bewaard. Een losse testpas biedt Verwijderen. Dezelfde keuze geldt voor testlocaties. Een locatie met zichtbare sublocaties wordt pas verwijderd of gearchiveerd nadat de sublocaties zijn verplaatst, gearchiveerd of verwijderd. Onder de zichtbare stroken van Kaarten en Locaties verschijnt Archief · herstellen zodra er gearchiveerde records zijn; Herstellen brengt hetzelfde object met dezelfde relaties terug.
- Locaties samenvoegen behoudt de paskoppeling in beide omgevingen.

De oude locatieadapter is alleen een compatibiliteitsverwijzing naar deze gedeelde adapter. Er is geen tweede locatie-editor of kaartmodule voor testmodus.

## Praktijkscenario

Zet Testomgeving aan. Maak in Locaties een winkel aan met coördinaten en herkenningsstraal. Maak in Kaarten een pas aan en koppel deze aan die winkel. Ga terug naar Home bij die plek of ververs de locatie. Open het aangeboden pasje. Zet Testomgeving uit en controleer dat de persoonlijke gegevens ongewijzigd zijn.

GPS wordt centraal op aanvraag gelezen; deze versie voegt geen achtergrondtracking of periodieke controles toe. Bij onzekere of verouderde locatiegegevens verschijnen geen pasvoorstellen. Externe kaarten en adresbronnen vereisen hun gebruikelijke netwerktoegang.

## Afbakening

Personen, Objecten, Ritten, Tijd en Acties gebruiken in de testomgeving voorlopig nog de bestaande skeletproef. Hun volledige functionele modules moeten afzonderlijk worden ontwikkeld. Deze versie rondt de gezamenlijke ervaring voor Locaties en Kaarten af; zij maakt niet alle modules productierijp.

De geautomatiseerde ketentest legt via het echte menu een locatie vast, koppelt via de echte kaarteditor een pas en opent die via het contextvoorstel op Home. De persoonlijke objecten, instellingen en bestaande locatieacties blijven daarbij identiek. Werkelijke kaartweergave, scanbaarheid en GPS-gedrag blijven op toestel te controleren.
