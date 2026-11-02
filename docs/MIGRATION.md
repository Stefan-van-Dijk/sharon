# Migratie van Log naar Sharon

De bestaande `Stefan-van-Dijk/log` repository blijft onaangeraakt en fungeert als bron voor gedrag, data en regressietests.

## Bekende V1-bronnen

Onder andere:

- `kmreg-v4-data` / `kmreg-test-v4-data`
- `urenregistratie.pwa.v1` / `urenregistratie.test.pwa.v1`
- identiteit- en aanvullende `log-*` storage
- IndexedDB voor GPS-trackpunten
- bestaande publicatie- en synchronisatiecontracten op sharon.life

Sharon neemt deze storage keys niet als intern ontwerp over.

## Migratievolgorde

1. identiteiten en externe identifiers;
2. locaties / sublocaties;
3. thema's / subthema's;
4. kaarten;
5. tijd / taken;
6. ritten / voertuigen / trackpunten;
7. acties;
8. delen / samenwerking.

## Hoofdregel

Alleen de migratielaag kent het oude Log-datamodel.

De rest van Sharon kent uitsluitend het nieuwe model. Daardoor kan de migratiecode later worden verwijderd zonder de kern te raken.
