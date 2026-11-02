# Sharon — Boards en gekoppelde webbronnen

Status: functioneel ontwerp; nog niet geïmplementeerd. Vastgelegd 14 oktober 2026.

## 1. Boards: verbeteringen

- **Positie:** op mobiel het volledige board verticaal kunnen verplaatsen, met behoud van afzonderlijke instelbaarheid van fotohoogte, teksthoogte en totale kaarthoogte via de bestaande twee schuiven. Op desktop ook horizontale plaatsing (links, midden, rechts) en verticale plaatsing (boven, midden, onder). Achterliggende kaarten volgen dezelfde verplaatsing. De bestaande swipe naar beneden om te sluiten en links/rechts voor navigatie mogen niet conflicteren met verplaatsen.
- **Voorladen:** laad de vorige en volgende board inclusief tekst en afbeeldingen vooraf; voorkom onnodige downloads, respecteer netwerk- en geheugenbeperkingen en annuleer verouderde verzoeken. Test snel achtereen swipen.
- **Kompas:** onthoud binnen de sessie dat de gebruiker het kompas heeft ingeschakeld; houd de weergave actief over boardwisselingen heen. Vraag apparaattoestemming alleen waar nodig; respecteer ingetrokken toestemming en browserbeperkingen.
- **Architectuur:** hergebruik centrale technische services waar zinvol, maar houd boardconfiguratie en modulelogica gescheiden. Bewaak mobiele en desktopinteractie en regressietests.

## 2. Webpagina aan locatie koppelen

De bestaande willekeurige locatie-identifier blijft ongewijzigd. Leg een aparte relatie vast met minimaal: relatie-ID, locatie-ID, canonieke bron-URL, zichtbaarheid (privé/gedeeld), aangemaakt-door, datum, ophaalstatus en bronvermelding. De relatie is geen kopie van de website.

Gebruiker kiest een locatie, plakt een specifieke pagina-URL, bekijkt een preview en bewaart de relatie standaard privé. Sharon mag beschikbare metadata, titel, omschrijving en toegestane afbeeldingen ophalen, maar moet CORS, websitevoorwaarden en auteursrechten respecteren. Privégebruik is **geen** algemene vrijstelling voor kopiëren of scraping; beperk opslag en weergave tot wat rechtmatig en technisch toegestaan is.

## 3. Publicatie en rechten

Publiceren is een afzonderlijke handeling, niet automatisch bij privé opslaan. Controleer rechten per tekst en afbeelding; bronvermelding op zichzelf is geen toestemming.

Mogelijke uitkomsten:
- **Toegestaan:** aantoonbare licentie of geverifieerde toestemming, binnen de scope.
- **Voorwaardelijk toegestaan:** controleer en toon voorwaarden (attributie, wijzigingen, commercieel gebruik, etc.).
- **Alleen linken:** deel uitsluitend URL en zelfgeschreven beschrijving zonder beschermde inhoud over te nemen.
- **Onbekend/niet toegestaan:** geen automatische herpublicatie van beschermde inhoud.

Gebruiker mag bewijs van toestemming aanleveren. Bewaar bewijsbron, toestemminggever, reikwijdte, datum, vervaldatum en verificatiestatus; gebruikersverklaring alleen is onvoldoende. Voor links, embeds en previews gelden afzonderlijke juridische en technische aandachtspunten; automatische controles geven geen juridische garantie.

## 4. Sharon Button (voorstel)

Websitehouder kan een herkenbaar Sharon-logo met machineleesbare verklaring op een specifieke webpagina plaatsen. Dit is **geen zelfstandig juridisch keurmerk**: de eigenaar of bevoegde rechthebbende moet bevoegd zijn toestemming te geven.

Ontwerp een challenge/response-proces: Sharon genereert een willekeurige verificatietoken voor een geclaimde domein-/pagina-eigenaar; de eigenaar plaatst deze op de betreffende pagina of in een gecontroleerd domeinbestand. Sharon haalt de token rechtstreeks bij de bron op en verifieert domeinbeheer. Domeinbeheer bewijst op zichzelf **niet** dat alle afbeeldingen en teksten eigendom zijn van de domeinbeheerder.

De machineleesbare verklaring bevat: bron-URL, uitgever, toestemmingsscope (link/preview/tekst/afbeeldingen), licentie/voorwaarden, verplichte attributie, geldigheidsperiode en versienummer. Bewaar een auditrecord, controleer periodiek op intrekking en laat een ingetrokken toestemming nieuwe publicatie blokkeren. Maak geen universele toestemming van een paginaspecifieke toestemming.

## 5. Implementatievolgorde en acceptatie

1. Bestaande boardcode inspecteren, huidige gestures en opslag toetsen; dan gerichte wijzigingen uitvoeren.
2. Boardpositie mobiel/desktop verbeteren zonder bestaande hoogte-instellingen of swipes te breken.
3. Vorige/volgende board voorladen en kompasstatus persistent houden.
4. Privé URL-locatiekoppeling met veilige preview toevoegen.
5. Publicatiestap en rechtenregistratie bouwen; standaard alleen link bij onbekende rechten.
6. Sharon Button verificatie en audittrail als aparte vervolgstap.

Acceptatie: bestaande boardinteracties blijven intact; boardwissel behoudt kompas; volgende en vorige content verschijnen zonder onnodige wachttijd waar cache beschikbaar is; privébron wordt niet publiek; ongeverifieerde inhoud wordt niet automatisch herpubliceerd; een geverifieerde Sharon Button verleent uitsluitend expliciet omschreven rechten.

**Tijdinschatting:** pas na inspectie van de concrete implementatie. 
