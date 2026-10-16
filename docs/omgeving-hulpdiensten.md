# Sharon · Omgeving · Hulpdiensten

Status: functioneel ontwerp; **geen live datakoppeling of kaartimplementatie**.

## Doel
Een optionele bron 'Hulpdiensten' naast Wikipedia in de module Omgeving. De kaartkern blijft generiek; bronadapters, filters en weergaveconfiguratie zijn module-eigen.

## Interactie
- Eén subtiele sireneknop in dezelfde bedieningsfamilie als Wikipedia.
- Tik: toon/verberg meldingen op de kaart. Veeg omhoog: open een compacte filterkaart. Veeg omlaag: sluit deze.
- Filterstrook met Brandweer, Ambulance, Politie; multi-select, met niet-beschikbare categorieën uitgeschakeld.
- Periodeschuif zonder datumvelden. Links 'Altijd' (= alle historie die de bron daadwerkelijk aanbiedt), vervolgens bijvoorbeeld 1 jaar, 3 maanden, 1 maand, 1 week, 24 uur, rechts 'Vandaag'. Alleen ondersteunde perioden zijn selecteerbaar.
- Bij wijziging van categorie/periode/kaartgebied worden zichtbare resultaten ververst. Buiten bruikbaar zoomniveau vervaagt de bronknop en volgt geen zware aanvraag.
- Toon compacte bron- en ophaalstatus, inclusief voortgang en fout-/geen-resultatenstatus, aansluitend op Wikipedia.
- Tik op een kaartmarkering: categorie, tijdstip, korte neutrale omschrijving, bron, en waar nodig 'Locatie bij benadering'. Geen persoonsgegevens.

## Datamodel
```ts
type EmergencyCategory = 'fire' | 'ambulance' | 'police';
type EmergencyReport = {
  id: string; // brongebonden stabiel ID, anders deterministische hash
  sourceId: string;
  category: EmergencyCategory;
  occurredAt: string; // ISO 8601
  title: string;
  summary?: string;
  position?: { lat: number; lon: number; accuracy: 'exact' | 'approximate' };
  sourceUrl?: string;
  dispatchOnly: true;
};
type EmergencySourceCapabilities = {
  sourceId: string;
  countries: string[];
  categories: EmergencyCategory[];
  earliestAvailableAt?: string;
  maxLookbackDays?: number;
  boundsSupported: boolean;
  attribution: string;
};
```

## Bronarchitectuur
- Adapterinterface: `capabilities()` en `fetchReports({bbox, since, until, categories, signal})`.
- Bronselectie op land/dekking. Nederland: P2000 is een mogelijke bron, maar een **concrete API, gebruiksvoorwaarden, CORS, actualiteit en bewaartermijn moeten eerst geverifieerd worden**.
- Geen scraping rechtstreeks vanaf de browser als die technisch of juridisch onbetrouwbaar is; zo nodig een aparte serverless proxy met caching en rate limiting.
- Dedupe op bron-ID of stabiele hash. Begrens aantal resultaten en gebruik kaartclustering.
- Bewaar filters lokaal als voorkeur; sla geen gevoelige incidentgegevens permanent op.

## Veiligheid en betrouwbaarheid
- Presenteer berichten als **alarmeringen, geen bevestigde incidenten**.
- Geen persoonsnamen, patiëntinformatie, privé-adressen of identificeerbare ambulancelocaties publiceren. Ambulancepunten zo nodig op wijkniveau tonen of weglaten.
- Geen schijnnauwkeurigheid: zonder betrouwbare coördinaten geen exacte pin.
- Bronvermelding en laatste synchronisatie zichtbaar; geen melding als 'live' bestempelen zonder aantoonbare realtime dekking.
- Bij niet-beschikbare bron: leg dat uit; toon geen voorbeelddata alsof het echte meldingen zijn.

## Acceptatiecriteria
1. Wikipedia en Hulpdiensten kunnen onafhankelijk aan/uit.
2. Filterpaneel gebruikt dezelfde visuele patronen en swipe-interactie als Wikipedia.
3. Alle categorieën zijn combineerbaar; onbeschikbare categorieën zijn disabled.
4. 'Altijd' respecteert bronretentie; de periodeschuif werkt zonder datumveld.
5. Nieuwe filters annuleren verouderde aanvragen; kaart blijft bedienbaar.
6. Kaartbeweging op hoog zoomniveau veroorzaakt geen onnodige bronaanvragen.
7. Meldingen zijn duidelijk voorzien van bron, tijd en onzekerheid.
8. De gedeelde kaartkern bevat geen P2000-specifieke logica.
9. Geen externe meldingen zichtbaar zolang een betrouwbare bron niet aangesloten is.

## Implementatiefasen
1. Bestaande Wikipedia-bediening en gedeelde kaartkern lokaliseren; componentpatronen hergebruiken.
2. Adapterinterface, UI en lege-/foutstatus implementeren achter feature flag.
3. Werkelijke databron verifiëren en adapter koppelen.
4. Testen op iPhone PWA: swipe, tik, filters, zoom, annulering, lege data en netwerkfouten.
5. Pas na bron- en privacyvalidatie publiek inschakelen.
