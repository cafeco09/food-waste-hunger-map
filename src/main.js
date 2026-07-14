import './styles.css';
import data from './data/countries.json';
import world from 'world-atlas/countries-110m.json';
import { feature } from 'topojson-client';
import {
  axisBottom,
  axisLeft,
  extent,
  format,
  geoNaturalEarth1,
  geoPath,
  interpolateRgbBasis,
  median,
  quantile,
  scaleLinear,
  scaleSequential,
  select
} from 'd3';

const countries = data.countries;
const mapFeatures = feature(world, world.objects.countries).features;
const byNumericCode = new Map(countries.map((country) => [country.numericCode, country]));
const byCode = new Map(countries.map((country) => [country.code, country]));
const number = new Intl.NumberFormat('en-GB');
const oneDecimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const metrics = {
  foodWasteKg: {
    short: 'Food waste',
    label: 'Household food waste',
    unit: 'kg per person / year',
    palette: ['#f3eee4', '#efc86c', '#de762f', '#8f2b1f'],
    formatter: (value) => `${oneDecimal.format(value)} kg`
  },
  undernourishedPct: {
    short: 'Undernourished',
    label: 'People undernourished',
    unit: '% of population',
    palette: ['#f3eee4', '#e9b9a6', '#c95346', '#651f32'],
    formatter: (value) => `${oneDecimal.format(value)}%`
  },
  malnutritionDeathRate: {
    short: 'Deaths',
    label: 'Protein–energy malnutrition deaths',
    unit: 'per 100,000 people',
    palette: ['#f3eee4', '#d8c2b1', '#a95952', '#4b1e29'],
    formatter: (value) => `${oneDecimal.format(value)} / 100k`
  }
};

const medianWaste = median(countries, (country) => country.foodWasteKg);
const medianUnder = median(countries.filter((country) => country.undernourishedPct !== null), (country) => country.undernourishedPct);
const medianDeaths = median(countries.filter((country) => country.malnutritionDeathRate !== null), (country) => country.malnutritionDeathRate);

