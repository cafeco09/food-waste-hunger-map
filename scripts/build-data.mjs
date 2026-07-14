import { csvParse } from 'd3';
import countryMeta from 'world-countries';
import { mkdir, writeFile } from 'node:fs/promises';

const SOURCES = {
  foodWaste: 'https://ourworldindata.org/grapher/food-waste-per-capita.csv',
  undernourishment: 'https://ourworldindata.org/grapher/prevalence-of-undernourishment.csv',
  undernourishedPeople: 'https://ourworldindata.org/grapher/number-undernourished.csv',
  deathRate: 'https://ourworldindata.org/grapher/death-rate-from-malnutrition-ghe.csv',
  deaths: 'https://ourworldindata.org/grapher/deaths-from-malnutrition-ghe.csv'
};

const fetchCsv = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Waste-Want data build (GitHub Pages project)' }
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return csvParse(await response.text());
};

const [foodRows, underRows, peopleRows, deathRateRows, deathsRows] = await Promise.all(
  Object.values(SOURCES).map(fetchCsv)
);

const metadata = new Map(
  countryMeta.map((country) => [
    country.cca3,
    {
      code: country.cca3,
      numericCode: country.ccn3,
      name: country.name.common,
      officialName: country.name.official,
      region: country.region,
      subregion: country.subregion
    }
  ])
);

const numericColumn = (rows) => Object.keys(rows[0]).find((key) => !['Entity', 'Code', 'Year'].includes(key));

const latestByCode = (rows, maxYear = Infinity) => {
  const valueColumn = numericColumn(rows);
  const result = new Map();

  for (const row of rows) {
    if (!row.Code || !metadata.has(row.Code)) continue;
    const year = Number(row.Year);
    const value = Number(row[valueColumn]);
    if (!Number.isFinite(value) || year > maxYear) continue;
    const previous = result.get(row.Code);
    if (!previous || year > previous.year) result.set(row.Code, { value, year });
  }
  return result;
};

const atYearByCode = (rows, year) => {
  const valueColumn = numericColumn(rows);
  const result = new Map();
  for (const row of rows) {
    if (Number(row.Year) !== year || !metadata.has(row.Code)) continue;
    const value = Number(row[valueColumn]);
    if (Number.isFinite(value)) result.set(row.Code, value);
  }
  return result;
};

const food2022 = new Map();
for (const row of foodRows) {
  if (Number(row.Year) !== 2022 || !metadata.has(row.Code)) continue;
  const household = Number(row.Household);
  if (!Number.isFinite(household)) continue;
  food2022.set(row.Code, {
    household,
    retail: Number(row.Retail),
    foodService: Number(row['Out-of-home consumption'])
  });
}

const underLatest = latestByCode(underRows, 2024);
const deathRateLatest = latestByCode(deathRateRows, 2021);
const deathsLatest = latestByCode(deathsRows, 2021);
const underPeopleLatest = latestByCode(peopleRows, 2024);

const countries = [...food2022.entries()]
  .map(([code, food]) => {
    const meta = metadata.get(code);
    const under = underLatest.get(code);
    const deathRate = deathRateLatest.get(code);
    const deaths = deathsLatest.get(code);
    const underPeople = underPeopleLatest.get(code);
    return {
      ...meta,
      foodWasteKg: round(food.household, 2),
      retailWasteKg: round(food.retail, 2),
      foodServiceWasteKg: round(food.foodService, 2),
      undernourishedPct: under ? round(under.value, 2) : null,
      undernourishmentYear: under?.year ?? null,
      undernourishedMillions: underPeople ? round(underPeople.value / 1_000_000, 3) : null,
      undernourishedPeopleYear: underPeople?.year ?? null,
      malnutritionDeathRate: deathRate ? round(deathRate.value, 2) : null,
      malnutritionDeaths: deaths ? Math.round(deaths.value) : null,
      mortalityYear: deathRate?.year ?? deaths?.year ?? null
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const worldFood = foodRows.find((row) => row.Entity === 'World' && Number(row.Year) === 2022);
const worldUnder = latestWorld(underRows, 2024);
const worldPeople = latestWorld(peopleRows, 2024);
const worldDeathRate = latestWorld(deathRateRows, 2021);
const worldDeaths = latestWorld(deathsRows, 2021);

const output = {
  generatedAt: new Date().toISOString(),
  sources: {
    foodWaste: { producer: 'UNEP', year: 2022, accessedVia: 'Our World in Data' },
    undernourishment: { producer: 'FAO', year: worldUnder?.year ?? 2024, accessedVia: 'Our World in Data' },
    mortality: { producer: 'WHO', year: worldDeathRate?.year ?? 2021, accessedVia: 'Our World in Data' }
  },
  global: {
    foodWasteKg: worldFood ? round(Number(worldFood.Household), 1) : 79,
    undernourishedPct: worldUnder ? round(worldUnder.value, 1) : null,
    undernourishedMillions: worldPeople ? round(worldPeople.value / 1_000_000, 1) : null,
    malnutritionDeathRate: worldDeathRate ? round(worldDeathRate.value, 2) : null,
    malnutritionDeaths: worldDeaths ? Math.round(worldDeaths.value) : null
  },
  countries
};

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/countries.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${countries.length} country records.`);

function latestWorld(rows, maxYear) {
  const valueColumn = numericColumn(rows);
  return rows
    .filter((row) => row.Entity === 'World' && Number(row.Year) <= maxYear && Number.isFinite(Number(row[valueColumn])))
    .map((row) => ({ value: Number(row[valueColumn]), year: Number(row.Year) }))
    .sort((a, b) => b.year - a.year)[0];
}

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
