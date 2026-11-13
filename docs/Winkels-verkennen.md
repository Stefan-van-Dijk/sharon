# Winkels verkennen — 0.4.73

De kaart plant maximaal 64 kleine zichtbare vakken, vanuit het midden. Per ronde
worden maximaal 32 nog onbekende vakken achtereen opgehaald; bekende vakken tellen
niet mee in dat netwerkbudget. Vakken zijn maximaal 0,002 × 0,002 graden (circa
140 × 220 meter in Nederland). Alleen de overlap met het zichtbare zoekgebied
wordt gevraagd. Meer dan 2.000 unieke resultaten beëindigen de ronde; ontbrekende
dekking blijft expliciet gedeeltelijk. Verder bewegen start/verlegt de verkenning.

Een lopende aanvraag blijft bruikbaar bij verplaatsen: na het antwoord bepaalt
de nieuwste viewport de volgende aanvraag. Wisselen van keten, uitschakelen,
sluiten en een vastgezet boarddeck annuleren wel. Reeds ontdekte resultaten
blijven beschikbaar in de sessie. De bronpauze van 1,1 seconde blijft gehandhaafd.

Publieke snapshots worden apart in IndexedDB bewaard, maximaal 128 vakken en
circa 4 MB JSON. Cachefouten blokkeren online laden niet. Bekende vakken krijgen
voorrang op onbekende. Tot vijf minuten wordt een lokaal snapshot direct gebruikt;
daarna verschijnt het onmiddellijk terwijl de serveropslag wordt gecontroleerd.
De bestaande server bepaalt of de bron na twee maanden opnieuw moet worden
bevraagd. Persoonlijke kaarten, locaties en contacten worden niet gewijzigd.

Verversingen van verouderde serversnapshots lopen in een seriële achtergrondrij.
Een expliciete 503 van de geïnstalleerde gebiedsservice start geen tweede
wereldwijde aanvraag via chains of rechtstreeks Overpass. Een ontbrekende service
behoudt de bestaande compatibiliteitsroute. Gebiedsverversing krijgt maximaal
15 seconden cliëntwachttijd; een mislukking vernieuwt de datum van de bron niet.

Losse punten verschijnen in groepen van twintig, met 60 ms tussen groepen en
maximaal 360 ms extra spreiding. De bestaande groei/fade duurt 220 ms. Lopende
animaties worden niet opnieuw gestart bij ieder antwoord. Verminderde beweging
blijft onmiddellijk. Clusterbolletjes behouden de bestaande rendereranimatie.

Er is geen gegarandeerd maximum van twintig winkels per bronantwoord: dat aantal
betreft de presentatie. De kleinere zoekvakken beperken de bronvraag zonder
winkels stilzwijgend weg te laten. Adaptief verder splitsen op winkeldichtheid is
nog niet geïmplementeerd. Brede uitzichten worden bewust niet volledig gescand.

Geen PHP-upload nodig; viertekens-bestanden en bestaande itemidentifiers blijven
ongewijzigd. Werkelijke mobiele bronlatentie en visuele soepelheid vereisen ook
controle op het apparaat. Mocktests bewijzen geen live Overpass-responstijden.
