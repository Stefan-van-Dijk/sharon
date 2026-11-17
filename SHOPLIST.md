# Shop vanuit Sharon

Shop blijft één zelfstandige app met eigen vormgeving, productbediening, camera en kassabarcodes. Sharon toont lijstoverzichten en beheert kiezen, verwijderen, archiveren en delen. Nieuwe lijsten maken blijft in Shop mogelijk, ook vanuit Sharon.

## Openen en terugkeren

`/shop/?shoplist=<id>&from=sharon` opent de gekozen lijst in compacte stand. Optioneel `view=collect` opent Verzamelen; standaard opent Afstrepen. Zonder `from=sharon` behoudt Shop zijn zelfstandige interface. Deze parameters verlenen geen rechten; het bestaande apparaattoken en servercontroles blijven gelden. Geen toegangssleutels in URLs.

Sharon gebruikt in het volledige board een iframe met de echte Shop-app en toestemming voor camera en microfoon. De Shop-knop opent hetzelfde in-app-venster; alleen de expliciete installatiehulp opent extern. Het hele lijstcontextblok is in compacte stand verborgen. Nieuwe lijst en productbeheer blijven via het Shop-menu bereikbaar. Een nieuwe lijst wordt actief en synchronisatie wordt meteen aangevraagd.

Terug binnen het board gebruikt `postMessage({type:'shop:return'})` naar de vaste GitHub Pages-origin. Sharon accepteert alleen berichten van het gemonteerde iframe met de verwachte origin, herstelt het bestaande board en ververst het lijstoverzicht. Terug vanuit een apart tabblad opent de Sharon-startpagina; die route herstelt geen boardpositie.

Tot de aangevraagde lijst geladen is blijft de inhoud niet bedienbaar. Een fout biedt opnieuw proberen; lokale gegevens worden behouden. Rechtenverlies kiest in compacte stand geen willekeurige andere lijst. Synchronisatie en conflictbehoud gebruiken de bestaande Shop-logica.

## Gezamenlijke levering en controle

Publiceer eerst de bijbehorende Shop-wijziging, daarna Sharon 0.4.97. De bestaande koppelserver blijft vereist; deze wijziging wijzigt geen serverprotocol of opgeslagen gegevens.

Controleer voor publicatie op iPhone/Safari en geïnstalleerde Sharon: geselecteerde lijst, Verzamelen/Afstrepen, nieuwe lijst, synchronisatie bij terugkeer, camera, microfoon bij kassabediening, offline wijzigingen, ingetrokken toegang en herstel van conflicten. De in-app-sessie gebruikt de Sharon-identiteit en heeft geen zelfstandige Shop-koppeling nodig.

## Automatische in-app-sessie (0.4.97)

Bij openen in een iframe gebruikt Shop een beperkte berichtenverbinding met Sharon. Elke aanvraag en elk antwoord controleert origin en venster. Sharon houdt zijn apparaatsleutel zelf en voert de bestaande serveraanvragen uit. Alleen de geselecteerde lijst, nieuw aangemaakte lijsten en de eigen Shop-catalogus zijn beschikbaar. Kiezen, verwijderen, archiveren en delen blijven host-acties. Een gewijzigde Sharon-identiteit beëindigt de bruikbaarheid van de sessie. Sluiten verwijdert de host-listener.

De URL bevat uitsluitend context: `account` (niet-geheim identiteit-ID voor opslagisolatie), `shoplist`, `from` en optioneel `view`. Shop controleert dat `account` overeenkomt met de identiteit uit de sessie. Lokale in-app-gegevens staan onder een aparte sleutel per identiteit en openingslijst; bestaande `bs.app.v1`-gegevens en de zelfstandige apparaatsleutel worden niet gelezen of vervangen. De sessie maakt geen permanente Shop-installatiekoppeling aan.

Openen via Apps gebruikt dezelfde in-app-route zonder vooraf gekozen lijst; Verzamelen en Nieuwe lijst zijn beschikbaar. Het lijsticoon in een board opent de geselecteerde lijst binnen Sharon en maakt geen extern browservenster.
