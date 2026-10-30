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
