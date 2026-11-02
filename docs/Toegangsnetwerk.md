# Toegangsnetwerk via chatuitnodigingen

Status: domeinregels en tests geïmplementeerd in `server/access/AccessNetwork.mjs`.
Nog niet aangesloten op een chatinterface, authenticatie, uitnodigingsendpoint,
centrale database of sleuteluitgifte. Deze wijziging geeft niemand live toegang.

## Vastgelegde productkeuzes

- Eén toegangsnetwerk heeft een eigen vaste identifier van 12 tekens.
- Iedere persoon heeft een eigen, blijvende persoonsidentifier.
- De eigenaar staat op lijn 0 en telt niet mee met de eerste 100 deelnemers.
- Iedere geaccepteerde deelname heeft een eigen blijvende identifier, een
  persoonsreferentie, een verwijzing naar de uitnodiger en een toegangsstatus.
- De netwerkidentifier koppelt alle deelnames aan hetzelfde netwerk.
- Lijn 1, 2 en 3 volgen uit de uitnodigingsketen vanaf de eigenaar. Lijn 4 wordt
  geweigerd. De lijn wordt berekend, niet als afzonderlijk bewerkbaar veld bewaard.
- De grens geldt voor de eerste 100 unieke geaccepteerde personen in totaal.
  Een opnieuw geaccepteerde uitnodiging telt niet nogmaals en wijzigt de
  oorspronkelijke uitnodiger of deelname-ID niet.
- Alleen de eigenaar kan toegang intrekken of herstellen. Een ingetrokken
  deelname blijft bestaan en maakt geen nieuwe plaats vrij.
- Intrekken geldt voor die persoon: bestaande deelnemers verderop blijven hun
  eigen toegang houden. De ingetrokken persoon kan geen nieuwe uitnodigingen
  laten accepteren. Een automatische cascade is niet onderdeel van dit model.

Een persoonsobject mag zelfstandig bestaan voordat een uitnodiging of deelname
wordt toegevoegd. Het netwerk bevat alleen referenties; het kopieert geen naam,
adres of andere persoonsgegevens. De persoonsidentifier is geen toegangsbewijs.

## Relaties en opslag

Het netwerk is een object met `id`, `type: access-network`, `ownerId` en
`members`. Een deelname bevat `id`, `personId`, `invitedBy` en `status`.
Daarmee staan zowel persoon → deelnemer van → netwerk als
persoon → uitgenodigd door → persoon vast binnen de scope van dat netwerk.
Dezelfde persoon kan in een ander netwerk een andere uitnodigingsrelatie hebben.
Er is geen tweede, parallelle personenadministratie en er worden geen relaties
in de persoonlijke testgraph geschreven.

De eigenaar en de deelnemende personen worden via hun bestaande identiteiten
verwezen. Bij een latere graphprojectie blijft dit netwerk de bron voor
toegangsrelaties. Een vrij bewerkbare graphrelatie verleent geen toegang.

## Vereiste centrale koppeling

1. De chatstarter is aangemeld. De server bevestigt diens actieve deelname en
   geeft een ondertekende of onvoorspelbare uitnodiging uit met netwerk,
   uitnodiger, ontvanger, vervaltijd en intrekkingsmogelijkheid.
2. De ontvanger accepteert terwijl die is aangemeld. De server controleert
   geldigheid, vervaltijd, intrekking en de gebonden ontvangende identiteit.
   Een nieuwe installatie mag niet automatisch een nieuwe getelde persoon worden.
3. Alleen de server bouwt `verifiedInvitation` op. Een gelijknamig veld uit een
   browserrequest is geen verificatie. `authenticatedPersonId` komt uit de
   geverifieerde sessie en niet uit een vrij requestveld.
4. De databaseadapter voor `acceptInvitationAtomically` vergrendelt het netwerk
   en voert de wijziging uit op de laatste vastgelegde toestand. Bij twee
   gelijktijdige aanvragen voor plaats 100 slaagt er één. Commit moet duurzaam
   voltooid zijn voordat de adapter succes teruggeeft.
5. Pas na succesvolle commit ontvangt de deelnemer de bestaande publicatiesleutel
   via een beveiligd, geauthenticeerd kanaal. Bij een mislukte sleutelaflevering
   mag dezelfde deelnemer opnieuw ophalen zonder een extra plaats te gebruiken.
6. Sharon bewaart de sleutel afzonderlijk van de netwerkrelaties. De chat toont
   geen sleutelveld. De sleutel komt niet in de uitnodigings-URL, graph,
   browserlogs, openbare bestanden of broncode.

Het bestaande maximum en de drie lijnen worden door de domeinregels
gecontroleerd. Authenticatie, uitnodigingsverificatie en transacties worden niet
door deze pure regels geleverd en moeten bij de endpointkoppeling aanwezig zijn.
De transactietest bewijst de regels met een geserialiseerde testadapter; hij
bewijst geen nog niet gebouwde productiedatabase.

## Bestaande gezamenlijke publicatiesleutel

Er blijft één publicatiesleutel, zoals afgesproken. Identiteit en deelname worden
los daarvan geregistreerd. De sleutel wordt niet gebruikt als persoonsidentifier.

Een eenmaal ontvangen gezamenlijke sleutel is technisch door te geven. Alleen
centrale controle van de aangemelde identiteit en actieve deelname bij iedere
publicatie kan de 100-grens en individuele intrekking daadwerkelijk afdwingen.
Wanneer het publicatie-endpoint uitsluitend deze gezamenlijke sleutel controleert,
kunnen de nieuwe netwerkregels die toegang nog niet afdwingen. Een reeds
uitgeleverde sleutel verdwijnt niet door een deelname op ingetrokken te zetten.

## Acceptatiecriteria voor de live koppeling

- Uitnodigen vanuit een chat, accepteren en hervatten na een verbroken verbinding.
- Eén identiteit op meerdere apparaten telt als één persoon.
- Dubbele uitnodigingen behouden de eerste deelname en uitnodigingsrelatie.
- Lijn 4 en deelnemer 101 krijgen geen sleutel en geen publicatierecht.
- Twee gelijktijdige acceptaties bij 99 deelnemers leveren precies 100 op.
- Onbevoegde, vervallen, ingetrokken en doorgestuurde uitnodigingen worden geweigerd.
- Ingetrokken deelnemers kunnen ook met een eerder opgeslagen sleutel niet publiceren.
- Sleutels ontbreken in netwerkexport, uitnodigingslinks en logs.
