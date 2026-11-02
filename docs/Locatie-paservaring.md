# Locatiegebonden pasjes — v0.3.57

Doel: open Sharon bij een bekende winkel en gebruik direct een passende pas.

## Eerste werkende stap

- Koppel bij Kaarten via Extra informatie een bestaande locatie aan een pas.
- Home biedt onder 'Hier te gebruiken' de pas aan bij een recente locatiecontrole binnen de ingestelde locatiestraal.
- Meerdere passende passen verschijnen naast elkaar als afzonderlijke stroken onder elkaar.
- Alleen expliciete koppelingen tellen; winkelnamen of ketens worden niet geraden.
- Een voorstel vereist een meting jonger dan twee minuten. De GPS-onzekerheid moet volledig binnen de locatiestraal passen. Bij vertrek, verlopen meting of verbergen van de app verdwijnen voorstel en eventueel geopend contextboard.
- De centrale locatievoorziening blijft leidend: openen, terugkeren naar de app of handmatig verversen. Deze stap introduceert geen GPS-polling of achtergrondmeldingen.
- Testomgeving en persoonlijke pasvoorstellen blijven gescheiden.

Home, detailweergaven en Omgeving gebruiken dezelfde hoogtemeting. Bij invoer volgt de hoogte het zichtbare scherm met toetsenbord. Pasboards sluiten met omlaag vegen vanuit ingeklapte toestand; een uitgeklapt board klapt eerst in. Bij verlaten van Kaarten worden board, scanner en strookhandlers opgeruimd.

## Controle op iPhone

Na publicatie en opnieuw openen van alle Sharon-vensters:

1. Controleer versienummer 0.3.57, volledige schermhoogte op Home en in Locaties, Kaarten en Omgeving, ook na draaien en hervatten.
2. Koppel een pas aan een eigen winkellocatie en open Home bij die plek. Tik op het voorstel en scan de pas.
3. Sluit via omlaag vegen. Controleer met twee gekoppelde passen dat beide beschikbaar zijn.
4. Ga buiten de straal, ververs de locatie en controleer dat het voorstel verdwijnt. GPS wordt niet voortdurend gecontroleerd.
5. Controleer invoer met toetsenbord, terugnavigatie en de testomgeving.

Geautomatiseerde tests controleren selectie, onzekere/verouderde GPS, sublocaties, opslag naar Home, vertrek, centrale GPS en scheiding van testdata. Werkelijke iOS-schermhoogte, GPS en scanbaarheid moeten op het toestel worden bevestigd.

## Hierna

Eerst deze ervaring in dagelijks gebruik toetsen. Daarna dezelfde contextregels uitbreiden met zelfstandig vastgelegde acties. Nieuwe modules volgen zodra de basiservaring betrouwbaar blijkt.