const state = {
  activeTab: ['overview', 'map', 'relationship', 'regions', 'countries', 'method'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview',
  mapMetric: 'undernourishedPct',
  hungerMetric: 'undernourishedPct',
  selectedCode: null,
  insightRegion: 'All',
  tableSearch: '',
  region: 'All',
  sortKey: 'undernourishedPct',
  sortDirection: 'desc'
};

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="site-header">
    <button class="brand" type="button" data-tab="overview" aria-label="Waste / Want home">
      <span>WASTE</span><i aria-hidden="true"></i><span>WANT</span>
    </button>
    <nav class="dashboard-tabs" aria-label="Dashboard sections" role="tablist">
      ${[['overview','Overview'],['map','Map'],['relationship','Relationship'],['regions','Regions'],['countries','Countries'],['method','Method']].map(([key,label]) => `<button type="button" role="tab" data-tab="${key}" aria-selected="${key === state.activeTab}" class="${key === state.activeTab ? 'active' : ''}">${label}</button>`).join('')}
    </nav>
  </header>

  <main id="top">
    <div class="tab-panel" data-panel="overview" ${state.activeTab === 'overview' ? '' : 'hidden'}>
    <section class="hero" aria-labelledby="hero-title">
      <div class="eyebrow"><span>Global food systems</span><span>Country comparison</span></div>
      <div class="hero-grid">
        <div>
          <h1 id="hero-title">Food wasted.<br><em>Hunger endured.</em></h1>
          <p class="hero-intro">A country-by-country view of what households discard and how many people still do not get enough to eat.</p>
          <button class="primary-link" type="button" data-tab="map">Enter the data <span aria-hidden="true">→</span></button>
        </div>
        <div class="hero-facts" aria-label="Global headline figures">
          <div class="hero-fact hero-fact-waste">
            <span class="fact-number">${oneDecimal.format(data.global.foodWasteKg)}</span>
            <span class="fact-unit">kg</span>
            <p>household food waste per person in 2022</p>
          </div>
          <div class="hero-fact hero-fact-hunger">
            <span class="fact-number">${data.global.undernourishedMillions ? oneDecimal.format(data.global.undernourishedMillions) : '—'}</span>
            <span class="fact-unit">million</span>
            <p>people undernourished in ${data.sources.undernourishment.year}</p>
          </div>
        </div>
      </div>
      <div class="hero-note">
        <span aria-hidden="true">↳</span>
        <p><strong>Read this as contrast, not causation.</strong> Food waste in one country does not directly cause hunger in another—and not all measured food waste is edible.</p>
      </div>
    </section>

    <section class="statement" aria-label="Framing statement">
      <p>The same food system can produce <span>surplus</span> and <span>scarcity</span>. The question is not only how much exists, but who can access it.</p>
    </section>
    <section class="period-strip" aria-label="Data periods">
      <article><span>Food waste</span><strong>2022 benchmark</strong><p>UNEP household estimate; not an annual series.</p></article>
      <article><span>Undernourishment</span><strong>Latest FAO estimate</strong><p>Published as a rolling three-year average.</p></article>
      <article><span>Mortality</span><strong>${data.sources.mortality.period} average</strong><p>Mean of the latest three WHO annual estimates.</p></article>
    </section>
    </div>

    <section class="explore-section tab-panel" data-panel="map" id="map" aria-labelledby="explore-title" ${state.activeTab === 'map' ? '' : 'hidden'}>
      <div class="section-heading">
        <div>
          <span class="section-index">01 / Explore</span>
          <h2 id="explore-title">A world of contrasts</h2>
        </div>
        <p>Choose a measure, then select a country on the map for its full profile.</p>
      </div>

      <div class="map-card">
        <div class="map-toolbar">
          <div class="segmented-control" id="map-metric-control" aria-label="Map metric">
            ${Object.entries(metrics).map(([key, metric]) => `<button type="button" data-map-metric="${key}" class="${key === state.mapMetric ? 'active' : ''}" aria-pressed="${key === state.mapMetric}">${metric.short}</button>`).join('')}
          </div>
          <label class="country-picker">
            <span>Find a country</span>
            <select id="country-select">
              <option value="">Select…</option>
              ${countries.map((country) => `<option value="${country.code}">${country.name}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="map-title-row">
          <div>
            <p id="map-kicker">${metrics[state.mapMetric].unit}</p>
            <h3 id="map-title">${metrics[state.mapMetric].label}</h3>
          </div>
          <div id="map-legend" class="map-legend" aria-hidden="true"></div>
        </div>
        <div class="map-wrap">
          <svg id="world-map" role="img" aria-label="World map showing hunger and food-waste indicators by country"></svg>
          <div class="tooltip" id="map-tooltip" role="status"></div>
        </div>
        <div class="map-footer">
          <span><i class="dot dot-data"></i> Data available</span>
          <span><i class="dot dot-missing"></i> No matching data</span>
          <span class="map-source">UNEP 2022 · FAO rolling 3-year · WHO ${data.sources.mortality.period} avg</span>
        </div>
      </div>

      <article class="country-profile empty" id="country-profile" aria-live="polite">
        <div class="profile-empty-mark" aria-hidden="true">↖</div>
        <div>
          <p class="profile-kicker">Country profile</p>
          <h3>Choose a country to bring the comparison into focus.</h3>
          <p>The profile uses a shared population base: tonnes of household food waste per 100 residents, beside people undernourished per 100 residents.</p>
        </div>
      </article>
    </section>

    <section class="relationship-section tab-panel" data-panel="relationship" aria-labelledby="relationship-title" ${state.activeTab === 'relationship' ? '' : 'hidden'}>
      <div class="section-heading light-heading">
        <div>
          <span class="section-index">02 / Relationship</span>
          <h2 id="relationship-title">Does more waste mean more hunger?</h2>
        </div>
        <p>No simple rule emerges. Explore the distribution; proximity is descriptive, not proof of cause.</p>
      </div>
      <div class="chart-card">
        <div class="chart-toolbar">
          <div>
            <p class="chart-kicker">Household food waste vs.</p>
            <div class="segmented-control dark-control" id="hunger-metric-control" aria-label="Hunger measure for scatter chart">
              <button type="button" data-hunger-metric="undernourishedPct" class="active" aria-pressed="true">Undernourishment</button>
              <button type="button" data-hunger-metric="malnutritionDeathRate" aria-pressed="false">Malnutrition deaths</button>
            </div>
          </div>
          <div class="chart-key">
            <span><i class="dot dot-country"></i> Country</span>
            <span><i class="dot dot-selected"></i> Selected</span>
          </div>
        </div>
        <div class="scatter-wrap">
          <svg id="scatter-chart" role="img" aria-label="Scatter plot comparing household food waste and hunger by country"></svg>
          <div class="tooltip dark-tooltip" id="scatter-tooltip" role="status"></div>
        </div>
        <p class="chart-note" id="chart-note">Each dot is a country. Axes use per-person or population-normalised values to avoid population size dominating the comparison.</p>
      </div>
    </section>

    <section class="regions-section tab-panel" data-panel="regions" aria-labelledby="regions-title" ${state.activeTab === 'regions' ? '' : 'hidden'}>
      <div class="section-heading">
        <div>
          <span class="section-index">03 / Regions</span>
          <h2 id="regions-title">Where waste and hunger overlap</h2>
        </div>
        <label class="filter-field region-insight-filter"><span>Region</span><select id="insight-region-select"><option>All</option>${[...new Set(countries.map((country) => country.region))].sort().map((region) => `<option>${region}</option>`).join('')}</select></label>
      </div>
      <p class="region-intro" id="region-intro"></p>
      <div class="region-summary" id="region-summary"></div>
      <div class="region-ranking">
        <div class="profile-label-row"><span>Countries with the strongest overlap</span><strong id="region-coverage"></strong></div>
        <div id="region-country-list" class="region-country-list"></div>
      </div>
      <p class="profile-caveat"><strong>How to read this:</strong> medians prevent very large countries from dominating. The overlap score is a descriptive rank based equally on household waste, undernourishment and malnutrition mortality; it is not a causal or severity index.</p>
    </section>

    <section class="countries-section tab-panel" data-panel="countries" id="countries" aria-labelledby="countries-title" ${state.activeTab === 'countries' ? '' : 'hidden'}>
      <div class="section-heading">
        <div>
          <span class="section-index">03 / Countries</span>
          <h2 id="countries-title">The full country view</h2>
        </div>
        <p>Search, sort and compare every country covered by the UNEP food-waste estimates.</p>
      </div>

      <div class="table-controls">
        <label class="search-field">
          <span class="visually-hidden">Search countries</span>
          <span aria-hidden="true">⌕</span>
          <input id="table-search" type="search" placeholder="Search a country" autocomplete="off" />
        </label>
        <label class="filter-field">
          <span>Region</span>
          <select id="region-select">
            <option>All</option>
            ${[...new Set(countries.map((country) => country.region))].sort().map((region) => `<option>${region}</option>`).join('')}
          </select>
        </label>
        <p id="result-count" class="result-count"></p>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button type="button" data-sort="name">Country <span>↕</span></button></th>
              <th><button type="button" data-sort="foodWasteKg">Household waste <small>kg / person / yr</small> <span>↕</span></button></th>
              <th><button type="button" data-sort="undernourishedPct">Undernourished <small>% of population</small> <span>↕</span></button></th>
              <th><button type="button" data-sort="malnutritionDeathRate">Malnutrition deaths <small>per 100,000 · 3-year avg</small> <span>↕</span></button></th>
              <th>Pattern</th>
            </tr>
          </thead>
          <tbody id="country-table-body"></tbody>
        </table>
        <div id="table-empty" class="table-empty" hidden>No countries match those filters.</div>
      </div>
    </section>

    <section class="method-section tab-panel" data-panel="method" id="method" aria-labelledby="method-title" ${state.activeTab === 'method' ? '' : 'hidden'}>
      <div class="section-heading light-heading">
        <div>
          <span class="section-index">04 / Method</span>
          <h2 id="method-title">What the numbers mean</h2>
        </div>
        <p>Transparent definitions are part of the visualisation, not an optional appendix.</p>
      </div>
      <div class="method-grid">
        <article>
          <span>01</span>
          <h3>Food waste</h3>
          <p>UNEP’s 2022 household estimate in kilograms per person per year. It includes edible and inedible parts and contains modelled estimates where direct national measurement is unavailable.</p>
          <a href="https://www.unep.org/resources/publication/food-waste-index-report-2024" target="_blank" rel="noreferrer">UNEP Food Waste Index 2024 ↗</a>
        </article>
        <article>
          <span>02</span>
          <h3>Undernourishment</h3>
          <p>FAO’s estimated share of people whose habitual calorie intake is insufficient for a normal, active life. Values are three-year averages; very low estimates are reported at the 2.5% threshold.</p>
          <a href="https://ourworldindata.org/grapher/prevalence-of-undernourishment" target="_blank" rel="noreferrer">FAO data via OWID ↗</a>
        </article>
        <article>
          <span>03</span>
          <h3>Malnutrition deaths</h3>
          <p>WHO’s estimated deaths from protein–energy malnutrition—not every death in which hunger contributed. Rates shown are annual averages across ${data.sources.mortality.period}.</p>
          <a href="https://ourworldindata.org/grapher/death-rate-from-malnutrition-ghe" target="_blank" rel="noreferrer">WHO data via OWID ↗</a>
        </article>
        <article class="method-warning">
          <span>!</span>
          <h3>What this cannot prove</h3>
          <p>The indicators use different measurement systems. Their periods are displayed throughout; a correlation does not establish that domestic waste causes domestic hunger, nor that all discarded food could have been safely redistributed.</p>
        </article>
      </div>
    </section>
  </main>

  <footer>
    <button class="brand footer-brand" type="button" data-tab="overview"><span>WASTE</span><i></i><span>WANT</span></button>
    <p>An open, evidence-led data story. Built for GitHub Pages.</p>
    <button type="button" data-tab="overview">Overview ↑</button>
  </footer>
`;

const mapTooltip = document.querySelector('#map-tooltip');
const scatterTooltip = document.querySelector('#scatter-tooltip');

renderMap();
renderScatter();
renderTable();
renderRegionInsights();
bindEvents();

function bindEvents() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (button) activateTab(button.dataset.tab);
  });
  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1), false));
  document.querySelector('#map-metric-control').addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-metric]');
    if (!button) return;
    state.mapMetric = button.dataset.mapMetric;
    updateActiveButtons('#map-metric-control', button);
    renderMap();
  });

  document.querySelector('#hunger-metric-control').addEventListener('click', (event) => {
    const button = event.target.closest('[data-hunger-metric]');
    if (!button) return;
    state.hungerMetric = button.dataset.hungerMetric;
    updateActiveButtons('#hunger-metric-control', button);
    renderScatter();
  });

  document.querySelector('#country-select').addEventListener('change', (event) => {
    if (event.target.value) selectCountry(event.target.value, true);
  });

  document.querySelector('#table-search').addEventListener('input', (event) => {
    state.tableSearch = event.target.value.trim().toLowerCase();
    renderTable();
  });

  document.querySelector('#region-select').addEventListener('change', (event) => {
    state.region = event.target.value;
    renderTable();
  });

  document.querySelector('#insight-region-select').addEventListener('change', (event) => {
    state.insightRegion = event.target.value;
    renderRegionInsights();
  });

  document.querySelector('thead').addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;
    const key = button.dataset.sort;
    if (state.sortKey === key) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    else {
      state.sortKey = key;
      state.sortDirection = key === 'name' ? 'asc' : 'desc';
    }
    renderTable();
  });

  document.querySelector('#country-table-body').addEventListener('click', (event) => {
    const row = event.target.closest('[data-country-code]');
    if (row) selectCountry(row.dataset.countryCode, true);
  });

  document.querySelector('#country-table-body').addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const row = event.target.closest('[data-country-code]');
    if (!row) return;
    event.preventDefault();
    selectCountry(row.dataset.countryCode, true);
  });
}

