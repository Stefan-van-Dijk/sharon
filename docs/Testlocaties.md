# Testlocaties — v0.3.58

In de testomgeving opende Locaties nog de algemene skelet-editor. Daardoor kon alleen een naam worden ingevoerd. Vanaf deze versie gebruikt het onderdeel dezelfde `LocationsView` en `LocationOnboardingFlow` als de reguliere omgeving: naam, kaart/GPS, adres, type, straal, sublocaties en bewerken.

Een opslagadapter vertaalt de testobjecten naar het bestaande locatieformaat. De bestaande identifiers, namen en graph-relaties blijven behouden. Volledige locatiegegevens worden bij het betreffende testobject bewaard. Voorkeuren, zinnen en instellingen blijven onder een afzonderlijke testsleutel in metadata. De persoonlijke objecten en instellingen worden niet gelezen of overschreven door de adapter. Vanaf v0.3.59 gebruikt dezelfde locatie-triggerdienst de gekozen werkruimte: testlocatieacties blijven binnen testgegevens en persoonlijke locatieacties worden tijdens testen niet uitgevoerd.

Bij verwijderen wordt het testobject gearchiveerd; graph-relaties blijven behouden. Samenvoegen verplaatst graph-relaties naar de overblijvende locatie. Een herstel via de bestaande graph-interface maakt het object weer zichtbaar.

Praktijkcontrole na publicatie: zet Testomgeving aan, open Locaties, tik op +, vul naam en locatiegegevens in en sla op. Open het onderdeel opnieuw en controleer de gegevens. Zet daarna Testomgeving uit en controleer dat de eigen locaties ongewijzigd zijn.

De kaart gebruikt dezelfde externe kaartbronnen als de reguliere locatie-editor. Zonder internet kunnen kaart- en adresbronnen beperkt beschikbaar zijn.
