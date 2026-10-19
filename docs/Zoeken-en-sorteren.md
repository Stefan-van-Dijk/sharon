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
