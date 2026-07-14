# Waste / Want

An interactive, evidence-led GitHub Pages site comparing household food waste with undernourishment and protein–energy-malnutrition deaths by country.

The project deliberately avoids a literal “food waste divided by hunger” ratio. The units are not interchangeable, so the country profile instead uses a shared population base: annual tonnes of household food waste per 100 residents alongside undernourished people per 100 residents.

## Data

- Household food waste: UNEP Food Waste Index 2024, estimates for 2022.
- Undernourishment: FAO SDG indicator 2.1.1, latest value through 2024.
- Malnutrition mortality: WHO Global Health Estimates, latest comparable value for 2021.
- Harmonised downloads and country codes: Our World in Data.

The table covers countries and territories where UNEP provides a 2022 estimate; missing hunger measures remain explicitly marked rather than imputed by this project.

The prepared dataset is committed in `src/data/countries.json`, so the published page does not make live API calls. Run `npm run data` to refresh it from the source downloads.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Validate and build

```bash
npm run check
```

The production site is written to `dist/`.

## Publish on GitHub Pages

1. Create a GitHub repository and add this project.
2. Push it to the `main` branch.
3. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source.
4. Run the **Deploy GitHub Pages** workflow, or push a new commit to `main`.

The Vite base path is relative, so the build works for both account-level and project-level GitHub Pages URLs.
