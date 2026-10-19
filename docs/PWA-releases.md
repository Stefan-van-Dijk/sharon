# PWA-releases vanaf v0.3.56

## Contract

Package, lockfile, zichtbare appversie, entrypoint, serviceworker en alle lokale
module-URL's gebruiken dezelfde versie. `npm run version:app -- 0.3.56` werkt de
versie en de volledige lokale offline-moduleclosure samen bij. Na toevoegen van
een module moet deze opdracht opnieuw worden uitgevoerd. `check-version` weigert
oude of onversioneerde lokale module-URL's en een onvolledige closure.

`npm run build` maakt `_site/offline-manifest.json` met de exacte URL's en SHA-256
van alle lokale runtimebestanden, inclusief opslag-, instellingen-, ID-, relatie-
en codemodules. De serviceworker krijgt deze hashes ingebouwd. De release-ID is
een digest van workerbeleid en alle assethashes; hij verschilt ook bij gewijzigde
inhoud met hetzelfde versienummer. `release.json` blijft het bewijs van het hele
geteste publicatiepakket, inclusief gegenereerde worker en offline-manifest.
De gewone bronmap is geen publicatiepakket: serveer voor PWA-ontwikkeling `_site`.

## Installeren, wachten en activeren

Een update downloadt en controleert eerst alle noodzakelijke lokale bestanden.
Een ontbrekend bestand, verbroken verbinding, redirect, verkeerde hash of
mislukte cachewrite laat installatie falen. Een nieuwe onvolledige cache wordt
opgeruimd; de actieve cache en persoonlijke IndexedDB worden niet gewijzigd.

Er wordt geen `skipWaiting`, `clients.claim` of geforceerde herlaadactie gebruikt.
Alle open Sharon-tabbladen en standalonevensters blijven hun eigen complete
release gebruiken. Ook een nieuw tabblad blijft bij die release zolang de oude
worker actief is. De update activeert nadat alle oude clients zijn gesloten.
Home toont bij een gereedstaande update: “Update gereed. Sluit alle
Sharon-vensters en open de app opnieuw.” Vernieuwen alleen is niet voldoende
wanneer nog oude vensters openstaan. Een controle bij hervatten gebeurt hoogstens
eens per vijf minuten; mislukking onderbreekt offline gebruik niet.

Vanaf deze release komt navigatie-HTML uit dezelfde cache als de modules.
Losse ontbrekende cachebestanden kunnen online alleen met exact bijpassende
bytes worden hersteld. Nieuwe netwerk-HTML wordt nooit tussen oude modules
gevoegd. Als herstel niet kan, volgt een 503 met heropeninstructie; bij ontbrekende
navigatie wordt ook een updatecontrole geprobeerd. Browser-/OS-opslagverwijdering
kan offline beschikbaarheid beperken; dit is geen back-up van gebruikersgegevens.

Bij activering blijven de huidige en één eerdere appcache behouden. Oudere
Sharon-shellcaches worden opgeruimd; andere caches en IndexedDB blijven staan.
Teruggaan naar een eerder gepubliceerd pakket gebruikt dezelfde controle- en
wachtprocedure. Het doet geen databasewijzigingen ongedaan.

## Eerste overgang vanaf v0.3.55

De oude worker kan nog netwerk-HTML met oude modules combineren en is zelf niet
achteraf te corrigeren. Voor de eerste overgang moet v0.3.56 volledig online
worden gedownload. Sluit daarna alle Sharon-vensters en open opnieuw. De nieuwe
meldtekst kan pas zichtbaar zijn wanneer de nieuwe applicatie zelf draait.
De browsertest gebruikt de werkelijk gepubliceerde v0.3.55-bronnen uit commit
fb9761ab6b22bb803c24da46131751868cd8d8cf, met fictieve persoonlijke gegevens.

## Offlinegrens

De shell, formulieren, lokale modules, QR/barcodes en lokale gegevens vallen in
de offlineclosure. MapLibre-renderer/CSS/worker, kaarttegels, fonts van de
kaartleverancier, geocodering, Wikipedia en overige externe bronnen worden niet
door deze appworker geprecached. Een voor het eerst geopende kaart of externe
bron vereist internet; de app belooft geen volledig offline wereldkaart.
Camera- en GPS-toestemming blijven afzonderlijke browsermogelijkheden.

## Verificatie

- `npm ci && npm run verify`: bestaande unit-/brontests, DOM/IndexedDB-ketens,
  bron-, versie-, import-, asset- en pakketcontroles.
- `npx playwright install --with-deps chromium && npm run test:pwa`: echte
  browser met Cache Storage, serviceworker en IndexedDB. Tests voor twee tabs,
  een onopgeslagen formulier, offline herstart, lokale codebibliotheken,
  ontbrekende/onderbroken/gewijzigde downloads, legacy-migratie, rollback en
  herstel van een verwijderd cachebestand. De PR-releasecontrole voert dit uit
  vóór het pakket voor Pages wordt klaargezet. De lokale browserdownload was
  niet uitvoerbaar (ongeldige archiefdownload); de GitHub-uitvoering is leidend
  voor deze browserresultaten.
- `node scripts/verify-site.mjs`: controleert dat browserproeven het geteste
  pakket niet hebben gewijzigd.

Nog niet fysiek getest: geïnstalleerde iPhone-PWA, iOS-achtergrondgedrag en
OS-opslagverwijdering. Chromium of apparaat-emulatie bewijst dit niet. #105 blijft
daarom open voor deze praktijkvalidatie. Test met fictieve gegevens en noteer
toestel, iOS/Safari, datum, oude/nieuwe versie en SHA, open tabbladen, netwerk,
resultaat en behoud van gegevens. Verwijder de PWA of websitegegevens niet als
updateprocedure: dit kan persoonlijke lokale gegevens verwijderen.

Bron voor lifecyclebeleid: [W3C Service Workers](https://www.w3.org/TR/service-workers/).
