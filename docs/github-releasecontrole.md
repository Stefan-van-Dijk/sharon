# Sharon controleren vóór samenvoegen

De workflow `Sharon controles` controleert broncode, modulepaden, versieconsistentie, unit- en PHP-servertests, DOM-integratie, pakketinhoud en PWA-upgrades. PHP 8.3 wordt in GitHub geïnstalleerd; ontbrekende lokale PHP is geen bewijs van een appfout.

Deze wijziging voegt toe:
- Een versieverhoging is verplicht bij een PR die app-, asset- of servercode wijzigt.
- Regressietests voor relevantie bewaren, swipeconflicten, ongeldige/geannuleerde bewegingen, beheerderstoegang, Escape en opruimen bij sluiten.
- Mobiele boardtests in Chromium en WebKit, met fictieve gegevens en geblokkeerde externe verzoeken. Deze controleren browsergedrag; de touchbewegingen zijn gesimuleerde events, geen fysieke iPhone-bediening.
- Trace, screenshot en video bij een mislukte browsertest; het artifact `controle-<commit>` bevat ook het HTML-rapport, testresultaten, verificatielog en release-identiteit.

## Instelling door de repositorybeheerder

Maak `Sharon releasecontrole` verplicht op `main` via de branch ruleset. Vereis pull requests en een actuele branch voordat samenvoegen is toegestaan. Controleer de uitslag op de laatste PR-commit. Publicatie is al afhankelijk van deze controle en gebruikt uitsluitend het gecontroleerde pakket.

## Fouten evalueren

1. Open de mislukte workflow bij de PR en bekijk de eerste mislukte stap.
2. Download `controle-<commit>` en open het HTML-rapport of de Playwright-trace. Vergelijk verwacht gedrag met de screenshot en eventvolgorde.
3. Behoud de test die het gewenste gedrag beschrijft; pas alleen verouderde UI-selectors aan als de bediening bewust gewijzigd is.
4. Controleer op een echte iPhone: onderregel links swipen opent alleen Relevantie; sluiten keert terug naar hetzelfde board; een swipe over de inhoud bladert nog steeds. WebKit op Linux dekt geen echte iOS-camera, GPS, kompas of geïnstalleerde PWA.

Lokaal: `npm ci`, `npm run verify`, `npx playwright install --with-deps chromium webkit`, `npm run test:pwa`, `npm run test:boards`. De lokale PHP-tests gebruiken een tijdelijke server op 127.0.0.1 en fictieve publicatiesleutels; ze maken geen live contacten aan.
