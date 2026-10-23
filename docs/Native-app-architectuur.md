# Sharon op web, Android en iOS — architectuur en invoering

Status: ontwerpbesluit · 23 oktober 2026
Ontwikkeltak: `feature/native-app`
Scope van deze eerste wijziging: vastleggen van de ontwerpkeuzes, zonder impact op de bestaande PWA.

## Doel
Sharon blijft één local-first product met drie distributievormen: PWA, Android-app en iPhone-app. De HTML-, CSS- en JavaScript-modules, objectmodellen, identifiers, services, events en relaties blijven gedeeld. Een dunne platformadapter biedt toegang tot apparaatspecifieke mogelijkheden.

## Principes
1. De bestaande GitHub Pages-PWA en de branch `main` blijven functioneren. Native experimenten beginnen uitsluitend op `feature/native-app`.
2. De huidige build (`npm run build` naar `_site`) en verificatie (`npm run verify`) blijven intact. Native packaging volgt pas na succesvolle bron- en buildcontroles.
3. Capacitor is de gekozen voorkeursroute. Het native project gebruikt een lokaal meegeleverd webpakket (`webDir: "_site"`); geen externe productie-URL als hoofdscherm.
4. Serviceworker-registratie, update-/cachebeleid en routing moeten per runtime beoordeeld worden: native assets en PWA-releases mogen niet door elkaar lopen.
5. Apparaattoegang loopt via gedeelde adapters voor camera/QR, locatie, notificaties, delen en opslag. Web-fallbacks blijven beschikbaar waar zinvol.
6. De centrale `LocationService` bewaakt GPS-frequentie en energiegebruik. Achtergrondlocatie is geen standaardmachtiging en komt pas na een expliciete usecase, aparte implementatie en apparaatvalidatie.
7. IndexedDB blijft de bestaande webopslag. Een native installatie heeft een andere opslagcontainer dan de PWA; automatische overdracht bestaat niet. Ontwerp eerst een expliciete, verifieerbare export/import of versleutelde migratieroute met behoud van ID's, relaties, sleutels en privacy.
8. Publiceren/delen en PHP-endpoints blijven server-side buiten de meegeleverde app; test HTTPS, CORS, sleutelbeheer, QR-koppelingen en offlinegedrag vanuit de native runtime.
9. iOS/Android-permissies zijn minimaal en taakgericht. Pushmeldingen vergen naast de app ook registratie en een bezorginfrastructuur; niet verwarren met bestaande chatpolling.
10. Versienummers volgen het bestaande Sharon-beleid. Houd native `versionCode` / `buildNumber` apart bij wanneer app-store releases worden toegevoegd.

## Gefaseerde uitvoering
### Fase A — voorbereiding
- Capacitor-dependencies en CLI versioned toevoegen met een reproduceerbare lockfile.
- `capacitor.config.*` configureren voor `_site` en een definitieve app-ID bepalen.
- Native projecten (`android/`, `ios/`) genereren en versioneren waar passend.
- Scripts toevoegen voor `build -> cap sync -> native open/build`.
- Web-/native-detectie en serviceworker-registratie controleren zonder bestaande PWA-regels te verbreken.
- PWA-verificatie onveranderd laten slagen; aparte native smoke-test toevoegen.

### Fase B — toestelvalidatie
- Testen op een echte Android en iPhone: eerste start, schermvullend/safe areas, swipen, boards, GPS, QR-camera, netwerkverzoeken, offline starten en heropenen.
- Verifieer behoud van data bij updates en afwezigheid van onbedoelde nieuwe toestemming.
- Test uitsluitend met fictieve data totdat overdracht/back-up is gevalideerd.

### Fase C — native voorzieningen
- Eén adapterlaag voor QR-camera, notificaties en platformopslag.
- Pas later optionele achtergrondritten na expliciet gebruiksdoel, toestemming, OS-beperkingen en batterijmetingen.

### Fase D — distributie
- Lokale tests eerst, daarna interne testdistributie en optioneel App Store / Play Store.
- Privacyverklaring, rechten, store-assets, signing, review en releasekanalen onafhankelijk plannen.

## Acceptatiecriteria voor eerste technische implementatie
- `main` en de live-PWA zijn ongewijzigd.
- `npm ci && npm run verify` slagen.
- `_site` kan lokaal als native webpakket worden gesynchroniseerd.
- Geen verplichte migratie van bestaande PWA-gegevens.
- Geen automatische achtergrondlocatie of pushpermissies.
- Verschillen tussen browser- en native runtime zijn gedocumenteerd.
