# Shop koppelen — 0.4.80

Upload `server/connections.php` naar `/log/api/connections.php` op sharon.life.
Behoud de bestaande configuratie en private gegevens; geen reset of migratie
van bestaande identiteiten, chats of lijsten is nodig. GitHub Pages publiceert
alleen de webapp en voert deze serverupdate niet uit.

In Notities en lijsten staat Shop verbinden. Maak een code, plak die in Shop
onder het beheerlogo, vernieuw de koppelweergave in Sharon en bevestig de gelijke
controlecode. Shop controleert daarna expliciet de verbinding. De tijdelijke
code is vijf minuten geldig en aan één Shop-sleutel gebonden. Mislukte antwoorden
kunnen met dezelfde sleutel veilig opnieuw worden opgevraagd.

Iedere Shop heeft een eigen beperkte sleutel. Chats, contacten, uitnodigingen,
netwerkbeheer en deelrechten zijn daarmee niet toegankelijk. Lijsttoegang blijft
afhankelijk van eigenaar/lid en rol; koppelen publiceert geen lokale lijsten.
Intrekken in Sharon of loskoppelen in Shop blokkeert de sleutel op de server.
Intrekken wist geen eerder lokaal opgeslagen lijsten. Browseropslag blijft
belangrijk: exporteer eigen lijsten als back-up voordat browserdata wordt gewist.

Bestaande Shop-installaties behouden hun lijsten maar moeten eenmalig koppelen.
Er worden geen permanente Sharon-sleutels automatisch uit browseropslag gekopieerd.
De endpoint-URL staat vast; een geplakte code kan geen andere server aanwijzen.
Verschillende browsers en toegestane origins werken; onbekende hostingdomeinen
vereisen expliciete toevoeging aan de bestaande CORS-configuratie.
