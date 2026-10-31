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

## Analysestraal

Bij de gedeelde boardinstellingen staat een slider van 0 tot 200 kilometer (standaard ∞); de volgende stand is ∞ / Onbeperkt naar buiten. De voorkeur wordt lokaal
bewaard. Bij openen van de boardinstellingen wordt het huidige kaartmiddelpunt vastgezet
als analysecentrum. De selectie blijft op die plek staan tijdens kaartbewegingen
en bladeren. De knop Gebruik huidig kaartmiddelpunt verplaatst de zone expliciet. Het gedeelde deck past
de afstandsselectie ook toe op toekomstige geregistreerde bronnen.

Onbeperkt verwijdert de afstandsgrens voor ontdekte/geladen plekken. Winkels en
Wikipedia behouden ontdekte plekken terwijl andere kaartgebieden worden bezocht.
Dit is geen wereldwijde import: bronverzoeken blijven per gebied maximaal 10 km,
met de bestaande zoom-, bron- en aantallimieten. Een grotere analysestraal vraagt
niet automatisch alle tussenliggende gebieden op. Tiqets blijft een live bron
zonder blijvende catalogus. Categorie- en statusfilters blijven van toepassing.

De analysestraal verschijnt als geodetische cirkel met lichte vulling, stippellijn
en middelpunt op de kaart. Sliderbewegingen werken direct door. Bij 0 km en ∞
blijft het middelpunt zichtbaar, zonder cirkel; 0 km selecteert uitsluitend de
exacte centrumpositie. Het centrum wordt samen met de straal lokaal bewaard.

De straalslider gebruikt de volledige breedte van het instellingenblad en een
ruime aanraakhoogte. Tijdens slepen veranderen de cirkelvoorvertoning en de kaartuitsnede;
bronselecties worden na loslaten bijgewerkt. Toon/Verberg cirkel schakelt uitsluitend
de zichtbaarheid van stip en cirkel (lokaal bewaard), zonder de selectie of camera
te veranderen. Winkelpunten blijven staan tijdens gebiedsverversing en bij fouten;
nieuwe resultaten vervangen ze pas na een geslaagd verzoek. Identieke winkel- en
Wikipedia-kaartgegevens worden niet opnieuw naar de kaart gestuurd.

De straalregel bevat links de middelpuntknop en rechts een cirkelicoon (met streep
wanneer verborgen). Het middelpunt wordt bepaald via de schermpositie in het grootste
vrije kaartvlak, rekening houdend met instellingenblad en kaartbediening. Tijdens
slepen past de kaart zonder animatiewachttijd om de cirkel heen in dat vrije vlak;
bronverzoeken blijven wachten op loslaten. Zichtbaarheid schakelen beweegt de kaart
niet. Bij ∞ blijft de laatst bruikbare uitsnede staan; 0 km zoomt naar het middelpunt.

De winkel- en Wikipediakeuzebladen delen dezelfde vaste responsieve hoogte en
kop-/status-/categorievormgeving. De winkelbron heeft een zoekicoon in de kop om
zoeken uit te klappen; de interne ketenselectie wordt niet meer als dropdown
getoond. Statusknoppen tonen iconen en aantallen, met toegankelijke tekstlabels.
De boardvoet toont bron en categorie op een eigen volle regel. Een geslaagde eigen
waardering geeft geen opslagmelding; fouten blijven zichtbaar en de lokale opslag
en synchronisatie blijven werken.

Bronmenu's sluiten met een tik op de handgreep of een neerwaartse sleepbeweging
vanaf de handgreep. De handgreep heeft een eigen aanraakvlak en ondersteunt pointer,
touch en toetsenbordbediening. Scrollen in de inhoud sluit het menu niet. De losse
pijltjes rechtsboven zijn verwijderd. Het zoekveld gebruikt 16 px tekst en focus
zonder pagina-scroll; een gekozen locatie behoudt het bestaande kaartzoomniveau.

Zonder opgeslagen voorkeur is het boardbereik onbeperkt en de analysecirkel
verborgen. Bestaande expliciete voorkeuren blijven bewaard. Onbeperkt heft alleen
de aanvullende afstandsgrens op: bronpunten, categorie-aantallen en de boardlijst
blijven beperkt tot het huidige kaartvenster. Dit geldt voor winkels, Wikipedia
en het live Tiqets-aanbod, ook wanneer eerder andere gebieden zijn bezocht.
Opgeslagen locaties op de basiskaart staan los van bronselectie, categorieën en
analysestraal; alleen een expliciete persoonlijke verbergkeuze verbergt ze.
In de boardlijst zelf vallen opgeslagen locaties wel onder de actieve selectie.

Bij het openen van een Omgeving-board wordt het huidige kaartgebied automatisch
vastgezet, zonder knop of melding. De gebiedsgrenzen zijn een momentopname en
bewegen niet mee met de kaart tijdens bladeren. Winkel-, Wikipedia- en Tiqets-
gebiedsverzoeken worden onderbroken en blijven gepauzeerd zolang het deck open is.
Alleen details van het geopende board worden geladen; buurartikelen worden niet
meer vooruit geladen. Ook een rechtstreeks geopend opgeslagen-locatiedeck gebruikt
deze gebiedsgrens. Wisselen tussen boardtypen behoudt dezelfde sessie. Na sluiten
stopt een eventuele camera-animatie, wordt de blokkade opgeheven en kan een volgende
kaartbeweging weer brongegevens ophalen. Sluiten alleen start geen zoekopdracht.

