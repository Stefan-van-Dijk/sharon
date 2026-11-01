# Kaart doorladen — 0.4.55

De zoom-11-blokkade is verwijderd voor Wikipedia en winkels. Aanvragen blijven geografisch begrensd (maximaal 10 km); uitzoomen betekent geen wereldwijde download. Het sluiten van een gepauzeerd board meldt vrijgave aan de bronlagen, die opnieuw plannen. Wikipedia API-errors worden geweigerd in plaats van als volledig doorzocht leeg gebied opgeslagen; API-continuation markeert de dekking als onvolledig.

Winkels wachten niet langer op het ophalen van de landelijke catalogus. Als de Sharon-server faalt of de wereldroute niet ondersteunt, gebruikt dezelfde ChainBrowse-module rechtstreeks een begrensde Overpass-shopquery. Dat werkt zonder PHP-installatie of publicatie van de landelijke import. Geen extra UI. Directe records krijgen lokale stabiele 12-tekenidentifiers per OSM-reference; opgeslagen locaties/feedback blijven gekoppeld via de bronreferentie. Details worden apart opgehaald. De directe route bevat shop-objecten; aanvullende amenities blijven onderdeel van de serverroute.

Beperking: openbare Overpass blijft afhankelijk van beschikbaarheid en quota. Dit garandeert geen volledige werelddekking. De eerste serverpoging kan vertraging geven; een expliciete annulering leidt nooit tot een nieuwe directe aanvraag. De directe route verstuurt uitsluitend gebiedsgrenzen/OSM-reference, zonder cookies of persoonlijke identiteit.

Geen serverbestanden gewijzigd. Bestaande persoonlijke gegevens worden niet verwijderd. Oudere datamigratie is geen voorwaarde voor de directe zoekroute.
