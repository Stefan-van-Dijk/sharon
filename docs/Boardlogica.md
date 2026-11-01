# Boardlogica in Omgeving

Dit is de gedragsafspraak voor de gedeelde boardnavigatie.

- Ingeschakelde bronnen leveren hun categorie- en statusselectie binnen het kaartvenster.
- Wikipedia, winkels, eigen locaties en Tiqets gebruiken één gezamenlijk deck en dezelfde gekozen sortering.
- Bij openen worden selectie en afstandsmiddelpunt vastgelegd. De actieve kaart volgt het geopende board.
- Standaard **Vaste selectie**: bronverzoeken worden gepauzeerd en het deck groeit niet tijdens bladeren.
- Optioneel **Verder ontdekken**: gebiedsvragen blijven actief bij kaartbewegingen. Nieuwe resultaten binnen de actieve bronfilters worden bij de volgende swipe toegevoegd. Bestaande deckitems blijven behouden; bronidentificaties voorkomen dubbelen. De afstandssortering houdt het oorspronkelijke middelpunt.
- De keuze staat onder het tandwiel bij Boards, wordt lokaal onthouden en geldt bij de volgende deckopening. Een bestaande sessie wisselt niet halverwege van gedrag.
- Een nieuwe deckopening bouwt een nieuwe selectie op volgens het huidige kaartgebied en de huidige filters.
- Gebiedsvragen behouden hun zoom-, tijd- en aantallimieten. Verder ontdekken is geen onbeperkte wereldimport.
- Ontdekte winkel- en Wikipediapunten blijven in het sessiegeheugen. Expliciet uitschakelen van hun bron reset die ontdekking; eigen opgeslagen locaties en waarderingen blijven behouden.

Buiten Omgeving behouden andere modules hun eigen objectlijst; de groeikeuze geldt voor Omgeving.

## Audit en correcties

Beide standen controleren bij een swipe opnieuw of de bron actief is en het item
nog aan de categorie-/statusfilters voldoet. Nieuwe records vervangen bestaande
metadata op bron-ID, zonder dubbelen. Een lege selectie sluit het deck. Dit geldt
ook voor veranderlijk live-aanbod: verdwenen Tiqets-aanbod blijft niet als oud board
in het deck hangen. De vaste stand voegt geen nieuwe boards toe; een bewuste
filterwijziging of verwijdering mag de selectie wel verkleinen.

Rechtstreeks aangeklikte eigen locaties in Omgeving gebruiken nu eveneens de
gezamenlijke navigatie via een tijdelijke bron. De bron blijft beperkt tot bestaande
eigen locaties en wordt bij sluiten verwijderd; openbare bronknoppen blijven hun
eigen selectie bepalen. De overige modules gebruiken hun bestaande locatiedeck.

De winkelverbeteringen van PR #232 zijn geïntegreerd: zichtbaar venster tot maximaal
10 km; meer Overpass-werkgeheugen zonder hogere downloadlimiet. Publieke wereldwijde
beschikbaarheid blijft afhankelijk van de externe server en is niet gegarandeerd.

Bronlimieten hoeven niet identiek te zijn: Wikipedia zoekt maximaal 40 bronpagina's,
winkels maximaal 2.000 punten, Tiqets volgt zijn live API. Dit zijn capaciteitsgrenzen,
geen verschillende regels voor selectie/navigatie. Het voorstel van maximaal 100
winkelpunten en categoriegericht ophalen bij de bron is nog niet uitgevoerd.


## Verificatie en resterende grenzen

De audit controleert vaste/groeiende selectie, bron-ID-ontdubbeling, verversen van
metadata, uitgesloten items en lege selectie; daarnaast bronfilters, puntgeheugen,
reset, instellingen en Tiqets-boards. 281 lokaal uitvoerbare JavaScript-tests en
29 gerichte DOM-tests slagen. De brede DOM-run telt 109 geslaagde tests; zes tests
kunnen lokaal niet starten door ontbrekende PHP. De laatste productiewijzigingen
zijn opnieuw via de gerichte DOM-suite getest. PHP- en echte browsercontroles
blijven onderdeel van CI; een fysieke iPhone-check is niet uitgevoerd.

Geen implementatie van PostGIS, woordenboeken, gebiedsgeometrie of maximaal 100
winkelpunten: dat zijn afzonderlijke ontwerpvoorstellen. De audit garandeert geen
bereikbaarheid van publieke externe bronnen.
