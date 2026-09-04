# 🏠 Taloni

Taloni on korkealaatuinen ja interaktiivinen komentorivipohjainen (TUI) hallintapaneeli suomalaisten kiinteistöjen (kuten vanhojen hirsitalojen) hallintaan. Järjestelmä tukee virallisia kiinteistötunnuksia, vesijärjestelmien seurantaa (*oma kaivo* vs *kunnan vesi*), tehtävälistoja, remonttibudjetteja, kulutuslaskuja (sähkö/jäte), laitteistoa sekä tulojen ja menojen kirjanpitoa.

Koko käyttöliittymä on toteutettu **puhtaasti suomeksi** ja se toimii suoraan päätteessäsi. Ohjelma on rakennettu **TypeScriptillä**, **Reactilla** ja **Ink-kirjastolla** hyödyntäen Node.js:n sisäänrakennettua **SQLite**-tietokantamoottoria.

---

## Ominaisuudet

- **🏡 Suomalaiset Hirsitalot (3 Kohdetta):**
  1. **Metsäpirtti** (Sysmä, 1948) — Oma kaivo, Kiinteistötunnus `405-412-1-23`
  2. **Järvenranta** (Sysmä, 1965) — Oma kaivo, Kiinteistötunnus `405-412-1-24`
  3. **Pappila** (Tampere, 1910) — Kunnan vesiliittymä, Kiinteistötunnus `837-112-2-45`
