# Sharon

**Share on.**

Sharon is de schone herbouw van de eerdere Log-prototypeapp. De bestaande repository `Stefan-van-Dijk/log` blijft referentie- en migratiebron; Sharon krijgt een nieuwe architectuur zonder historische koppelingen mee te nemen.

## Richting

Sharon is local-first: informatie ontstaat en blijft in eerste instantie op het apparaat. Delen, ophalen en samenwerken worden daar als expliciete laag bovenop gezet.

De eerste architectuurregels zijn:

- één centrale locatievoorziening;
- geen periodieke GPS-controle als dat niet nodig is;
- één lokale opslaglaag;
- één extern identifierformaat: exact 12 tekens uit `A-Z a-z 0-9 - _`;
- modules communiceren via services en events;
- delen/synchroniseren zit achter een adapter;
- oude Log-data wordt via een aparte migratielaag ingelezen;
- de oude Log-repository wordt niet door Sharon gewijzigd.

## Eerste modules

- Ritten
- Tijd / Taken
- Locaties
- Acties
- Kaarten
- Thema's

Personen, voertuigen en samenwerking volgen op de generieke kern.

## Lokaal starten

```bash
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

Tests:

```bash
npm test
```

Zie ook `docs/ARCHITECTURE.md` en `docs/MIGRATION.md`.
