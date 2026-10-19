# Zoeken en sorteren — v0.3.62

De kaartbalk is nu een gedeelde component voor modulelijsten: zoekveld, Recent, A–Z, Dichtbij waar locatiegegevens van toepassing zijn, en Eigen volgorde.

Kaarten en Locaties gebruiken de balk in de reguliere omgeving en de testomgeving. De bestaande proeflijsten voor Personen, Objecten, Ritten, Tijd en Acties gebruiken dezelfde component. Nog niet uitgewerkte modules zonder gegevenslijst krijgen geen schijnfunctionaliteit.

Vanaf v0.3.63 toont Eigen volgorde een handgreep met drie lijntjes rechts in iedere strook. Pak de handgreep vast en sleep de strook naar de gewenste plek. Een invoeglijn toont de doelpositie; bij de schermrand schuift de lijst mee. De volgorde en gekozen sortering worden per module lokaal opgeslagen; wisselen naar A–Z of Recent verwijdert de eigen volgorde niet. Testvoorkeuren blijven apart van persoonlijke voorkeuren. Bij Locaties werkt slepen alleen binnen dezelfde hoofdlocatie; sublocaties behouden hun ouder. Met een toetsenbord kun je op de handgreep omhoog/omlaag gebruiken.

Zoeken blijft actief bij wisselen van sortering. Bij het vinden van een sublocatie blijft de hoofdlocatie zichtbaar. Kaarten doorzoekt ook pascode en gekoppelde locatienaam. Afstandssortering gebruikt de centrale locatievoorziening en vraagt geen eigen GPS-tracking aan.

Recent kan ISO-datums en numerieke tijdstempels vergelijken. Nieuwe en gewijzigde proefobjecten krijgen hiervoor tijdstempels. Oude objecten zonder datum vallen terug op alfabetische volgorde.

Controle op toestel: kies Eigen volgorde, verplaats een strook, wissel naar A–Z en terug, verlaat het onderdeel en open het opnieuw. Controleer ook de breedte van de balk op een smalle telefoon.