function activateTab(tab, updateHash = true) {
  if (!['overview', 'map', 'relationship', 'regions', 'countries', 'method'].includes(tab)) return;
  state.activeTab = tab;
  document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
  document.querySelectorAll('.dashboard-tabs [data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active);
  });
  if (updateHash) history.replaceState(null, '', `#${tab}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderRegionInsights() {
  const subset = countries.filter((country) => state.insightRegion === 'All' || country.region === state.insightRegion);
  const complete = subset.filter((country) => Number.isFinite(country.undernourishedPct) && Number.isFinite(country.malnutritionDeathRate));
  const med = (key) => median(subset.filter((country) => Number.isFinite(country[key])), (country) => country[key]);
  const waste = med('foodWasteKg');
  const hunger = med('undernourishedPct');
  const deaths = med('malnutritionDeathRate');
  const ranked = complete.map((country) => ({
    ...country,
    overlap: country.foodWasteKg / Math.max(waste, 1) + country.undernourishedPct / Math.max(hunger, 1) + country.malnutritionDeathRate / Math.max(deaths, .1)
  })).sort((a, b) => b.overlap - a.overlap).slice(0, 8);

  document.querySelector('#region-intro').textContent = `${state.insightRegion === 'All' ? 'All regions' : state.insightRegion} · ${subset.length} countries and territories in the UNEP benchmark. These are country medians, not population-weighted totals.`;
  document.querySelector('#region-summary').innerHTML = `
    <article><span>Household food waste</span><strong>${Number.isFinite(waste) ? oneDecimal.format(waste) : '—'} kg</strong><p>median per person · UNEP 2022</p></article>
    <article><span>Undernourishment</span><strong>${Number.isFinite(hunger) ? `${oneDecimal.format(hunger)}%` : '—'}</strong><p>median latest FAO rolling estimate</p></article>
    <article><span>Malnutrition mortality</span><strong>${Number.isFinite(deaths) ? oneDecimal.format(deaths) : '—'} / 100k</strong><p>median annual rate · WHO ${data.sources.mortality.period}</p></article>`;
  document.querySelector('#region-coverage').textContent = `${complete.length} with all three measures`;
  document.querySelector('#region-country-list').innerHTML = ranked.map((country, index) => `<button type="button" data-region-country="${country.code}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${country.name}</strong><small>${oneDecimal.format(country.foodWasteKg)} kg waste · ${oneDecimal.format(country.undernourishedPct)}% undernourished · ${oneDecimal.format(country.malnutritionDeathRate)} deaths/100k</small></span><i>View →</i></button>`).join('') || '<p>No countries have all three measures.</p>';
  document.querySelectorAll('[data-region-country]').forEach((button) => button.addEventListener('click', () => {
    activateTab('map');
    selectCountry(button.dataset.regionCountry);
  }));
}

