# Winkelgegevens per bestaande viertekens-ID — 0.4.71

`chains.php` is ongewijzigd. De bestaande Omgeving-endpoint
`/environment/api/tiles.php` krijgt twee winkelacties: `shops-read` en
`shops-refresh`. Plaats daarvoor `server/environment.php` op die bestaande URL.
Er is geen nieuwe endpoint of nieuw identifiersysteem nodig.

De opslag staat in `/environment/shops/<viertekens-ID>.json`. De viertekens-ID
wordt met dezelfde bestaande hiërarchische codering bepaald. Records behouden
hun winkel-ID, keten-ID, naam, coördinaten, bronreferentie en categorie. De bron
is OpenStreetMap; attributie en ODbL staan in het bestand. Privégegevens,
personen, beoordelingen en de tijdelijke deelfunctie worden niet gebruikt.

Per bestand worden de succesvol doorzochte deelrechthoeken bewaard. Een
klein kaartvak maakt dus niet de volledige viertekens-cel compleet. Ook lege,
volledig gecontroleerde vakken blijven bekend. Na twee kalendermaanden wordt
zo'n controle opnieuw nodig. Mislukte of afgebroken bronverzoeken schrijven
niets; afgekapt resultaat vult punten aan maar vernieuwt de succesvolle
controledatum niet. Ontbrekende winkels worden niet zomaar verwijderd.

De app leest eerst de opgeslagen punten. Verouderde punten worden onmiddellijk
getoond terwijl een achtergrondcontrole loopt. Succes daarvan laat de actieve
kaart opnieuw lezen. Een enkele winkelreset gebruikt de opslag opnieuw; twee
resets binnen vijf seconden vragen een verversing aan. Die bewust aangevraagde
verversing geldt voor één zoekronde, niet voor iedere latere kaartverplaatsing.
De bestaande bronservice kan een antwoord nog maximaal vijftien minuten
hergebruiken; dubbel verversen omzeilt haar bronbescherming niet.

Voor het ophalen en voor stabiele item-ID's hergebruikt de Omgeving-route de
reeds geïnstalleerde `/log/api/chains.php` als PHP-bibliotheek. Dit bestand hoeft
niet opnieuw te worden geplaatst. Ook bestaande succesvolle broncache-antwoorden
kunnen zo in gebiedsopslag worden overgenomen. Als de Omgeving-route nog niet
is bijgewerkt, blijft de bestaande winkelroute als terugval bestaan.

Een eerste vulling vereist nog steeds bereikbare brongegevens. Deze opslag
verhelpt een storing bij Overpass niet; ze zorgt dat eenmaal opgehaalde gegevens
blijvend bruikbaar zijn en niet bij ieder bezoek opnieuw worden opgevraagd.

Bewaar bij uitrol de bestaande gebiedsbestanden en de identity-ledgers.
