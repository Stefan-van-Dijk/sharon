# Zoeken, sorteren en objectstroken — v0.3.67

Kaarten, Locaties en de bestaande proefmodules gebruiken `renderObjectStrip` als gedeelde objectstrook. Een gekleurde rand beweegt mee met de strook; het icoon staat gecentreerd in een gekleurd vak. Titel, subtitel, afronding en hoogte volgen dezelfde opmaak. Links vegen toont Bewerk en Verwijder (of Archiveer/Herstel volgens de module). Tikken opent het item in de betreffende module. Een tweede strook openen of buiten de strook tikken sluit de eerste; rechts vegen sluit geopende acties. Een rechtswaartse veeg op een gesloten strook blijft beschikbaar voor navigatie naar Home. Verticaal scrollen blijft vrij.

Locaties heeft nu ook Bewerk direct achter de lijststrook. Deze actie opent de bestaande locatie-editor. Onderliggende locaties behouden hun hoofdlocatie en eigen sortering blijft beperkt tot dezelfde groep. Handgrepen blijven uitsluitend de eigen volgorde bedienen; ze openen geen object en tonen geen swipeacties.

Nieuwe modules met objectlijsten gebruiken dezelfde component. Modules zonder gegevenslijst krijgen hiermee geen extra functies. Detail- en invoerstroken houden hun eigen acties, zoals de zinnenbibliotheek. De gedeelde swipebediening herstelt de beginstand bij annuleren en verwijdert bij afsluiten alle listeners, zodat opnieuw binden geen dubbele acties veroorzaakt.

De kaartbalk is nu een gedeelde component voor modulelijsten: zoekveld, Recent, A–Z, Dichtbij waar locatiegegevens van toepassing zijn, en Eigen volgorde.

Kaarten en Locaties gebruiken de balk in de reguliere omgeving en de testomgeving. De bestaande proeflijsten voor Personen, Objecten, Ritten, Tijd en Acties gebruiken dezelfde component. Nog niet uitgewerkte modules zonder gegevenslijst krijgen geen schijnfunctionaliteit.

Vanaf v0.3.63 toont Eigen volgorde een handgreep met drie lijntjes rechts in iedere strook. Pak de handgreep vast en sleep de strook naar de gewenste plek. Een invoeglijn toont de doelpositie; bij de schermrand schuift de lijst mee. De volgorde en gekozen sortering worden per module lokaal opgeslagen; wisselen naar A–Z of Recent verwijdert de eigen volgorde niet. Testvoorkeuren blijven apart van persoonlijke voorkeuren. Bij Locaties werkt slepen alleen binnen dezelfde hoofdlocatie; sublocaties behouden hun ouder. Met een toetsenbord kun je op de handgreep omhoog/omlaag gebruiken.

Zoeken blijft actief bij wisselen van sortering. Bij het vinden van een sublocatie blijft de hoofdlocatie zichtbaar. Kaarten doorzoekt ook pascode en gekoppelde locatienaam. Afstandssortering gebruikt de centrale locatievoorziening en vraagt geen eigen GPS-tracking aan.

Recent kan ISO-datums en numerieke tijdstempels vergelijken. Nieuwe en gewijzigde proefobjecten krijgen hiervoor tijdstempels. Oude objecten zonder datum vallen terug op alfabetische volgorde.

Controle op toestel: kies Eigen volgorde, verplaats een strook, wissel naar A–Z en terug, verlaat het onderdeel en open het opnieuw. Controleer ook de breedte van de balk op een smalle telefoon.

## Personen — v0.3.77

De reguliere Personenlijst gebruikt dezelfde zoek- en sorteerbalk als Kaarten:
zoeken op contactnaam, Recent, A–Z en Eigen volgorde. Recent gebruikt de laatste
lokaal bekende berichtactiviteit, contactwijziging of aanmaakdatum. Zonder datum
valt de volgorde terug op de naam. De sortering en eigen volgorde worden apart
van de testomgeving bewaard. De zoektekst blijft tijdens sorteren en terugkeren
vanuit een chat of contactbewerking behouden. Ongelezen meldingen en swipeacties
blijven beschikbaar. Dichtbij is niet beschikbaar zonder persoonslocaties.

Bij de kaart- en locatie-editor staat de optionele keuze **Personen koppelen**.
Je kunt meerdere bestaande contacten zoeken, aanvinken en later ontkoppelen.
De selectie wordt met het object opgeslagen als `personIds`; Annuleren verandert
niets. Hernoemen van een contact verandert de identifier niet. Bij Personen →
Bewerk verschijnen de gekoppelde kaarten en locaties, die je kunt openen.
Koppelen geeft geen toegang en verstuurt geen gegevens naar de server of in een
kaart-QR. Een niet meer beschikbaar contact blijft herkenbaar als ontbrekende
koppeling en kan worden ontkoppeld. Locaties samenvoegen bewaart beide selecties.

De gedeelde component `PersonLinks.js` kan worden aangesloten op toekomstige
objecteditors. Ritten, Tijd, Objecten, Acties en Thema's hebben in de reguliere
omgeving nog geen objecteditor. Hun bestaande testgraph blijft gescheiden van
persoonlijke gegevens. Kaarten en Locaties gebruiken in de testomgeving dezelfde
keuze met fictieve personen en relaties uit die graph, met behoud van bestaande
relatie-identifiers.

## Personen op locatie — v0.3.78

Personen heeft nu ook **Dichtbij**, via de gekoppelde locaties (`location.personIds`).
Per persoon telt de kleinste afstand tot een gekoppelde locatie met eigen of
geërfde GPS. Personen zonder bekende positie volgen achteraan. De centrale
locatievoorziening controleert de huidige positie op verzoek, zonder extra
volgproces. Als een koppeling of locatietoegang ontbreekt, volgt een gerichte
melding en blijft de vorige sortering actief. De gekoppelde locatienamen staan
in de persoonsstrook en worden ook doorzocht. Zonder bekende actuele positie
valt een bewaarde afstandssortering bij openen terug op A–Z.
