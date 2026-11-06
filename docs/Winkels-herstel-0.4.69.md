# Wereldwijde winkelroute — 0.4.69

## Aangetroffen

De live PHP-route voor Antwerpen gaf HTTP 503 met een time-out bij
private.coffee en een ongeldig antwoord bij overpass-api.de. De directe GET-route
gaf tijdens de controle HTTP 406. Een afzonderlijke POST naar private.coffee
leverde op 6 november 2026 762 echte OSM-winkelobjecten voor
[4.395,51.215,4.415,51.225], waaronder Elisa Pralines (node/401309938, geen
ketenkoppeling) en HEMA (node/7340616847, Q903805). Latere live verzoeken vanuit
de testomgeving liepen opnieuw vast; ook een proxy-CONNECT-time-out is vastgesteld.
Dit is bewijs van beschikbare brongegevens, niet van een al herstelde live app.

## Wijziging

- PHP gebruikt form-POST in plaats van GET, zowel met cURL als PHP streams.
- Alleen expliciete HTTP 405/415 leidt tot één GET-terugval. Een 406/429 wordt
  niet direct opnieuw op dezelfde bron geprobeerd.
- cURL decodeert gecomprimeerde antwoorden; TLS-controle, bytegrens en
  redirectblokkade blijven behouden.
- Verbindingstijd maximaal 8 seconden, totaal per serverbron maximaal 28 seconden.
  De app geeft de server maximaal 60 seconden (twee bronnen), en een directe
  bronpoging heeft daarna een eigen budget van 28 seconden.
- De directe appbron gebruikt private.coffee met POST en verzendt alleen de
  site-origin als verwijzer. Zij bevat dezelfde winkel/horecaselectie als PHP.
- Een server-time-out blokkeert de directe poging niet meer. Een bewuste
  annulering door kaartverplaatsing stopt de keten wel.

Geen persoonlijke opslag wordt gereset; bestaande identifiers en bronreferenties
blijven intact.

## Plaatsen en hertesten

De Pages-build bevat de appwijziging, maar publiceert de PHP-server niet.
Plaats ook `server/chains.php` uit deze versie op de bestaande host als
`/log/api/chains.php`. Bewaar vooraf de huidige PHP-versie. Laat
`private/chains`, de identities, het register en gebruikersgegevens staan.

Controleer daarna in Antwerpen: alle winkels, HEMA-filter, details van Elisa
Pralines en HEMA, kaartverplaatsing en annuleren. Een geslaagde unit-/fixturetest
is geen bewijs van bereikbaarheid vanaf de productiehost. Bij voortdurende
bronuitval moet de hostverbinding verder worden onderzocht; geen lege dekking
als geslaagde zoekactie opslaan.