- **🔄 Kohdesuodatin:** Paina `[p]` vaihtaaksesi aktiivista kohdetta (kaikki kohteet yhdessä tai yksittäinen talo). Kaikki tilastot suodattuvat reaaliaikaisesti.
- **💰 Tulot & Menot suoraan käyttöliittymässä:** Seuraa vuokratuloja ja huoltomenuja. Kassavirta ja nettotulos lasketaan automaattisesti.
- **✏ Täysi muokkaus & lisäys TUI-lomakkeilla:** Voit lisätä ja muokata tehtäviä sekä taloustapahtumia suoraan käyttöliittymästä poistumatta sovelluksesta.
- **⏰ Määräaikaishuolto & lakisääteiset velvoitteet:** Seuraa nuohousta (vuosittain), jätevesijärjestelmien tyhjennystä, öljysäiliön tarkastuksia ja kaivoveden laatututkimuksia (suositus 3 v välein). Erääntyvät velvoitteet näkyvät yhtenä listana väriltään myöhässä/lähestyy/kunnossa.
- **🔁 Toistuvat tehtävät:** Toistuvan tehtävän (esim. nuohous) merkitseminen valmiiksi luo automaattisesti seuraavan esiintymän seuraavalle jaksolle, jottei lakisääteinen velvoite unohdu.
- **📎 Asiakirjaliitteet:** Liitä PDF-todistus (esim. nuohoustodistus päivämäärineen) suoraan tietueeseen — tulisijaan, jätevesijärjestelmään, vesitutkimukseen tai vakuutukseen. Tulisijan nuohoustodistukset näkyvät Määräaikaishuolto-välilehdellä, ja `[o]` avaa liitetiedoston käyttöjärjestelmän oletussovelluksella.
- **🔌 Liittymät & jätehuolto:** Kirjaa kiinteistölle sähköliittymän koko (pääsulake, esim. 3×25 A), vesiliittymän koko/tyyppi sekä jätehuolto (yhtiö, astiakoko, tyhjennysväli, biojätteen käsittely). Jos biojäte kompostoidaan kotona ilman kunnan ilmoitusta, sovellus muistuttaa ilmoitusvelvollisuudesta (jätelaki 646/2011).
- **🚽 Jäteveden vaatimustenmukaisuus:** Kirjaa jätevesijärjestelmän tyyppi, rakennusvuosi, ranta-/pohjavesialuestatus, wc-vedet ja mahdollinen vapautus. Sovellus arvioi automaattisesti puutteet ja pakolliset toimenpiteet (haja-asutuksen jätevesiasetus VNa 157/2017): herkillä alueilla ohitettu 31.10.2019 takaraja korostuu, muualla korjaus kytkeytyy remonttiin. Arvio on informatiivinen — varmista aina kunnan ympäristönsuojeluviranomaiselta.
- **📊 Raportointi:** Salkkuvertailu (`portfolio`, käyttöaste/ROI/arvonseuranta), remonttien budjetti vs. toteutunut (`renovations`), energiatehokkuus kWh/m²/v (`energy`), lähestyvät/myöhässä olevat velvoitteet (`alerts`), sekä sää FMI:n avoimesta datasta (`weather`).
- **🌐 REST-rajapinta & käyttöönotto:** `taloni serve` käynnistää API-avaimella suojatun REST-rajapinnan (CRUD kaikille tietueille). Dockerfile, docker-compose (valinnainen Caddy + automaattinen TLS) ja OCI-käyttöönoton GitHub Actions -työnkulku — ks. [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Aloitusopas

### Esivaatimukset

- **Node.js >= 22.5.0** (vaaditaan natiiville `node:sqlite`-moduulille)
- **npm** (tulee Node.js:n mukana)

### Asennus

Asenna riippuvuudet projektihakemistossa:

```bash
git clone https://github.com/mongrelx/taloni.git
cd taloni
npm install
```

### Kääntäminen (Build) & Globaali linkitys

Käännä TypeScript-tiedostot ja luo ajettava moduuli:

```bash
npm run build
```

Voit linkittää sovelluksen järjestelmänlaajuiseksi `taloni`-komennoksi:

```bash
npm link
# Tämän jälkeen voit ajaa 'taloni' missä tahansa hakemistossa!
```

---

## Käyttöohjeet

### 1. Graafisen TUI-paneelin käynnistäminen

Käynnistä sovellus komentoriviltä:

```bash
# Kehitystila
npm run dev

# Valmis käännetty versio
npm start
```

#### TUI-Pikavalinnat
- `[1] - [6]` - Vaihda välilehteä:
  - **`1`**: Yleisnäkymä (Kooste kaikesta)
  - **`2`**: Tehtävälista (Interaktiivinen tehtävienhallinta)
  - **`3`**: Talous & Korjaukset (Kulukirjanpito ja remontit)
  - **`4`**: Sähkö & Kulutus (Laskutustiedot)
  - **`5`**: Vakuutus & Kalusto (Laitteet ja vakuutukset)
  - **`6`**: Määräaikaishuolto (Lakisääteiset velvoitteet: nuohous, jätevesi, lämmitystarkastukset, kaivovesi + jäteveden vaatimustenmukaisuusarvio)
  - **`7`**: Polttopuu & Sauna (Polttopuuvarasto sekä saunat ja kiinteät vuosikulut)
  - **`8`**: Vuokraus & Kausi (Vuokrauskalenteri + kevätavaus/syyssulku-tarkistuslistat)
  - **`9`**: Yhteystiedot & Arkisto (Palveluntarjoajat, asiakirjat ja mittarilukemat)
- `[p]` - **Vaihda kohdetta**: Kierrätä suodatusta (Kaikki, Metsäpirtti, Järvenranta, Pappila).
- `[q]` - Sulje sovellus turvallisesti.

#### Yleisnäkymä (Välilehti 1):
- `[a]` - Lisää uusi kiinteistö.
- `[e]` - Muokkaa valittua kiinteistöä (valitse ensin `[p]`).
- `[d]` - Poista valittu kiinteistö (valitse ensin `[p]`). **Huom:** poistaa myös kaikki kiinteistöön liittyvät tehtävät, tapahtumat ja vakuutukset.

#### Tehtävien hallinta (Välilehti 2):
- `[Nuoli ylös / Nuoli alas]` - Selaa tehtäväriviä.
- `[Välilyönti / Enter]` - Vaihda tehtävän tilaa: `Kesken` ➔ `Työn alla` ➔ `Valmis`.
- `[a]` - Avaa lomake uuden tehtävän lisäämiseksi.
- `[e]` - Avaa valitun tehtävän muokkauslomake.
- `[d]` - Poista valittu tehtävä tietokannasta.

#### Talous & Korjaukset (Välilehti 3):
Välilehdellä on kaksi listaa rinnakkain: **remonttihankkeet** ja **taloustapahtumat**. `[a]`, `[e]` ja `[d]` kohdistuvat aina aktiivisena olevaan listaan.
- `[Nuoli vasen / Nuoli oikea]` tai `[Tab]` - Vaihda fokus remontti- ja tapahtumalistan välillä.
- `[Nuoli ylös / Nuoli alas]` - Selaa fokusoitua listaa.
- `[a]` - Lisää uusi remonttihanke tai taloustapahtuma fokuksen mukaan.
- `[e]` - Muokkaa valittua riviä.
- `[d]` - Poista valittu rivi.

#### Sähkö & Kulutus (Välilehti 4):
- `[Nuoli ylös / Nuoli alas]` - Selaa kulutuslaskuja.
- `[a]` - Kirjaa uusi kulutuslasku (sähkösiirto, sähköenergia, vesi, jäte jne.).
- `[e]` - Muokkaa valittua kulutuslaskua.
- `[d]` - Poista valittu kulutuslasku.

#### Vakuutus & Kalusto (Välilehti 5):
Välilehdellä on kaksi listaa rinnakkain: **kalusto** ja **vakuutukset**. `[a]`, `[e]` ja `[d]` kohdistuvat aktiivisena olevaan listaan.
- `[Nuoli vasen]` - Aseta fokus kalustolistaan.
- `[Nuoli oikea]` - Aseta fokus vakuutuslistaan.
- `[Tab]` - Vaihda fokus listojen välillä.
- `[Nuoli ylös / Nuoli alas]` - Selaa fokusoitua listaa.
- `[a]` / `[e]` / `[d]` - Lisää, muokkaa tai poista fokusoidun listan rivi.

#### Määräaikaishuolto (Välilehti 6):
Ylhäällä on kooste **erääntyvistä lakisääteisistä velvoitteista** (myöhässä/lähestyy/kunnossa) ja alla neljä rekisteriä: **tulisijat**, **jätevesijärjestelmät**, **lämmitys** ja **kaivovesitutkimukset**. `[a]`, `[e]` ja `[d]` kohdistuvat aktiivisena olevaan rekisteriin.
- `[Tab]` tai `[Nuoli vasen / Nuoli oikea]` - Vaihda aktiivista rekisteriä (kierrätys neljän välillä).
- `[Nuoli ylös / Nuoli alas]` - Selaa fokusoidun rekisterin rivejä.
- `[a]` - Lisää uusi tulisija / jätevesijärjestelmä / lämmitysjärjestelmä / vesitutkimus.
- `[e]` - Muokkaa valittua riviä.
- `[d]` - Poista valittu rivi.

**Toistuvat tehtävät:** Tehtävälomakkeella (Välilehti 2) voit valita toistuvuuden (Ei toistu / Kuukausittain / Neljännesvuosittain / Vuosittain / 3 v välein). Toistuvan tehtävän merkitseminen valmiiksi luo automaattisesti seuraavan esiintymän, jolloin esim. vuosittainen nuohous pysyy aina listalla.

#### Polttopuu & Sauna (Välilehti 7):
Vasemmalla **polttopuuvarasto** (täysi lisää/muokkaa/poista) ja oikealla **saunat & kiinteät vuosikulut** -kooste.
- `[Nuoli ylös / Nuoli alas]` - Selaa polttopuueriä.
- `[a]` / `[e]` / `[d]` - Lisää, muokkaa tai poista polttopuuerä (puulaji, määrä pino-m³/motti/irto-m³, kuivumisaste, varastopaikka).
- Saunatyyppi (puukiuas / sähkökiuas), kiinteistövero ja tiekuntamaksu muokataan kiinteistölomakkeella (Välilehti 1).

**Erääntyy 30 pv sisällä:** Yleisnäkymä (Välilehti 1) näyttää ylimpänä koosteen kaikista lähipäivinä erääntyvistä velvoitteista — tehtävät, vakuutusten uusinnat, nuohous, jätevesityhjennykset ja lämmitystarkastukset yhdessä listassa.

#### Vuokraus & Kausi (Välilehti 8):
Vasemmalla **vuokrauskalenteri** (varaukset kuukausittain ryhmiteltynä, öiden ja tulojen kooste) ja oikealla **kausikatsaukset**.
- `[Nuoli ylös / Nuoli alas]` - Selaa varauksia.
- `[a]` / `[e]` / `[d]` - Lisää, muokkaa tai poista varaus (varaaja, saapuminen/lähtö, hinta, tila: alustava/vahvistettu/valmis/peruttu).
- `[Enter]` - Kirjaa valitun varauksen **vuokratulo taloustapahtumaksi** (kerran per varaus; näkyy Talous-välilehdellä). Kirjatut varaukset merkitään `€✓`.
- `[k]` - Luo **Kevätavaus**-tarkistuslista tehtävinä valitulle kohteelle (avaa vesihana, käynnistä pumppu, kaivovesinäyte, ...).
- `[s]` - Luo **Syyssulku**-tarkistuslista (sulje vesi, tyhjennä putket, pakkasneste, katkaise sähköt, ...).
- **Huom:** Kausikatsausten luonti vaatii yksittäisen kohteen valinnan `[p]`-näppäimellä.

#### Yhteystiedot & Arkisto (Välilehti 9):
Kolme rekisteriä: **yhteystiedot** (palveluntarjoajat), **asiakirjat** ja **mittarilukemat**. `[a]`, `[e]` ja `[d]` kohdistuvat aktiivisena olevaan rekisteriin.
- `[Tab]` tai `[Nuoli vasen / Nuoli oikea]` - Vaihda aktiivista rekisteriä.
- `[Nuoli ylös / Nuoli alas]` - Selaa fokusoidun rekisterin rivejä.
- `[a]` / `[e]` / `[d]` - Lisää, muokkaa tai poista rivi.
- **Yhteystiedot** ovat yhteisiä kaikille kohteille (nuohooja, LVI, sähkö, loka-auto, isännöinti).
- **Asiakirjat** ja **mittarilukemat** ovat kohdekohtaisia. Mittarilukemista lasketaan automaattisesti kulutus edelliseen saman kohteen ja mittarin lukemaan verrattuna.
- **Asiakirjan voi liittää tietueeseen** (lomakkeen "Liitä tietueeseen" -kenttä): esim. nuohoustodistus tulisijaan. `[o]` avaa valitun asiakirjan tiedoston käyttöjärjestelmällä.

#### Lomakkeen ohjaus (kun lomake on auki):
- `[Nuoli ylös / Nuoli alas]` tai `[Tab]` - Siirrä kohdistusta kenttien välillä.
- `[Nuoli vasen / Nuoli oikea]` - Muuta valintoja (esim. kohde, kiireellisyys, tyyppi).
- `[Kirjoita näppäimillä]` - Syötä tekstiä tai numeroita aktiiviseen kenttään.
- `[Backspace]` - Poista merkki.
- `[Enter]` - Siirry eteenpäin tai tallenna tiedot kun kohdistus on tallennuspainikkeella.
- `[Esc]` - Peruuta lomake ja palaa takaisin.

---

### 2. Komentorivityökalut (CLI)

Voit myös käyttää suoria komentorivikomentoja:

```bash
# Listaa kaikki kiinteistöt ja kiinteistötunnukset
node dist/cli.js properties

# Listaa tehtävät
node dist/cli.js list

# Lisää tehtävä tai taloustapahtuma (syötteet validoidaan)
node dist/cli.js add-task "Hormien nuohous" -p high -c Paloturvallisuus -s 65 -i 1
node dist/cli.js add-tx 650 -t income -c Vuokraus -d "Mökin vuokratulo" -i 1

# Raportit: vuosikooste + vuokratuloraportti verottajalle
node dist/cli.js report 2026
node dist/cli.js report 2026 --rental-only

# Salkkuvertailu, remonttien budjetti vs. toteutunut, energiatehokkuus, hälytykset
node dist/cli.js portfolio 2026
node dist/cli.js renovations
node dist/cli.js energy 2026
node dist/cli.js alerts --days 30

# Sää (Ilmatieteen laitoksen avoin data — ainoa ulkoinen verkkokutsu koko sovelluksessa)
node dist/cli.js weather
node dist/cli.js weather Tampere

# Kirjaa kiinteistön arvioitu arvo (arvonseuranta ajan yli)
node dist/cli.js add-valuation 1 250000 -s "Kiinteistönvälittäjän arvio"

# Vie taulut CSV-tiedostoiksi (oletushakemisto ./taloni-export), koko tietokanta JSON:ksi,
# tai kuvagalleria/asiakirjat HTML-sivuksi
node dist/cli.js export
node dist/cli.js export ~/varmuuskopiot/csv
node dist/cli.js export-json
node dist/cli.js gallery

# Tuo kiinteistöjä tai taloustapahtumia CSV:stä (sarakkeet: ks. export-komennon tuottama tiedosto)
node dist/cli.js import properties uudet-kiinteistot.csv
node dist/cli.js import transactions kulut.csv

# Varmuuskopioi tietokanta aikaleimatulla nimellä (~/.taloni/backups)
node dist/cli.js backup

# Käynnistä REST-rajapinta (katso DEPLOYMENT.md Docker-/OCI-käyttöönottoon)
node dist/cli.js serve
```

### 3. Laadunvalvonta & Testaus

```bash
# Aja kaikki testit (CLI, tietokanta, migraatiot, raportointi, sää, REST-rajapinta, validointi)
npm test

# Tarkista koodin tyyli ja säännöt Biome-linterillä
npm run lint

# Korjaa muotoilu- ja lint-virheet automaattisesti
npm run lint:fix
```

---

## Projektin rakenne

- `src/cli.ts` — Komentorivikäyttöliittymä (Commander), TUI-käynnistys ja alikomennot
- `src/db.ts` — SQLite-tietokantaskeema, migraatiot, siemenaineisto ja kaikki CRUD-toiminnot
- `src/report.ts` — Vuosikooste, vuokratuloraportti ja CSV-vientitoiminnot
- `src/validate.ts` — Syötteiden validointi (puhtaat funktiot)
- `src/ui/Dashboard.tsx` — Ink-pohjainen interaktiivinen TUI-komponentti (9 välilehteä)
- `test/` — Yksikkö- ja integraatiotestit (`node:test` + `node:assert/strict`)
- `.github/workflows/` — CI- ja Release-automaatiot (GitHub Actions)
