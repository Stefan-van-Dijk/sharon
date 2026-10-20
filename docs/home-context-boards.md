# Contextafhankelijke boards op Home — implementatiespecificatie

Status: voorbereid voor implementatie; geen productiewijziging.

## Doel
Eén gedeelde board-carrousel op Home in plaats van meerdere kaarten onder elkaar. In de header rechts naast Sharon komt het bestaande stapelicoon. Alle geactiveerde bronnen kunnen relevante boards leveren: Kaarten, Locaties, Wikipedia en later andere modules.

## Gedrag
- Icoon in header: inactief wanneer geen relevante boards; actief wanneer minimaal één relevant board.
- Bij een nieuwe relevante context kan de stapel automatisch openen, maar niet opnieuw bij iedere render of GPS-update.
- Wegvegen naar beneden sluit de stapel; het icoon blijft actief en opent dezelfde relevante stapel opnieuw.
- Een nieuw relevant board kan de gesloten stapel opnieuw aanbieden; reeds geziene boards alleen niet.
- Slechts één board zichtbaar, horizontale oneindige carrousel; geen nummering, pijlen of blauwe selectierand.
- Bestaande swipe omhoog voor uitbreiding en omlaag voor sluiten behouden.
- Handmatig openen blijft mogelijk, ook als automatisch tonen is uitgesteld.
- Contextwijziging en selectie moeten stabiel blijven bij her-rendering.

## Boardregister
Elke module levert een array met stabiele board-id, bronmodule, relevantie, optionele locatie, prioriteit en auto-open-toestemming. De gedeelde presentatielaag wijzigt geen moduledata. Deduplicatie op bron + board-id. Ingeschakelde bronnen en privacyinstellingen respecteren.

## Kaarten en Ritten
- Standaard auto-open na afgeronde rit en circa 60 seconden stabiele aankomst.
- Opties per kaart: tijdens rit; na rit; onafhankelijk van ritstatus.
- Bij uitgeschakelde of onbekende Ritten-status werkt locatiegebaseerde presentatie normaal.
- Eén automatische aanbieding per locatiebezoek; pas na werkelijk vertrek en nieuwe aankomst opnieuw.
- Hysterese rond geofence en meerdere opeenvolgende locatiepunten voorkomen GPS-flikkering.
- Kaarten blijven altijd handmatig bereikbaar.
- In PWA geen garantie op achtergrondlocatie of automatische weergave wanneer de app niet actief is.

## Acceptatiecriteria
1. Home toont nooit meerdere contextboards onder elkaar.
2. Headericoon activeert/deactiveert op basis van beschikbare boards.
3. Sluiten en heropenen behoudt de relevante boardlijst.
4. Een gewone locatie-update opent een gesloten stapel niet opnieuw.
5. Nieuwe relevante boards kunnen een nieuwe aanbieding starten.
6. Wikipedia verschijnt alleen als de bron is ingeschakeld.
7. Tijdens rit worden standaard klantenkaarten niet automatisch geopend, maar Q-Park-achtige uitzonderingen wel.
8. Zonder actieve Ritten blijft Kaarten werken.
9. Bij verblijf in hetzelfde locatiegebied geen herhaalde pop-ups.
10. Bestaande boardweergave in Omgeving, Locaties en Kaarten blijft intact.

## Volgorde
1. Huidige Home-renderer en bestaande board/deck-component inventariseren; hergebruiken.
2. Headericoon en één gedeelde carrousel op Home integreren.
3. Boardregister voor relevante bronnen toevoegen.
4. Ritstatus en aankomst-/vertreklogica koppelen.
5. Tests voor UI, heropenen, deduplicatie, ritregels en regressies toevoegen.
6. Versienummer pas verhogen na werkende implementatie en geslaagde tests.
