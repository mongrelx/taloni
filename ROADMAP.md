# 🗺 Taloni — Roadmap

Tavoite: tehdä Kiinteistövahdista aidosti **täydellinen suomalaisten hirsitalojen ja
mökkien hallintaan** — ei pelkkä yleinen kiinteistörekisteri, vaan työkalu joka tuntee
suomalaisen mökkielämän lakisääteiset velvoitteet ja vuodenkierron.

Nykytila kattaa: kiinteistöt, tehtävät, remontit, tulot/menot, kulutuslaskut, kaluston ja
vakuutukset. Alla puuttuvat osa-alueet vaiheistettuna. Jokainen vaihe on itsenäisesti
julkaistavissa, ja kaikki skeemamuutokset ajetaan `migrations[]`-taulukon kautta niin,
että olemassa olevat tietokannat päivittyvät automaattisesti.

---

## Vaihe 1 — Lakisääteinen ydin (Statutory compliance core) ✅ VALMIS

Suurin domain-hyöty: Suomessa lakisääteiset velvoitteet, joita ei tällä hetkellä seurata.

- [x] `heating_systems` — lämmitysjärjestelmä (puu / öljy / maalämpö / ilmalämpöpumppu / sähkö / kaukolämpö)
- [x] `fireplaces` — tulisijat & kiukaat (kytkeytyy nuohoukseen)
- [x] `wastewater_systems` — jätevesijärjestelmä (saostuskaivo / umpisäiliö / maasuodattamo / pienpuhdistamo) + tyhjennysseuranta
- [x] `water_tests` — kaivoveden laatututkimukset (E.coli, koliformit, nitraatti, pH, rauta, fluoridi)
- [x] Toistuvuusmoottori: `tasks`-tauluun `recurrence` + `next_due`; valmistuessa syntyy seuraava esiintymä
- [x] Realistinen siemenaineisto (nuohous vuosittain, sakokaivon tyhjennys, öljysäiliön tarkastus, kaivovesi 3 v välein)
- [x] Uusi TUI-välilehti **"6. Määräaikaishuolto"** — erääntyvät velvoitteet listana (myöhässä/lähestyy/kunnossa)
- [x] Migraation versionosto (v2: recurrence + next_due; uudet taulut CREATE IF NOT EXISTS)

### Vaihe 1b — Rekisterien TUI-hallinta ✅ VALMIS

- [x] Täysi lisää/muokkaa/poista TUI-lomakkeilla neljälle rekisterille (tulisijat, jätevesi, lämmitys, vesitutkimukset)
- [x] Määräaikaishuolto-välilehden navigointi: `[Tab]` / `←→` vaihtaa rekisteriä, `[↑↓]` valitsee rivin, `[a]/[e]/[d]`
- [x] Toistuvuus (`recurrence`) valittavissa tehtävälomakkeella; `next_due` lasketaan automaattisesti
- [x] Fokus- ja valintakorostukset neljässä rekisteripaneelissa

## Vaihe 2 — Mökkielämä (Cabin life) ✅ VALMIS

- [x] `firewood` — polttopuuvarasto (pino-m³ / motti / irto-m³, kuivumisaste, liiteri) — täysi TUI-CRUD välilehdellä 7
- [x] Sauna kiinteistön ominaisuutena (ei saunaa / puukiuas / sähkökiuas + saunan tiedot) — kiinteistölomakkeella
- [x] Kiinteistövero ja tiekunta/yksityistiemaksu vuosikuluina kiinteistön ominaisuuksina + koostenäkymä
- [x] Uusi välilehti **"7. Polttopuu & Sauna"**: polttopuuvarasto + saunat & kiinteät vuosikulut
- [x] Yleisnäkymän widget: **"Erääntyy 30 pv sisällä"** (tehtävät, vakuutukset, nuohous, jätevesi, lämmitys yhdessä)
- [x] Migraation versionosto (v3)

## Vaihe 3 — Vuokraus & vuodenkierto (Rental & seasonal) ✅ VALMIS

- [x] `bookings` — vuokrauskalenteri (täysi TUI-CRUD), kuukausittain ryhmitelty kalenterinäkymä, öiden ja tulojen kooste
- [x] Varaus → tulotapahtuma: `[Enter]` kirjaa vuokratulon taloustapahtumaksi (idempotentti, kertaalleen per varaus)
- [x] Kausikatsaukset: `[k]` Kevätavaus ja `[s]` Syyssulku luovat valmiit tarkistuslistat tehtävinä valitulle kohteelle
- [x] Uusi välilehti **"8. Vuokraus & Kausi"**
- [x] Uusi taulu `bookings` (luodaan CREATE TABLE IF NOT EXISTS -lauseella)

