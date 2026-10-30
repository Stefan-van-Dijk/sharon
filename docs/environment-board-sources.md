# Gezamenlijk Omgeving-deck

Alle ingeschakelde bronnen leveren hun gefilterde boards aan `EnvironmentBoardSources`.
De gedeelde volgorde (Nog te ontdekken, Dichtbij, Relevant, Populair) geldt voor de
gehele selectie. Horizontaal bladeren gaat over bronovergangen heen. Het middelpunt
voor de afstandssortering blijft tijdens het bladeren gelijk.

De bestaande bronnen zijn Wikipedia, winkels/opgeslagen locaties en Tiqets. Een
nieuwe bron wordt in EnvironmentMapLibre geregistreerd met dezelfde interface:

- `getBoards()` geeft uitsluitend de ingeschakelde, toegestane selectie terug.
- `openBoard(board, {onNext, onPrevious})` is optioneel voor een eigen boardweergave.
  Die weergave gebruikt de aangeleverde navigatie voor het gezamenlijke deck.
- `handles(event)` voorkomt dat een kaartklik op die bron door de algemene
  kaartafhandeling wordt gesloten.

Bronnen behouden hun eigen gegevensopslag, filters en detailverzoeken. Nieuwe
bronnen moeten deze interface gebruiken; voeg geen eigen brongebonden bladerlijst toe.
Het deck maakt bij openen een momentopname, zodat kaartbewegingen of asynchrone
bronverversingen de volgorde tijdens het bladeren niet laten verspringen. Bij
opnieuw openen worden actuele bronselecties en filters toegepast. Een wijziging van
de gedeelde sortering wordt bij de volgende swipe toegepast. Extra websites binnen
een uitgeklapt locatiedeck blijven bij die locatie horen.

## Winkelcategorieën

De winkelbron gebruikt `ChainCategories` voor een vaste, uitbreidbare indeling op
basis van het beschikbare OSM-winkeltype in de ketencatalogus. Een vestigingstype,
indien beschikbaar, gaat voor. De kleine offline catalogus heeft voor generieke
winkeltypen expliciete categorieën; onbekende typen vallen onder Overig. Eigen
locaties zonder ketenkoppeling hebben een aparte categorie. Er worden geen extra
vestigingsdetails opgehaald om het filter te vullen.

Het winkelpaneel gebruikt dezelfde categorie- en statusselectie als Wikipedia:
meerdere selecties vormen een vereniging; zonder selectie worden verborgen items
uitgesloten. Categorieën tonen aantallen en feedback binnen de opgehaalde selectie,
niet een onbevestigd landelijk totaal. De voorkeur wordt lokaal bewaard. Dezelfde
selectie stuurt kaartpunten, de locatielijst en het gezamenlijke deck.