function updateActiveButtons(containerSelector, activeButton) {
  document.querySelectorAll(`${containerSelector} button`).forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
}

function selectCountry(code, scrollToProfile = false) {
  if (!byCode.has(code)) return;
  state.selectedCode = code;
  document.querySelector('#country-select').value = code;
  renderCountryProfile(byCode.get(code));
  renderMap();
  renderScatter();
  renderTable();
  if (scrollToProfile && window.innerWidth < 760) {
    document.querySelector('#country-profile').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderMap() {
  const metric = metrics[state.mapMetric];
  const values = countries.map((country) => country[state.mapMetric]).filter(Number.isFinite).sort((a, b) => a - b);
  const upper = quantile(values, 0.96) ?? Math.max(...values);
  const colour = scaleSequential(interpolateRgbBasis(metric.palette)).domain([0, upper]).clamp(true);
  const svg = select('#world-map');
  const width = 1100;
  const height = 535;
  const projection = geoNaturalEarth1().fitExtent([[18, 18], [width - 18, height - 20]], { type: 'Sphere' });
  const path = geoPath(projection);

  svg.attr('viewBox', `0 0 ${width} ${height}`).selectAll('*').remove();
  svg.append('path').datum({ type: 'Sphere' }).attr('class', 'map-sphere').attr('d', path);

  const paths = svg.append('g').selectAll('path').data(mapFeatures).join('path')
    .attr('d', path)
    .attr('class', (featureData) => {
      const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
      return `map-country ${country?.code === state.selectedCode ? 'selected' : ''}`;
    })
    .attr('fill', (featureData) => {
      const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
      const value = country?.[state.mapMetric];
      return Number.isFinite(value) ? colour(value) : '#d9d5cc';
    })
    .attr('tabindex', (featureData) => byNumericCode.has(String(featureData.id).padStart(3, '0')) ? 0 : null)
    .attr('role', (featureData) => byNumericCode.has(String(featureData.id).padStart(3, '0')) ? 'button' : null)
    .attr('aria-label', (featureData) => {
      const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
      if (!country) return null;
      const value = country[state.mapMetric];
      return `${country.name}: ${Number.isFinite(value) ? metric.formatter(value) : 'no data'}`;
    });

  paths
    .on('mouseenter focus', (event, featureData) => showMapTooltip(event, featureData, metric))
    .on('mousemove', (event) => positionTooltip(mapTooltip, event))
    .on('mouseleave blur', () => hideTooltip(mapTooltip))
    .on('click', (_, featureData) => {
      const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
      if (country) selectCountry(country.code);
    })
    .on('keydown', (event, featureData) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
      if (country) selectCountry(country.code);
    });

  document.querySelector('#map-title').textContent = metric.label;
  document.querySelector('#map-kicker').textContent = metric.unit;
  document.querySelector('#map-legend').innerHTML = `
    <span>Lower</span><i style="background:linear-gradient(90deg, ${metric.palette.join(',')})"></i><span>Higher</span>
  `;
}

function showMapTooltip(event, featureData, metric) {
  const country = byNumericCode.get(String(featureData.id).padStart(3, '0'));
  if (!country) return;
  const value = country[state.mapMetric];
  mapTooltip.innerHTML = `<strong>${country.name}</strong><span>${Number.isFinite(value) ? metric.formatter(value) : 'No matching data'}</span>`;
  mapTooltip.classList.add('visible');
  positionTooltip(mapTooltip, event);
}

function renderCountryProfile(country) {
  const profile = document.querySelector('#country-profile');
  const underValue = country.undernourishedPct;
  const wastePerHundred = country.foodWasteKg / 10;
  const underText = Number.isFinite(underValue) ? oneDecimal.format(underValue) : '—';
  const mortalityText = Number.isFinite(country.malnutritionDeathRate) ? oneDecimal.format(country.malnutritionDeathRate) : '—';
  const totalWaste = country.foodWasteKg + country.foodServiceWasteKg + country.retailWasteKg;
  const householdShare = country.foodWasteKg / totalWaste * 100;
  const serviceShare = country.foodServiceWasteKg / totalWaste * 100;
  const retailShare = country.retailWasteKg / totalWaste * 100;

  profile.className = 'country-profile';
  profile.innerHTML = `
    <div class="profile-heading">
      <div>
        <p class="profile-kicker">${country.region} · ${country.subregion}</p>
        <h3>${country.name}</h3>
      </div>
      <span class="country-code">${country.code}</span>
    </div>
    <div class="profile-comparison">
      <div class="comparison-block waste-block">
        <p>For every 100 residents</p>
        <div><strong>${oneDecimal.format(wastePerHundred)}</strong><span>tonnes</span></div>
        <p>of household food waste per year</p>
      </div>
      <div class="versus-mark" aria-hidden="true"><span>and</span></div>
      <div class="comparison-block hunger-block">
        <p>Among every 100 residents</p>
        <div><strong>${underText}</strong><span>people</span></div>
        <p>are estimated to be undernourished${country.undernourishmentYear ? ` (${country.undernourishmentYear})` : ''}</p>
      </div>
    </div>
    <div class="profile-lower">
      <div class="waste-mix">
        <div class="profile-label-row"><span>Consumer food-waste mix</span><strong>${oneDecimal.format(totalWaste)} kg / person</strong></div>
        <div class="stacked-bar" aria-label="Food-waste split: household ${oneDecimal.format(householdShare)}%, food service ${oneDecimal.format(serviceShare)}%, retail ${oneDecimal.format(retailShare)}%">
          <i class="household" style="width:${householdShare}%"></i><i class="service" style="width:${serviceShare}%"></i><i class="retail" style="width:${retailShare}%"></i>
        </div>
        <div class="bar-key"><span><i class="household"></i>Household</span><span><i class="service"></i>Food service</span><span><i class="retail"></i>Retail</span></div>
      </div>
      <div class="mortality-stat">
        <span>WHO mortality estimate</span>
        <div><strong>${mortalityText}</strong><em>deaths / 100k</em></div>
        <p>${Number.isFinite(country.malnutritionDeaths) ? `${number.format(country.malnutritionDeaths)} average annual estimated deaths from ` : 'from '}protein–energy malnutrition${country.mortalityPeriod ? `, ${country.mortalityPeriod}` : ''}</p>
      </div>
    </div>
    <p class="profile-caveat"><strong>Important:</strong> the values share a population basis for legibility; one is not divided by the other, and they should not be read as exchangeable quantities.</p>
  `;
}

function renderScatter() {
  const metricKey = state.hungerMetric;
  const metric = metrics[metricKey];
  const plotData = countries.filter((country) => Number.isFinite(country.foodWasteKg) && Number.isFinite(country[metricKey]));
  const svg = select('#scatter-chart');
  const width = 1040;
  const height = 545;
  const margin = { top: 28, right: 30, bottom: 70, left: 80 };
  const values = plotData.map((country) => country[metricKey]).sort((a, b) => a - b);
  const yMax = (quantile(values, 0.985) ?? Math.max(...values)) * 1.08;
  const x = scaleLinear().domain([0, Math.max(...plotData.map((country) => country.foodWasteKg)) * 1.06]).range([margin.left, width - margin.right]).nice();
  const y = scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]).nice();
  const xMedian = median(plotData, (country) => country.foodWasteKg);
  const yMedian = median(plotData, (country) => country[metricKey]);

  svg.attr('viewBox', `0 0 ${width} ${height}`).selectAll('*').remove();

  svg.append('g').attr('class', 'grid-lines')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(axisBottom(x).ticks(7).tickSize(-(height - margin.top - margin.bottom)).tickFormat(''));
  svg.append('g').attr('class', 'grid-lines')
    .attr('transform', `translate(${margin.left},0)`)
    .call(axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(''));

  svg.append('line').attr('class', 'median-line').attr('x1', x(xMedian)).attr('x2', x(xMedian)).attr('y1', margin.top).attr('y2', height - margin.bottom);
  svg.append('line').attr('class', 'median-line').attr('x1', margin.left).attr('x2', width - margin.right).attr('y1', y(yMedian)).attr('y2', y(yMedian));

  svg.append('text').attr('class', 'quadrant-label').attr('x', width - margin.right - 8).attr('y', margin.top + 18).attr('text-anchor', 'end').text('HIGHER WASTE · HIGHER HUNGER');
  svg.append('text').attr('class', 'quadrant-label').attr('x', margin.left + 8).attr('y', height - margin.bottom - 10).text('LOWER WASTE · LOWER HUNGER');

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`).call(axisBottom(x).ticks(7).tickFormat((value) => `${value}`));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`).call(axisLeft(y).ticks(6));

  svg.append('text').attr('class', 'axis-title').attr('x', (margin.left + width - margin.right) / 2).attr('y', height - 18).attr('text-anchor', 'middle').text('HOUSEHOLD FOOD WASTE · KG PER PERSON / YEAR');
  svg.append('text').attr('class', 'axis-title').attr('transform', 'rotate(-90)').attr('x', -(margin.top + height - margin.bottom) / 2).attr('y', 20).attr('text-anchor', 'middle').text(metric.unit.toUpperCase());

  const dots = svg.append('g').selectAll('circle').data(plotData).join('circle')
    .attr('class', (country) => `scatter-dot ${country.code === state.selectedCode ? 'selected' : ''}`)
    .attr('cx', (country) => x(country.foodWasteKg))
    .attr('cy', (country) => y(Math.min(country[metricKey], yMax)))
    .attr('r', (country) => country.code === state.selectedCode ? 8 : 5)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (country) => `${country.name}: ${oneDecimal.format(country.foodWasteKg)} kg food waste; ${metric.formatter(country[metricKey])}`);

  dots
    .on('mouseenter focus', (event, country) => {
      scatterTooltip.innerHTML = `<strong>${country.name}</strong><span>${oneDecimal.format(country.foodWasteKg)} kg household waste</span><span>${metric.formatter(country[metricKey])} ${metricKey === 'undernourishedPct' ? 'undernourished' : 'malnutrition deaths'}</span>`;
      scatterTooltip.classList.add('visible');
      positionTooltip(scatterTooltip, event);
    })
    .on('mousemove', (event) => positionTooltip(scatterTooltip, event))
    .on('mouseleave blur', () => hideTooltip(scatterTooltip))
    .on('click', (_, country) => selectCountry(country.code))
    .on('keydown', (event, country) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      selectCountry(country.code);
    });

  const note = metricKey === 'undernourishedPct'
    ? 'Undernourishment is an FAO modelled estimate of insufficient habitual calorie intake—not a measure of diet quality.'
    : 'The mortality view covers WHO-estimated deaths from protein–energy malnutrition, not all deaths to which hunger contributed.';
  document.querySelector('#chart-note').textContent = `${plotData.length} countries shown. ${note}`;
}

