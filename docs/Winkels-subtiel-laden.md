# Subtieler laden en winkelpunten — 0.4.72

Zoekvakken zijn nu maximaal 0,004 bij 0,004 graden: ongeveer 445 meter hoog,
en bij Nederlandse breedtegraden ongeveer 275 meter breed. Dit is 25 keer
minder oppervlak per bronaanvraag dan 0,02 bij 0,02 graden. Er volgen maximaal
vier vakken per zoekslag in plaats van negen, met het midden eerst. De app
claimt geen volledige dekking van een groter zichtbaar gebied. De bestaande
melding voor gedeeltelijke dekking blijft behouden. Verplaatsen of inzoomen
selecteert nieuwe vakken; succesvolle bestaande dekking wordt hergebruikt.

De planner sorteert maximaal zestien kandidaatvakken, ook bij een brede kaart.
De opgeslagen gebiedsbestanden houden dezelfde bestaande viertekens-ID's.
De kleinere vakken betreffen de bronvraag en deelgebieddekking, geen nieuw
bestands- of identifiersysteem. Details blijven op aanvraag.

Losse winkelpunten groeien subtiel van 65% naar de ingestelde grootte en worden
gedurende 220 ms zichtbaar. Uitgaande punten blijven kort aanwezig voor fade-out.
Feature-state verzorgt de animatie zonder GeoJSON of clustering per beeld opnieuw
op te bouwen. Gelezen-/leuk-stijlen en weergave-instellingen blijven van toepassing.
De symbolen volgen de opacity; de icon-grootte zelf verandert niet. Gegenereerde
clusterbolletjes hebben hun bestaande MapLibre-weergave en krijgen geen eigen
popanimatie. Verminderde beweging schakelt de animatie uit. Lopende animatie
wordt gestopt bij sluiten.

Geen wijzigingen of extra upload van PHP-serverbestanden nodig voor deze update.
Een trage/onbereikbare externe bron kan nog steeds wachten veroorzaken; hiermee
worden bronbeschikbaarheid of kortere wachttijden niet gegarandeerd.
