# Home boards — actuele vervangende wijziging

Vervangt concept PR #130. Deze branch is gebaseerd op de actuele main (v0.3.71 bij start).

## Gewenst
- Eén board tegelijk; bestaande oneindige horizontale carrousel, geen verticale kaartenlijst, pijlen, nummers of blauwe selectierand.
- Stapelicoon naast het Sharon-logo op Home, alleen actief bij relevante boards.
- Sluiten door naar beneden te vegen; opnieuw openen via het icoon.
- Relevante bronnen: Kaarten, ingeschakelde Wikipedia en uitbreidbaar naar andere modules; privacyinstellingen respecteren.
- Automatisch voorstellen eenmaal per daadwerkelijk locatiebezoek; geen heropening bij GPS-renders; vertrek en terugkeer met hysterese.
- Tijdens rit standaard geen automatische klantenpas; uitzondering per kaart, en na rit na stabiele aankomst.
- Handmatig openen altijd mogelijk. PWA kan geen achtergrondlocatie garanderen.

## Vereiste controles vóór merge
- Integratietests bijwerken van `[data-context-card]` naar het header-stapelicoon en de gedeelde overlay.
- Zowel gewone als testomgeving, locatiekoppeling, GPS-veroudering, openen/sluiten en listeners testen.
- Bron-/import-/versiecontrole, build, integratietests en publicatiecontrole groen.
- Geen merge of publicatie vóór implementatie en geslaagde checks.
