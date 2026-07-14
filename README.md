# Enough for Whom?

**Food waste, hunger and access — country by country.**

[Open the live dashboard](https://cafeco09.github.io/food-waste-hunger-map/)

An interactive, evidence-led dashboard exploring how household food waste can coexist with undernourishment and deaths from protein–energy malnutrition. The project treats that coexistence as a structural question about access, affordability, storage, distribution and resilience—not as evidence that household waste directly causes hunger.

## What “food waste” means here

The main map and country comparison use **UNEP's 2022 estimate of household food waste in kilograms per person per year**.

Under the UN Food Waste Index definition, food waste is food and associated inedible parts removed from the human food supply chain. At household level, this can include:

- edible food that was intended to be eaten but was discarded;
- food that spoiled before it was eaten; and
- associated inedible parts such as bones, rinds, peels, pits, stones and eggshells.

It **does not** mean only edible meals that could have been donated. Packaging is excluded. It also does not cover crops left in fields, farm losses, or post-harvest and pre-retail supply-chain losses; those fall under the separate Food Loss Index.

UNEP covers three consumer and retail sectors: **households, food service and retail**. The dashboard's principal map uses the household measure because it has the broadest country coverage. A selected country's profile also shows household, food-service and retail estimates separately.

Many country values are modelled Level I estimates based on available studies and extrapolation. They provide a comparable snapshot of scale, but they should not be treated as precise annual measurements or used to track year-to-year change.

## How to interpret the comparison

The indicators are not divided into a literal “waste-to-hunger” ratio because their units and meanings are not interchangeable. The dashboard instead:

- maps each indicator independently;
- compares countries using a shared population basis;
- shows whether countries fall above or below the median on waste and hunger measures; and
- labels the observation periods and missing values explicitly.

An overlap is descriptive. It is consistent with structural problems in food access and allocation, but it does not prove causation or show how much discarded food could have been safely redistributed.

## Data

- **Household food waste:** UNEP Food Waste Index Report 2024; 2022 benchmark, kg per person per year.
- **Undernourishment:** FAO SDG indicator 2.1.1; latest estimate through 2024. FAO reports this indicator as a rolling three-year estimate.
- **Malnutrition mortality:** WHO Global Health Estimates; annual average across 2019–2021, deaths per 100,000 people.
- **Harmonised downloads and country codes:** Our World in Data.

The prepared dataset is committed in `src/data/countries.json`, so the published dashboard makes no live data API calls. Missing hunger measures remain marked as unavailable rather than being imputed.

### Primary references

- [UNEP Food Waste Index definition and methodology](https://sdgs.unep.org/article/2a5-food-waste-index)
- [UNEP Food Waste Index Report 2024 summary](https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report)
- [FAO undernourishment data via Our World in Data](https://ourworldindata.org/grapher/prevalence-of-undernourishment)
- [WHO malnutrition mortality data via Our World in Data](https://ourworldindata.org/grapher/death-rate-from-malnutrition-ghe)

## Run locally

```bash
npm install
npm run dev
```

Open the local URL displayed by Vite.

## Refresh and validate the data

```bash
npm run data
npm run check
```

`npm run data` downloads and prepares the source datasets. `npm run check` validates the country records and creates the production build in `dist/`.

## GitHub Pages publishing

The compiled static site is committed under `docs/`. Configure GitHub Pages to deploy from the `main` branch and the `/docs` folder:

**Settings → Pages → Build and deployment → Deploy from a branch → main → /docs**