function renderTable() {
  const filtered = countries
    .filter((country) => !state.tableSearch || `${country.name} ${country.code}`.toLowerCase().includes(state.tableSearch))
    .filter((country) => state.region === 'All' || country.region === state.region)
    .sort((a, b) => compareRows(a, b, state.sortKey, state.sortDirection));

  const tbody = document.querySelector('#country-table-body');
  tbody.innerHTML = filtered.map((country) => {
    const pattern = patternFor(country);
    return `
      <tr data-country-code="${country.code}" class="${country.code === state.selectedCode ? 'selected' : ''}" tabindex="0">
        <td><strong>${country.name}</strong><span>${country.code} · ${country.region}</span></td>
        <td><strong>${oneDecimal.format(country.foodWasteKg)}</strong><span class="mini-bar"><i style="width:${Math.min(country.foodWasteKg / 1.7, 100)}%"></i></span></td>
        <td>${metricCell(country.undernourishedPct, '%', 50)}</td>
        <td>${metricCell(country.malnutritionDeathRate, '', 70)}</td>
        <td><span class="pattern-tag ${pattern.className}">${pattern.label}</span></td>
      </tr>
    `;
  }).join('');

  document.querySelector('#result-count').textContent = `${filtered.length} of ${countries.length} countries`;
  document.querySelector('#table-empty').hidden = filtered.length > 0;
}

