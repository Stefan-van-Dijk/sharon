# Pasboards — v0.3.65

Pasboards gebruiken het zwevende materiaal en de achterliggende platen van Omgeving.
Ingeklapt wisselt een horizontale swipe tussen de zichtbare pasjes in de huidige lijstvolgorde (inclusief zoeken en eigen sortering). Bij aankomst en op Home bestaat het deck uit de passende pasjes voor die locatie.

De QR- of barcode staat op een wit vlak met vrije ruimte rondom de code. Rechtsonder staat de soort pas. Meer informatie toont de naam en detailvelden onder dit vlak. Bij meer informatie dan één board verdeelt Sharon de velden over pagina's; horizontaal swipen wisselt dan uitsluitend tussen de informatiepagina's van het gekozen pasje. Eerst inklappen om weer van pas te wisselen. De teller linksonder volgt het actieve niveau. Aan de uiteinden stopt het deck.

Op het codevlak kun je omhoog vegen om uit te klappen en omlaag om in te klappen (of het compacte board te sluiten). De bediening linksonder kan ook kort worden aangetikt om in of uit te klappen. Houd deze 450 ms vast om alle platen als één deck op te pakken en te verslepen. Loslaten bewaart de positie binnen de gekozen werkruimte; annuleren herstelt de vorige positie. Bij een kleiner venster houdt Sharon het deck binnen beeld. Detailvelden blijven verticaal scrollbaar.

Toetsenbord: links/rechts wisselt pas of informatiepagina, omhoog klapt uit, omlaag klapt in of sluit, Escape sluit.

Automatische controles dekken de twee swipeniveaus, grenzen, lange informatie, codewisseling, eigen volgorde, zoeken, verplaatsen, annuleren en positieherstel. DOM-tests bewijzen geen rendering of camerascanning: controleer op een echte telefoon de codeleesbaarheid, de vrije coderanden, het vasthouden versus swipen en het beschikbare detailvlak op kleine schermen.