## Wereldwijde winkels

De winkelkaart gebruikt `world: true` op de bestaande chains.php API. Een begrensde
Overpass-zoekopdracht haalt winkels en geselecteerde horeca/diensten op, ook zonder
keten of merk. Wereldpunten hebben een stabiele 12-teken identifier op basis van hun
OSM-bronverwijzing, plus naam, positie en winkeltype. Details volgen afzonderlijk
bij openen. De bestaande Nederlandse ketensynchronisatie blijft ongewijzigd.

Gebieden blijven maximaal 1 graad breed/hoog (de app vraagt maximaal 10 km rond
het kaartmiddelpunt). Maximaal 2.000 punten, beperkte responsgrootte, time-outs,
15 minuten gedeelde gebiedscache, één gelijktijdige bronquery en een dagbudget
begrenzen de publieke dienst. Het bestaande vastgezette deck pauzeert ook deze
wereldwijde gebiedsverzoeken. Zelfstandige opgeslagen winkels behouden hun type.

Upload het bijgewerkte server/chains.php naar /log/api/chains.php. De server moet
HTTPS-uitgaand naar de vaste Overpass-bronnen toestaan en schrijfrechten hebben
in /log/private/chains/world-cache. Een mislukte bronvraag wist geen bestaande
lokale locaties. Het is een publieke bron met wisselende beschikbaarheid en dekking.

Bij storing van wereldwijde ontdekking valt de app binnen Nederland terug op het
bestaande winkelregister. Een mislukte wereldvraag krijgt twee minuten rust voordat
opnieuw wordt geprobeerd. Tijdens een geannuleerd gebiedsverzoek wordt geen nieuwe
terugvalvraag gestart. Het wereldgebiedsverzoek wacht maximaal 25 seconden; andere
verzoeken behouden hun eigen limiet. Buiten Nederland wordt een storing niet als een
lege, succesvolle winkelinventaris gepresenteerd. De server onderscheidt wereldbron-
drukte, cacheproblemen en onbereikbaarheid van de Nederlandse registerfout.

De wereldwijde transportlaag gebruikt HTTPS GET met cURL waar beschikbaar en anders PHP-streams. Daarmee is uitgaand POST en `allow_url_fopen` bij beschikbare cURL niet vereist. Beide vaste bronnen krijgen maximaal 10 seconden; de app wacht maximaal 25 seconden zodat de tweede bron kan antwoorden. De laatst geslaagde bron wordt eerst geprobeerd. Bij twee bronfouten blijft wereldwijd een fout zichtbaar: publieke Overpass-beschikbaarheid kan niet worden gegarandeerd.


## Ontdekte punten in sessiegeheugen

Winkel- en Wikipediapunten blijven in het geheugen zolang de app-pagina actief is,
ook bij het opnieuw openen van Omgeving. Het expliciet uitschakelen van een bron
wist de ontdekte punten en gebieden van die bron. Opnieuw inschakelen start een
nieuwe ontdekking; eigen opgeslagen locaties en waarderingen blijven bewaard. Verlaten van het zichtbare
kaartvenster verwijdert geen punten uit de tekenlaag; de kaart knipt deze zelf af.
Categorieën, statusfilters en de ingestelde analysestraal blijven de zichtbaarheid
bepalen. Boardlijsten en aantallen blijven binnen het huidige of vastgezette venster.

Geslaagde ontdekkingsgebieden worden tijdens dezelfde sessie hergebruikt als het
zichtbare gevraagde gebied al volledig gedekt is. Terugkeren vraagt die punten niet
opnieuw. Een afgekapt resultaat wordt alleen voor exact dezelfde zoekvraag hergebruikt;
een nieuwe ketenfilter mag daardoor geen nog niet opgehaalde winkels missen.
Wikipediagebieden met de maximale 40 bronpagina's gelden ook niet als volledig gedekt.
De bestaande requestcache voor details behoudt zijn eigen beperkte levensduur.
Een herladen app-pagina start een nieuwe ontdekkingssessie; dit is geen permanente
opslag van alle bezochte gebieden. Hiervoor verandert chains.php niet.

Bij wereldwijde bronuitval bevat de API nu per vaste bron een beperkte diagnose (timeout, TLS, verbinding, HTTP-status of ongeldig antwoord), zonder serverpaden of ruwe foutinhoud. De gewone appmelding blijft compact.

## Zichtbaar kaartgebied als selectie

De losse zoekgebiedinstelling (analysestraal, middelpunt en cirkel) is verwijderd.
Oude opgeslagen straalvoorkeuren beperken de boardselectie niet meer. Het huidige
kaartvenster bepaalt welke ontdekte boards beschikbaar zijn; een geopend deck houdt
zijn bestaande momentopname. Bronverzoeken blijven begrensd om grote downloads te
voorkomen. Ontdekte punten worden hergebruikt totdat hun bron wordt uitgeschakeld.
De boardvoet toont bron en categorie links onder elkaar en beoordelingen rechts.
