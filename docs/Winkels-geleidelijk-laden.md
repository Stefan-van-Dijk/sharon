# Geleidelijk winkels laden — 0.4.70

Winkels worden per kaartvak van maximaal 0,02 bij 0,02 graden opgehaald, uitsluitend
binnen het zichtbare zoekgebied. Dat is maximaal ongeveer 2,2 bij 2,2 km; de
breedte wordt kleiner op hogere breedtegraden. Het midden krijgt voorrang.

Per zoekactie volgen maximaal negen vakken en maximaal 2.000 unieke winkelpunten.
Resultaten verschijnen na elk antwoord. Bij meer vakken of een bronlimiet blijft
de melding 'Gebied gedeeltelijk doorzocht · zoom in voor meer winkels' zichtbaar.
Er is geen claim van volledige dekking buiten de opgehaalde vakken.

Aanvragen zijn sequentieel met minimaal 1,1 seconde tussen nieuwe vakaanvragen.
Volledig gedekte vakken uit het sessiegeheugen worden zonder extra aanvraag
hergebruikt. Mislukte of afgebroken gebieden worden niet als compleet vastgelegd.
Verplaatsen, uitschakelen en de bestaande boardpauze annuleren resterend werk.
Eerdere sessie-items blijven beschikbaar voor boards en worden op bronreferentie
ontdubbeld. Winkel-details worden via de bestaande route bij openen geladen.

Dit verkleint de omvang per verzoek en toont de eerste resultaten eerder; het
versnelt de verbinding van een onbereikbare bron niet. De PHP-API hoeft voor deze
wijziging niet opnieuw te worden aangepast. De serverwijziging uit 0.4.69 blijft
wel noodzakelijk als die nog niet is geplaatst.
