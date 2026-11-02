# Tiqets als zelfstandige live bron

## Gedrag in Sharon

Omgeving heeft naast Wikipedia een Tiqets-bronknop. Na activering zoekt de
bron op kaartcentrum binnen vijf kilometer, vanaf zoomniveau 11. De kaartpositie
is niet noodzakelijk de actuele GPS-positie: de gebruiker kan elders kijken.
De eerste 50 dichtstbijzijnde ticketproducten worden opgehaald; dit is geen
volledige inventaris van alle locaties in het gebied.

Producten met dezelfde venue-ID worden als één locatie weergegeven. Een board
bevat de afzonderlijke ticketopties als hoofdstukken; de bronknop verwijst naar
de affiliate-URL van het actieve hoofdstuk. Tekst wordt als tekst weergegeven,
zonder HTML-injectie. Alleen geldige coördinaten, beschikbare producten en
Tiqets-links met partnerverwijzing komen door de adapter. Ontbrekende foto’s
blijven een tekstboard met titel. Fotocredits blijven bij de getoonde afbeelding.

Er is geen koppeling met personen, uitnodigingen of het netwerk voor de eerste
100 deelnemers. Productdata wordt alleen tijdelijk in het geheugen gehouden.
Geen IndexedDB, localStorage of offlinecatalogus voor Tiqets. Nieuwe aanvragen
gebruiken no-store. Bij kaartverplaatsing, uitzetten of fout verdwijnen eerdere
kaartresultaten. De gezamenlijke board-layoutvoorkeur blijft bestaande werking.

De server ontvangt alleen kaartcentrum en taal via POST. Er worden geen
persoonsidentifiers, profielen of uitnodigingsgegevens meegestuurd. Er worden
geen applicatielogs of locatiegeschiedenis geschreven. Normale hostinglogs en
de gegevensverwerking bij Tiqets vallen onder de eigen hosting- en partnerafspraken.
Klikken worden niet door een eigen analyticsdienst geregistreerd; boekingsrapportage
loopt via Tiqets.

## Activeren op de bestaande PHP-host

De frontend wordt via GitHub Pages gepubliceerd. PHP kan daar niet draaien:
plaats `server/tiqets.php` afzonderlijk op de bestaande PHP-host als
`https://sharon.life/sources/tiqets.php`.

Stel in de hostingomgeving in, buiten Git en buiten de openbare webbestanden:

- `SHARON_TIQETS_TOKEN`: geheime API-token van het goedgekeurde partneraccount.
- `SHARON_TIQETS_PARTNER`: exact de publieke partnercode uit de productlinks
  die dit token oplevert. Afwijkende links worden niet doorgegeven.
- `SHARON_TIQETS_ENABLED=1`: pas na bevestiging dat Sharon als app/website
  onder de partnerafspraken mag publiceren.
- `SHARON_TIQETS_IMAGES=1`: uitsluitend als Tiqets afbeeldingstoegang heeft
  ingeschakeld en het gebruik in Sharon is toegestaan; standaard uit.

Vereisten: PHP 8.1+ met cURL en JSON, HTTPS, geldige certificaten en toestemming
voor uitgaande HTTPS naar api.tiqets.com. De status-GET geeft alleen
`configured: true/false`; nooit een token. De knop blijft uitgeschakeld als de
endpoint ontbreekt of de configuratie niet actief is. Status bevestigt configuratie,
niet of het token door Tiqets wordt geaccepteerd. De eerste echte aanvraag test dat.

Er is een centrale limiet van 60 aanvragen per minuut per PHP-host, zonder
IP-adressen op te slaan. Deze limiet is geen authenticatie; het is een begrenzing
van het publieke, alleen-lezen bronendpoint. Geen algemene URL-proxy, redirects,
boekingen of betalingen. De browser mag GET, POST en OPTIONS gebruiken vanuit
GitHub Pages, sharon.life en www.sharon.life. Wijzig de oorsprongen bij een
ander domein. Plaats de API-token nooit in JavaScript, uitnodigingslinks of chat.

