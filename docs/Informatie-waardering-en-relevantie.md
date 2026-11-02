# Gedeelde waardering en relevantie — 0.3.83

Wikipedia is de eerste adapter op een brononafhankelijke informatielaag. Andere bronnen gebruiken dezelfde API en synchronisatie, zonder een locatie te hoeven hebben. Hun knoppen moeten nog op deze service worden aangesloten.

## Identiteit en context

Een item heeft `{source, id, uri}`. De sleutel bestaat uit bron plus stabiele bronidentifier. Een wisselende weergave-URL is geen identiteit. Wikipedia gebruikt `source: wikipedia`, het Wikidata Q-nummer als `id` en `https://www.wikidata.org/entity/<Q-nummer>` als URI. Taalvarianten delen dus de waardering van hetzelfde onderwerp. De link naar het specifieke Wikipedia-artikel blijft in het kaartobject staan.

Een beheerder kan per item een titel, categorieën en een optionele locatie bewaren, plus `baseRadius`, `maxRadius` (meters, maximaal 100.000) en `weight` (0–1). Dit gebeurt bij Wikipedia via **Relevantie instellen** onder het artikel; alleen zichtbaar voor de bestaande netwerkeigenaar. Andere leden kunnen deze instellingen ook via de API niet wijzigen.

## Actuele waardering

Per bestaande Sharon-identiteit en item staat één record met `opened`, `read`, `liked`, `disliked`. Likes en dislikes sluiten elkaar uit. Intrekken vervangt de vorige stand; herhaalde overdracht telt niet opnieuw. Geopend meet unieke identiteiten, geen aantal sessies. Een eenmaal geopend item blijft geopend. Gelezen, leuk en niet leuk kunnen worden ingetrokken. Verbergen blijft privé op het apparaat.

De server levert totalen, de eigen stand en het relevantiebeleid, nooit de individuele waarderingen van anderen. Waarderingen van ingetrokken netwerkleden tellen niet mee zolang hun toegang is ingetrokken. Er worden geen gebruikerscoördinaten of leestijden toegevoegd.

De huidige gebruikersidentiteit is per installatie. Twee losse installaties zijn nog twee identiteiten; deze wijziging introduceert geen account- of apparaatsamenvoeging.

## Offline en conflicten

IndexedDB bewaart de laatste gewenste stand, een operatie-ID, de verwachte serverversie en de laatst bekende totalen/instellingen. Een atomaire transactie voorkomt dat een vertraagde bevestiging een nieuwere lokale wijziging wist. Bestaande Wikipedia-markeringen worden eenmalig ingevoerd; daarbij worden geen eerdere opens verzonnen.

De server verwerkt onder zijn bestaande bestandslock een vergelijk-en-vervang op de gebruikersversie. Herhaling van dezelfde laatste operatie is idempotent. Een oudere operatie overschrijft geen nieuwere stand. Bij een versieconflict blijft de lokale intentie in de wachtrij en wordt die bij de volgende synchronisatie op de actuele versie toegepast. Bij meerdere schrijvende clients wint daarmee de laatste succesvol gesynchroniseerde intentie, niet de kloktijd van het apparaat.

Verzenden gebeurt direct na aanpassen, bij opnieuw online komen en eenmaal per minuut terwijl de app zichtbaar is, maximaal 30 items per ronde. Zonder geregistreerde netwerkidentiteit blijven wijzigingen lokaal in de wachtrij. Een oude server die de nieuwe acties nog niet kent laat de wachtrij intact. Samenvattingen worden in groepen van maximaal 40 items opgehaald. Oudere samenvattingen mogen recentere itemrevisies niet overschrijven.

## Selectie van wikiboards

Bij de Wikipedia-filters in Omgeving staat **Volgorde van wikiboards**: Nog te ontdekken (bestaande voorkeur), Dichtbij, Relevant en Populair. Deze keuze bepaalt de volgorde van het boarddeck. Bestaande categorie- en statusfilters blijven gelden.

Dichtbij sorteert op afstand tot het kaartmiddelpunt. Relevant en Populair selecteren binnen `min(baseRadius,maxRadius)`. Populariteit is `(leuk - nietLeuk) / (max(geopend, gelezen, leuk + nietLeuk) + 3)`. Relevant voegt de redactionele waardering en nabijheid `1 - afstand / bereik` toe. Er is geen AI en waardering vergroot het ingestelde bereik niet automatisch.

Wikipedia ontdekt op dit moment maximaal 40 artikelen binnen 10 km per kaartaanvraag. Een groter ingesteld bereik maakt reeds ontdekte artikelen op grotere afstand selecteerbaar, maar start nog geen extra zoekaanvragen buiten die 10 km. Een groter ontdekkingsgebied en een zelfstandige ontdekkingsfeed zijn vervolgstappen.

## API en aansluiten van een volgende bron

De bestaande `connections.php` endpoint, `protocol: sharon-network-v1`, JSON POST en `X-Log-Access-Token` worden hergebruikt. Alle drie acties vereisen bestaand netwerklidmaatschap.

- `information-summary`: `{items:[{source,id,uri}]}` → eigen stand, totalen, beleid, context en revisie.
- `information-feedback`: `{item,state,operation,version}` → `{accepted,version,item}`. `operation` is een UUID; `version` de laatst bekende eigen gebruikersversie.
- `information-policy`: `{item,policy,context?}` → `{item}`; alleen netwerkeigenaar.

Een volgende bron maakt een stabiele referentie met `informationReference`, gebruikt `informationFeedback().open(reference)` of `.set(reference,{liked:true})`, haalt samenvattingen op met `.load()` en kan `informationRank` gebruiken voor selectie. `context.location` en de afstandsparameter mogen ontbreken/null zijn. URI's worden uitsluitend als gegevens verwerkt, nooit door de server opgehaald.

## Ingebruikname

1. Merge de PR; de bestaande releaseworkflow controleert en publiceert app 0.3.83.
2. Vervang ook het bestaande bestand op `https://sharon.life/log/api/connections.php` door `server/connections.php` uit dezelfde PR. Laat de private opslag en publicatiesleutel staan. Er is geen database-installatie of handmatige datamigratie nodig.
3. Sluit alle Sharon-vensters en open opnieuw wanneer de update gereed is.
4. Controleer met twee netwerkleden leuk aan/uit en de gezamenlijke teller. Controleer als eigenaar Relevantie instellen en als ander lid de afwezigheid ervan.

Het PHP-bestand wordt niet door GitHub Pages naar de hosting gekopieerd.