## Vaihe 4 — Tukitiedot (Supporting data) ✅ VALMIS

- [x] `contacts` — palveluntarjoajat (nuohooja, LVI, sähkö, loka-auto, isännöinti, muu), globaali rekisteri, täysi TUI-CRUD
- [x] `documents` — asiakirjojen metatiedot + polku (lainhuuto, kauppakirja, rakennuslupa, tarkastuspöytäkirja, takuu), kohdekohtainen
- [x] `meter_readings` — mittarilukemien historia (sähkö kWh / vesi m³) kulutustrendillä (peräkkäisten lukemien erotus)
- [x] Uusi välilehti **"9. Yhteystiedot & Arkisto"** — kolme rekisteriä (Tab/←→ vaihtaa, ↑/↓ selaa)
- [x] Uudet taulut `contacts`, `documents`, `meter_readings` (CREATE TABLE IF NOT EXISTS)

## Vaihe 5 — Raportointi, vienti & robustius ✅ VALMIS

- [x] CSV-vienti (`export`) — transactions, utilities, bookings, tasks, properties
- [x] Vuosikooste ja vuokratuloraportti verottajalle (`report [vuosi]`) — kohteittain ja kategorioittain
- [x] Tietokannan varmuuskopiointikomento (`backup`) — aikaleimattu kopio
- [x] Syötteiden validointi (`src/validate.ts`) — CLI-komennot torjuvat virheelliset syötteet
- [x] Testikattavuus (`npm test`) — 19 testiä: validointi, db-kerros, migraatiot (v1→uusin), raportit
- [x] Robustius-korjaukset: `PRAGMA foreign_keys = ON` (ON DELETE CASCADE toimii), `advanceRecurrence` kuukauden lopun rajaus

## Vaihe 6 — Jätevesijärjestelmän vaatimustenmukaisuus ✅ VALMIS

- [x] `wastewater_systems` laajennettu: rakennusvuosi, ranta-alue, pohjavesialue, wc-vedet, ikä-/vähäisyysvapautus
- [x] `assessWastewater()` — automaattinen puutearvio (VNa 157/2017): ok / huomioitavaa / toimenpide tarpeen
- [x] Herkkien alueiden 31.10.2019 takaraja, muualla korjaus kytkeytyy remonttiin; vapautukset ja vähäiset jätevedet huomioitu
- [x] Arvio + havaitut puutteet ja suositellut toimenpiteet näkyvät Määräaikaishuolto-välilehdellä
- [x] Vastuuvapauslauseke näkymässä (informatiivinen, varmista kunnalta) + migraation versionosto (v4)

## Vaihe 7 — Liittymät & jätehuolto ✅ VALMIS

- [x] Kiinteistölle sähköliittymän koko (pääsulake) ja vesiliittymän koko/tyyppi
- [x] Jätehuolto: yhtiö, sekajäteastian koko, tyhjennysväli, biojätteen käsittely (kunnan keräys / kotikompostointi / yhteiskeräys / ei biojätettä)
- [x] `assessComposting()` — kotikompostointi ilman kunnan ilmoitusta → automaattinen muistutus (jätelaki 646/2011, jäteasetus 978/2021)
- [x] Tiedot kiinteistölomakkeelle; kooste + kompostointimuistutus välilehdellä 7; migraation versionosto (v5)

## Vaihe 8 — Asiakirjojen linkitys & liitteet ✅ VALMIS

- [x] `documents` saa valinnaisen linkin tietueeseen (`linked_type` + `linked_id`): esim. nuohoustodistus → tulisija
- [x] Asiakirjalomakkeella "Liitä tietueeseen" (Tulisija / Jätevesi / Vesitutkimus / Vakuutus) + linkitetyn tietueen valinta
- [x] `getDocumentsFor()` — tietueen liitteiden haku; Määräaikaishuolto-välilehti näyttää tulisijan nuohoustodistukset (📎)
- [x] `[o]` avaa valitun asiakirjan tiedoston käyttöjärjestelmällä (PDF ym.); migraation versionosto (v6)

---

## Kaikki vaiheet valmiit 🎉

Projekti on nyt kattava suomalaisten hirsitalojen ja mökkien hallintaan: kiinteistöt, tehtävät
(toistuvat mukaan lukien), talous, kulutus, vakuutukset, lakisääteinen määräaikaishuolto, polttopuu,
sauna, vuokraus & vuodenkierto, yhteystiedot, asiakirjat, mittarilukemat sekä raportointi ja varmuuskopiointi.
