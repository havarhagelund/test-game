# Sandkassa 🚜

Et koselig 3D-leketøy i nettleseren: styr en gravemaskin i en sandkasse, grav, flytt sand til hauger, fyll dumperen og bygg sandslott. Laget for mobil/nettbrett (touch), men fungerer også med tastatur.

## Kjør lokalt

```bash
npm install
npm run dev      # http://localhost:5173 (også synlig på nettverket, så du kan teste på mobilen)
npm run build    # produksjonsbygg i dist/
```

## Styring

**Enkel modus (standard)**

| Gravemaskin | |
|---|---|
| Venstre spak | Kjør fram/bak, sving |
| Høyre spak | Løft/senk armen (↕), sving overvognen (↔) |
| Ut / Inn-spak | Strekk armen ut eller trekk den inn |
| 🪣 | Veksle mellom grave/bære og tømme skuffen |
| 🏰 | Gjør en full skuff om til et slott-tårn (rundt, firkantet, spir) |

| Dumper | |
|---|---|
| Venstre spak | Kjør og styr |
| ⤴ Tipp | Vipp lasteplanet og tøm sanda bak |

**Ekspert-modus** gir ekte ISO-styring: venstre spak = stikke (↕) og sving (↔), høyre spak = bom (↕) og skuff (↔), og to beltespaker i midten. For dumperen styres tippen med en egen spak.

Dra på skjermen for å se rundt, knip (eller scroll) for zoom. Knappene øverst bytter kjøretøy, styremodus, lyd, fullskjerm og nullstiller sandkassa (trykk to ganger).

**Tastatur:** WASD kjør · piltaster arm · Q/E inn/ut · Mellomrom skuff/tipp · C slott · Tab bytt kjøretøy · X bytt modus. I ekspert-modus styrer WASD beltene, IJKL venstre spak og piltastene høyre spak.

## Teknisk

- **Three.js** for grafikk. Alle modeller er laget prosedyrisk i kode (avrundede former, pastellfarger, myke skygger).
- **Sand** er et høydekart (160×160 celler over 16×16 enheter) med skred mot en rasvinkel på 34°. Bare aktive celler simuleres, så det går fint på mobil. Bunnplankene er y = 0, så man kan grave helt ned. Slott-sand er «pakket» og holder formen til man graver i den.
- **Sandklumper** i lufta (fra skuff og lasteplan) er egne partikler som lander i sanda eller fanges av lasteplanet.
- **Rapier** (WASM) håndterer lekene (baller, klosser, bøtte, spade, badeand). Terrenget speiles som et heightfield, og kjøretøyene er kinematiske kropper som dytter lekene.
- **Lyd** er syntetisert med Web Audio (motor, hydraulikk, sandskrap, pling). Ingen lydfiler.

Koden ligger i `src/`: `sand.js` (høydekart og skred), `excavator.js`, `truck.js`, `vehicle.js` (terrengfølging), `grains.js`, `physics.js`, `controls.js`, `camera.js`, `audio.js`, `world.js` (hagen).

## Publisering

`.github/workflows/pages.yml` bygger og publiserer til GitHub Pages ved push til `main`. Slå på Pages i repo-innstillingene med kilde «GitHub Actions».
