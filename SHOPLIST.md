# Shop vanuit Sharon

Shop blijft één zelfstandige app met eigen vormgeving, productbediening, camera en kassabarcodes. Sharon toont lijstoverzichten en beheert kiezen, verwijderen, archiveren en delen. Nieuwe lijsten maken blijft in Shop mogelijk, ook vanuit Sharon.

## Openen en terugkeren

`/shop/?shoplist=<id>&from=sharon` opent de gekozen lijst in compacte stand. Optioneel `view=collect` opent Verzamelen; standaard opent Afstrepen. Zonder `from=sharon` behoudt Shop zijn zelfstandige interface. Deze parameters verlenen geen rechten; het bestaande apparaattoken en servercontroles blijven gelden. Geen toegangssleutels in URLs.

Sharon gebruikt in het volledige board een iframe met de echte Shop-app en toestemming voor camera en microfoon. De externe app-link blijft beschikbaar. Lijstkiezer en verwijderen zijn in compacte stand verborgen; productbeheer blijft via het menu bereikbaar. Een nieuwe lijst wordt actief en synchronisatie wordt meteen aangevraagd.

Terug binnen het board gebruikt `postMessage({type:'shop:return'})` naar de vaste GitHub Pages-origin. Sharon accepteert alleen berichten van het gemonteerde iframe met de verwachte origin, herstelt het bestaande board en ververst het lijstoverzicht. Terug vanuit een apart tabblad opent de Sharon-startpagina; die route herstelt geen boardpositie.

Tot de aangevraagde lijst geladen is blijft de inhoud niet bedienbaar. Een fout biedt opnieuw proberen; lokale gegevens worden behouden. Rechtenverlies kiest in compacte stand geen willekeurige andere lijst. Synchronisatie en conflictbehoud gebruiken de bestaande Shop-logica.

## Gezamenlijke levering en controle

Publiceer eerst de bijbehorende Shop-wijziging, daarna Sharon 0.4.96. De bestaande koppelserver blijft vereist; deze wijziging wijzigt geen serverprotocol of opgeslagen gegevens.

Controleer voor publicatie op iPhone/Safari en geïnstalleerde Sharon: geselecteerde lijst, Verzamelen/Afstrepen, nieuwe lijst, synchronisatie bij terugkeer, camera, microfoon bij kassabediening, offline wijzigingen, ingetrokken toegang en herstel van conflicten. Browseropslag in het iframe moet dezelfde gekoppelde Shop-installatie bereiken; bij ontbrekende toegang blijft opnieuw koppelen of extern openen nodig.