function metricCell(value, suffix, max) {
  if (!Number.isFinite(value)) return '<span class="no-data">Not available</span>';
  return `<strong>${oneDecimal.format(value)}${suffix}</strong><span class="mini-bar hunger-mini"><i style="width:${Math.min(value / max * 100, 100)}%"></i></span>`;
}

function patternFor(country) {
  if (!Number.isFinite(country.undernourishedPct)) return { label: 'Limited data', className: 'pattern-muted' };
  const highWaste = country.foodWasteKg >= medianWaste;
  const highHunger = country.undernourishedPct >= medianUnder;
  if (highWaste && highHunger) return { label: 'Higher / higher', className: 'pattern-alert' };
  if (highWaste) return { label: 'Higher waste', className: 'pattern-waste' };
  if (highHunger) return { label: 'Higher hunger', className: 'pattern-hunger' };
  return { label: 'Lower / lower', className: 'pattern-low' };
}

function compareRows(a, b, key, direction) {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (key === 'name') return a.name.localeCompare(b.name) * multiplier;
  const av = Number.isFinite(a[key]) ? a[key] : -Infinity;
  const bv = Number.isFinite(b[key]) ? b[key] : -Infinity;
  return (av - bv) * multiplier;
}

function positionTooltip(tooltip, event) {
  if (!event?.clientX) return;
  const x = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 12);
  const y = Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 12);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip(tooltip) {
  tooltip.classList.remove('visible');
}