## Inhoud en gebruiksrechten

De Essential API bevat niet standaard alle afbeeldingen en lange beschrijvingen.
Deze integratie gebruikt alleen teruggegeven samenvatting/tagline, adres en
ticketinformatie; geen gescrapete webteksten. Alleen cdn.tiqets.com-afbeeldingen
worden ondersteund, met credit. Als het account andere officiële beeldhosts
oplevert, beoordeel die voordat de allowlist wordt uitgebreid.

Producten met AD_CONTENT-, KEYWORD-, TARGETING- of onbekende beperkingen worden
voor deze eerste integratie weggelaten. Alleen beperkingen specifiek voor Google
Things To Do worden hier niet als blokkade behandeld. Dit vervangt geen
bevestiging van Tiqets dat Sharon’s presentatie en locatiegebruik zijn toegestaan.

Er worden geen prijzen of gegarandeerde beschikbaarheid op een gekozen datum
getoond. `sale_status=available` betekent alleen dat verkoop niet is stopgezet;
de gebruiker bekijkt de actuele datum/tickets op Tiqets. Alleen een goedgekeurde,
toegerekende boeking kan commissie opleveren.

## Verificatie

Unit-/adaptertests controleren grouping, URL’s, coördinaten, ontbrekende
afbeeldingen, uitschakelen tijdens laden, foutafhandeling, PHP-syntax,
upstreamparameters en het buiten de respons houden van geheimen.
Een DOM-integratietest opent de echte gebouwde BoardViewer met Tiqets-data en
controleert link, commerciële bronvermelding en credits zonder Wikipedia-opvraag.

Nog te bevestigen met het echte account en de productiehost: accounttoelating,
geldige token, partnercode, afbeeldingstoegang, live catalogusrespons, CORS en een
end-to-end klik die correct in het Tiqets-portaal wordt toegerekend. Tests met
fixtures bewijzen geen werkende live affiliateverbinding.

Officiële bronnen:
- https://developers.tiqets.dev/getting-started/performing-your-first-api-call
- https://developers.tiqets.dev/basics/openapi/content-api
- https://developers.tiqets.dev/basics/openapi/content-api/products/get-single-product
- https://developers.tiqets.dev/integration-guides/product-integration/how-to-comply-with-marketing-restrictions
- https://portals.tiqets.com/static/distributorapi/postman/Tiqets%20Distributor%20API%20-%20Postman%20Collection.json

## Verbinding met Kaarten

Een expliciete knop 'Bewaar bij Kaarten' bewaart de geselecteerde ticketoptie
als persoonlijke ticketverwijzing met een eigen vaste identifier. Bekende
Tiqets-locaties worden op provider/place-ID hergebruikt; er wordt niet op
vergelijkbare namen gegokt. Met geldige broncoördinaten krijgt de verwijzing
automatisch een gekoppeld locatieobject. Zonder coördinaten kan zij zelfstandig
bestaan. Testmodus gebruikt dezelfde bestaande opslagadapter en blijft gescheiden.

Herhaald bewaren levert dezelfde kaart op. Bestaande naam, locatiekoppeling en
later toegevoegde ticketcode worden niet overschreven. De broncatalogus wordt
hiermee niet lokaal gekopieerd: alleen de expliciet bewaarde titel, bronlink,
productreferentie en locatie worden onderdeel van de persoonlijke kaarten.

Een verwijzing bevat geen QR/barcode en is geen toegangsbewijs. Kaarten toont
'Verwijzing' zolang er geen code is toegevoegd. De gebruiker kan na aankoop
de echte ticketcode via de bestaande kaarteditor invoeren of scannen.
De affiliate-URL wordt nooit als toegangscode gerenderd. De bron blijft vanuit
de kaart bereikbaar als herkenbare affiliatelink.

Een affiliateboekingslink geeft Sharon niet automatisch het gekochte ticket
terug. Automatische ontvangst vereist een afzonderlijke toegestane integratie;
deze wijziging belooft geen toegang tot affiliateklantboekingen of tickets.
