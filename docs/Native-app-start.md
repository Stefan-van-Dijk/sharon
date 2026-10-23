# Native ontwikkelstart — Sharon

Branch: `feature/native-app`. Dit is een voorbereidingsbranch, geen vrijgegeven Android- of iOS-build.

## Eerste gerealiseerde stap
`capacitor.config.json` wijst naar de bestaande reproduceerbare webbuild `_site`. De huidige PWA, `main`, `package.json` en lockfile zijn niet gewijzigd.

De voorlopige native app-ID is `io.github.stefanvandijk.sharon`. Controleer deze naam vóór de eerste app-store-publicatie: na publicatie is een app-ID niet zomaar te wijzigen.

## Nog uit te voeren op een ontwikkelmachine
Zorg voor Node zoals vermeld in `.nvmrc`. Gebruik de officiële Capacitor-instructies en leg het resultaat in deze branch vast:

```sh
npm ci
npm run verify
npm install @capacitor/core@^8 @capacitor/android@^8 @capacitor/ios@^8
npm install -D @capacitor/cli@^8
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

`npm install` moet zowel `package.json` als `package-lock.json` bijwerken; commit die gelijktijdig. Maak/controleer native platformprojecten in de ontwikkeltak. Installeer Xcode (macOS) voor iOS, Android Studio voor Android. De commando's hierboven zijn een uitvoerplan, **niet reeds uitgevoerd**.

## Vereiste controles vóór eerste test
- Reproduceerbaar: `npm ci && npm run verify`.
- Native runtime mag niet per ongeluk het PWA-updatebeleid of de browser-serviceworker overnemen. Eerst native detectie en workerbeleid implementeren, daarna pas bouwen en installeren.
- Check `fetch` naar de eigen HTTPS/PHP-endpoints en externe bronnen onder native origin.
- Controleer of lokaal geregistreerde opslag en versleutelde sleutels bereikbaar blijven na een native app-update; PWA-IndexedDB wordt **niet automatisch gemigreerd**.
- Test UI-safe-areas, navigatie, QR-camera en locatie op echte toestellen.
- Gebruik testgegevens en verwijder nooit de bestaande PWA om een native proef te laten slagen.
- Pas het bestaande Sharon-versieprotocol toe zodra runtime-code of pakketwijzigingen worden doorgevoerd.

## Volgende verandering
Dependencies en lockfile toevoegen, native detectie/wijziging serviceworkerregistratie, daarna eerste automatische smoke-test en native projecten. De live-PWA wordt pas geraakt na expliciete goedkeuring van een geteste merge.
