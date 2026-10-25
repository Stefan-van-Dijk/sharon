# Deelstatus bij kaarten en locaties (0.3.100)

Een gekleurd stipje linksboven in de strook laat zien dat een kaart of locatie is gedeeld:

- **Groen — Online**: een tijdelijke QR-deling is door de server bevestigd en nog niet verlopen.
- **Groen — Gedeeld**: de kopie is via een chat door de server bevestigd. Het deelvenster toont het tijdstip van die bevestiging; dit is geen voortdurende controle van het chatbestand.
- **Oranje — Controleren**: de opslag of bereikbaarheid is niet bevestigd. Een netwerkfout betekent niet dat het bestand verwijderd is.
- **Grijs — Offline**: de QR-deling is verlopen of de server geeft aan dat het bestand niet meer beschikbaar is. De app kan opgehaald en handmatig verwijderd niet onderscheiden.

Veeg de strook naar rechts voor de details en om een bestaande QR opnieuw te tonen. Dit maakt geen tweede bestand. Een meegestuurde locatie krijgt ook een deelkenmerk. De QR bij het opnieuw delen van die locatie blijft een zelfstandige locatiedeling; een QR van de bovenliggende kaart wordt daar niet voor hergebruikt.

De bronverwijzingen en sleutels blijven op het apparaat. Uitgaande chatberichten behouden de bronverwijzing bij synchronisatie. De QR-status wordt bij openen van het deelvenster gecontroleerd via het bestaande share-read-endpoint. Bij het openen van een lijst worden bekende QR-delingen opnieuw gecontroleerd wanneer de laatste controle langer dan een minuut geleden is; er is geen nieuwe periodieke achtergrondpolling. Lijsten blijven tijdens de netwerkcontrole bedienbaar.

Er is geen nieuw PHP-bestand nodig. Historische QR-delingen kunnen niet automatisch worden gekoppeld aan een bronitem: eerdere releases hebben die relatie niet opgeslagen. Er worden geen relaties geraden op basis van een naam of de inhoud. De nieuwe kenmerken worden bijgehouden voor delingen vanaf deze versie. Ontvangers krijgen geen informatie over met wie de afzender verder heeft gedeeld.

De deling is een kopie. Een wijziging aan de lokale kaart past een eerder verzonden kopie niet automatisch aan.

## Beheerdersrol

Instellingen → Netwerkverbinding toont de laatst bekende rol van de netwerkidentiteit op dit toestel: Beheerder, Deelnemer of geen toegang. Met Rol controleren wordt de actuele rol opgehaald via het bestaande self-endpoint. Beheerder betekent netwerk-eigenaar (line 0), toegekend bij het claimen van de startcode. De server controleert information-policy tegen ownerId; je profielnaam verleent geen rechten. De app kan deze rol niet zelf toekennen. Bij een mislukte controle wordt de cache als laatst bekende rol aangeduid.

## Deelboard vanaf 0.4.02

Het deelvenster gebruikt de gedeelde boardstapel. Bovenaan staat de kaarttitel; naast de QR staan verticaal Deel kaart en Scan in Sharon. Locatie meesturen geldt nu voor zowel QR als chatbericht. Bij het wijzigen wordt een nieuwe QR aangemaakt en de vorige via het bestaande deelprotocol ingetrokken; een mislukte intrekking wordt expliciet vermeld. Na verzending blijft de keuze vergrendeld zodat een herhaalde verzendpoging dezelfde inhoud behoudt. Heropenen laat de eerder gekozen QR-locatiekeuze zien.

De samenvatting is standaard zichtbaar. Deel met personen klapt de personenkeuze open. Maximaal zes suggesties worden getoond: contacten gekoppeld aan de kaart of haar locatie eerst, daarna recente contacten. Zoeken doorzoekt alle contacten, ongeacht de suggestielimiet. Dit gebruikt bestaande lokale relaties en activiteit, zonder extra GPS-tracking.
