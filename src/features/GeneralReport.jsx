import ChartCard from "../components/ReportChartCard";
import { ReportBar, ReportDeltaBar } from "../components/ReportBars";
import { PageHeading, Select } from "../components/UI";
import { useRouter, useSearchParams } from "next/navigation";

// Values transcribed from the supplied 2022/2023 image and mapped to the
// requested illustrative 2025/2026 view. These are not actual 2025/2026 data.
const YEARS = [2025, 2026];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Example month-level values only. Each series is centered on the annual
// illustrative figure; the source image does not include monthly observations.
const monthlyDropoffValues = {
  2025: [6.7, 7.0, 7.3, 7.8, 8.3, 6.9, 7.9, 8.5, 7.3, 8.2, 7.4, 9.1],
  2026: [8.4, 8.8, 9.1, 10.2, 10.5, 8.9, 9.9, 10.6, 9.2, 10.4, 9.4, 9.8],
};
// Example monthly intake counts only; the source image does not report intake volumes.
const monthlyIntakeValues = {
  2025: [22, 25, 24, 29, 31, 26, 30, 33, 28, 32, 27, 35],
  2026: [27, 30, 28, 34, 36, 31, 35, 38, 32, 37, 30, 40],
};
const remitRows = [
  { id: "1", item: "DUP measured for all suspected FEP", values: ["69.1% (n = 311)", "71.3% (n = 354)"] },
  {
    id: "3", item: "Varied referral sources", values: [
      ["Inpatient (27.5%, n = 239)", "Community mental health service (18.9%, n = 164)", "Primary health care (11.9%, n = 103)", "Family/friend (9.6%, n = 83)", "headspace (9.2%, n = 80)"],
      ["Inpatient (27.8%, n = 276)", "Community mental health service (19.5%, n = 194)", "headspace (10.9%, n = 108)", "Primary health care (8.6%, n = 85)", "Self-referred (8.4%, n = 83)"],
    ],
  },
  { id: "4", item: "Initial assessments conducted face-to-face (FEP within 3 days, UHR within 5 days)", values: [["UHR 42.2% (n = 177)", "FEP 38.9% (n = 175)"], ["UHR 46.0% (n = 234)", "FEP 42.4% (n = 205)"]] },
  { id: "11b", item: "Service drop-outs", values: ["7.7% (n = 61)", "9.6% (n = 78)"] },
  { id: "12a", item: "YP assessed/reviewed every 90 days", values: ["26.7% (n = 1259)", "35.0% (n = 1501)"] },
  { id: "12b", item: "Tenure of care (FEP at least 2 years of care, UHR at least 6 months)", values: [["UHR 81.3% (n = 434)", "FEP 31.8% (n = 172)"], ["UHR 69.6% (n = 321)", "FEP 34.6% (n = 202)"]] },
  { id: "12c", item: "YP seen face-to-face at least monthly", values: ["37.8% (n = 855)", "43.3% (n = 942)"] },
  { id: "13a", item: "YP reviewed by a doctor within 72h for FEP or 2 weeks for UHR", values: [["UHR 49.2% (n = 206)", "FEP 48.0% (n = 216)"], ["UHR 51.5% (n = 262)", "FEP 49.8% (n = 241)"]] },
  { id: "13b", item: "YP reviewed by a psychiatrist within 14 days", values: ["45.6% (n = 396)", "49.3% (n = 490)"] },
  { id: "14", item: "FEP received antipsychotic medication by first 90-day review", values: ["72.4% (n = 249)", "74.4% (n = 323)"] },
  { id: "17", item: "Physical health screening/monitoring offered/carried out every 90 days", values: ["49.8% (n = 925)", "60.8% (n = 1059)"] },
  { id: "19", item: "CBT provided for symptoms and comorbidities", values: ["53.2% (n = 572)", "45.1% (n = 471)"] },
  { id: "24a", item: "Families contacted by a clinician within 48h of entry to service and provided psychoeducation", values: ["42.7% (n = 371)", "42.6% (n = 423)"] },
  { id: "24b", item: "Families contacted once every 90 days by any service provider", values: ["28.6% (n = 532)", "32.5% (n = 566)"] },
  { id: "24c", item: "Families contacted by IFSWs within 7 days", values: ["42.9% (n = 461)", "37.3% (n = 389)"] },
  { id: "32a", item: "% of YP assessed using CAARMS", values: [["UHR 78.5% (n = 329)", "FEP 87.8% (n = 395)"], ["UHR 82.9% (n = 422)", "FEP 91.5% (n = 443)"]] },
  { id: "32b", item: "% of YP with CAARMS completed at…", incomplete: true, values: ["48.8% (n = 340)", "57.7% (n = 345)"] },
];

function parseIndicator(value) {
  const match = value.match(/^(?:(UHR|FEP) )?(\d+(?:\.\d+)?)% \(n = (\d+)\)$/);
  return match ? { group: match[1] || "", percent: Number(match[2]), count: Number(match[3]) } : null;
}

const indicatorRows = remitRows.flatMap(row => {
  if (row.id === "3") return [];
  const first = Array.isArray(row.values[0]) ? row.values[0] : [row.values[0]];
  const second = Array.isArray(row.values[1]) ? row.values[1] : [row.values[1]];
  const secondByGroup = new Map(second.map(value => {
    const parsed = parseIndicator(value);
    return parsed ? [parsed.group || "all", parsed] : null;
  }).filter(Boolean));
  return first.flatMap(value => {
    const year2025 = parseIndicator(value);
    if (!year2025) return [];
    const year2026 = secondByGroup.get(year2025.group || "all");
    if (!year2026) return [];
    return [{ id: `${row.id}-${year2025.group || "all"}`, item: row.item, code: row.id,
      group: year2025.group, incomplete: row.incomplete, year2025, year2026,
      change: Math.round((year2026.percent - year2025.percent) * 10) / 10 }];
  });
});

const groupedIndicatorRows = remitRows.filter(row => row.id !== "3").map(row => ({
  code: row.id,
  item: row.item,
  rows: indicatorRows.filter(indicator => indicator.code === row.id),
}));
const categoryByCode = {
  "13a": "YP reviews",
  "13b": "YP reviews",
  "14": "YP every 90 days",
  "17": "YP every 90 days",
  "19": "YP every 90 days",
  "24a": "Family contact",
  "24b": "Family contact",
  "24c": "Family contact",
  "32a": "CAARMS",
  "32b": "CAARMS",
};
const indicatorBlocks = [];
const categoryBlocks = new Map();
groupedIndicatorRows.forEach(group => {
  const category = categoryByCode[group.code];
  if (!category) {
    indicatorBlocks.push({ type: "indicator", group });
    return;
  }
  let block = categoryBlocks.get(category);
  if (!block) {
    block = { type: "category", label: category, groups: [] };
    categoryBlocks.set(category, block);
    indicatorBlocks.push(block);
  }
  block.groups.push(group);
});
const dupBlockIndex = indicatorBlocks.findIndex(block => block.type === "indicator" && block.group.code === "1");
if (dupBlockIndex >= 0) {
  const [dupBlock] = indicatorBlocks.splice(dupBlockIndex, 1);
  const categories = indicatorBlocks.filter(block => block.type === "category");
  const remaining = indicatorBlocks.filter(block => block.type !== "category");
  indicatorBlocks.splice(0, indicatorBlocks.length, dupBlock, ...categories, ...remaining);
}
const categoryOrder = ["Family contact", "YP reviews", "YP every 90 days", "CAARMS"];
const categoryCards = indicatorBlocks
  .filter(block => block.type === "category")
  .sort((left, right) => categoryOrder.indexOf(left.label) - categoryOrder.indexOf(right.label));
const chartExcludedIndicatorCodes = ["11b", "12b", "12c"];
const separateIndicatorCodes = ["12a", "12c", "12b"];
const separateIndicatorCards = separateIndicatorCodes.map(code => groupedIndicatorRows.find(group => group.code === code));
const chartIndicatorBlocks = indicatorBlocks.filter(block => block.type === "indicator" && !chartExcludedIndicatorCodes.includes(block.group.code));
const highlightedCodes = ["1", "11b", "4"];
const highlightedGroups = highlightedCodes.map(code => groupedIndicatorRows.find(group => group.code === code));

const changeExtent = Math.ceil(Math.max(...indicatorRows.map(row => Math.abs(row.change))) / 5) * 5;

function MonthlyDropoffChart({ year, compare }) {
  const years = compare ? YEARS : [year];
  const plot = { left: 8, right: 712, top: 10, bottom: 170 };
  const x = index => plot.left + index * (plot.right - plot.left) / (MONTHS.length - 1);
  const yPercent = value => plot.bottom - value / 15 * (plot.bottom - plot.top);
  const yIntake = value => plot.bottom - value / 45 * (plot.bottom - plot.top);
  const series = years.flatMap(value => [
    { year: value, metric: "dropoffs", values: monthlyDropoffValues[value] },
    { year: value, metric: "intake", values: monthlyIntakeValues[value] },
  ]);
  const accessibleSummary = series.map(({ year: seriesYear, metric, values }) =>
    `${seriesYear} ${metric === "dropoffs" ? "service drop-outs" : "patient intake"}: ${values.map((value, index) => `${MONTHS[index]} ${value.toFixed(metric === "dropoffs" ? 1 : 0)}${metric === "dropoffs" ? "%" : " people"}`).join(", ")}`
  ).join(". ");

  return <ChartCard className="general-report-chart-card general-report-monthly-dropoff-card" showReportingIndicator={false}>
    <div className={`general-report-dropoff-legend${compare ? " compare" : " single"}`} aria-label="Chart series">
      {series.map(({ year: seriesYear, metric }) => <span className={`general-report-dropoff-legend-item year-${seriesYear} metric-${metric}`} key={`${seriesYear}-${metric}`}>
        <i aria-hidden="true" />{compare ? `${seriesYear} · ${metric === "dropoffs" ? "Drop-outs" : "Patient intake"}` : metric === "dropoffs" ? "Service drop-outs (%)" : "Patient intake (people)"}
      </span>)}
    </div>
    <div className="general-report-dropoff-plot" role="img" aria-label={`Illustrative monthly service drop-outs and patient intake. Percentages on the left scale; intake counts on the right. ${accessibleSummary}`}>
      <div className="general-report-dropoff-y-labels" aria-hidden="true"><span>15%</span><span>10%</span><span>5%</span><span>0%</span></div>
      <svg viewBox="0 0 720 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {[0, 5, 10, 15].map(tick => <line key={tick} className="general-report-dropoff-gridline"
          x1={plot.left} x2={plot.right} y1={yPercent(tick)} y2={yPercent(tick)} />)}
        {series.map(({ year: seriesYear, metric, values }) => {
          const y = metric === "dropoffs" ? yPercent : yIntake;
          const isPrimaryDropoffSeries = metric === "dropoffs" && seriesYear === (compare ? 2026 : year);
          return <g key={`${seriesYear}-${metric}`} className={`general-report-dropoff-series year-${seriesYear} metric-${metric}${compare ? "" : " single-series"}`}>
            {isPrimaryDropoffSeries && <polygon className="general-report-dropoff-area"
              points={`${x(0)},${plot.bottom} ${values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} ${x(values.length - 1)},${plot.bottom}`} />}
            <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} />
            {values.map((value, index) => <circle key={MONTHS[index]} cx={x(index)} cy={y(value)} r={metric === "dropoffs" ? "4.5" : "3.5"}>
              <title>{`${MONTHS[index]} ${seriesYear} ${metric === "dropoffs" ? "service drop-outs" : "patient intake"}: ${value}${metric === "dropoffs" ? "%" : " people"} (illustrative)`}</title>
            </circle>)}
          </g>;
        })}
      </svg>
      <div className="general-report-dropoff-count-labels" aria-hidden="true"><span>45</span><span>30</span><span>15</span><span>0</span></div>
    </div>
    <div className="general-report-dropoff-months" aria-hidden="true">
      {MONTHS.map(month => <span key={month}>{month}</span>)}
    </div>
    <p className="report-featured-footer">Monthly drop-out rates and patient-intake counts are illustrative examples, not reported observations. The supplied annual drop-out reference figures are 7.7% for 2025 and 9.6% for 2026.</p>
  </ChartCard>;
}

function HighlightCards({ year, compare }) {
  return <div className="general-report-highlights" aria-label="Selected REMIT indicators">
    {highlightedGroups.map(group => compare && group.code === "4"
      ? <StandaloneIndicatorCard key={group.code} group={group} year={year} compare={compare} />
      : <ChartCard key={group.code} title={`${group.code}: ${group.item}`} className="general-report-highlight-card"
        description={compare ? "Reported percentage by illustrative year" : `Reported percentage in ${year}`}
        showReportingIndicator={false}>
        <div className={`general-report-highlight-cohorts${group.rows.length > 1 ? " multiple" : ""}${compare && group.rows.length > 1 ? " compare" : ""}`}>
          {group.rows.map(row => {
            const current = row[`year${compare ? 2026 : year}`];
            return <div className="general-report-highlight-cohort" key={row.id}>
              {row.group && <span className="general-report-highlight-group-label">{row.group}</span>}
              <div className="general-report-highlight-value"><strong>{current.percent.toFixed(1)}%</strong><span>n = {current.count}</span></div>
              {compare ? <div className="general-report-highlight-comparison">
                {YEARS.map(value => <div key={value} className="general-report-highlight-series">
                  <span>{value}</span><ReportBar value={row[`year${value}`].percent} tone={`year-${value}`} />
                  <strong>{row[`year${value}`].percent.toFixed(1)}%</strong>
                </div>)}
              </div> : <ReportBar value={current.percent} tone={`year-${year}`} />}
              {compare && <p className="report-featured-footer">{`${row.change > 0 ? "+" : ""}${row.change.toFixed(1)} percentage points from 2025 to 2026`}</p>}
            </div>;
          })}
        </div>
      </ChartCard>)}
  </div>;
}

function StandaloneIndicatorCard({ group, year, compare }) {
  return <ChartCard title={`${group.code}: ${group.item}`}
    className={`general-report-category-card general-report-highlight-card general-report-standalone-card${compare ? " compare" : ""}`}
    description={compare ? "Reported percentages by year" : `Reported percentages in ${year}`}
    showReportingIndicator={false}>
    <div className={`general-report-standalone-values${group.rows.length > 1 ? " multiple" : ""}`}>
      {group.rows.map(row => <div className="general-report-standalone-value" key={row.id}>
        {row.group && <span className="general-report-standalone-group-label">{row.group}</span>}
        <div className="general-report-highlight-value"><strong>{row[`year${compare ? 2026 : year}`].percent.toFixed(1)}%</strong><span>n = {row[`year${compare ? 2026 : year}`].count}</span></div>
        {compare ? <div className="general-report-standalone-comparison">
          {YEARS.map(value => <div className="general-report-standalone-year" key={value}>
            <span>{value}</span><ReportBar value={row[`year${value}`].percent} tone={`year-${value}`} />
            <strong>{row[`year${value}`].percent.toFixed(1)}%</strong><small>n = {row[`year${value}`].count}</small>
          </div>)}
        </div> : <ReportBar value={row[`year${year}`].percent} tone={`year-${year}`} />}
      </div>)}
    </div>
  </ChartCard>;
}

function StandaloneIndicatorCards({ year, compare }) {
  return <div className="general-report-standalone-highlights" aria-label="Additional REMIT indicators">
    {separateIndicatorCards.map(group => <StandaloneIndicatorCard key={group.code} group={group} year={year} compare={compare} />)}
  </div>;
}

function GroupedCategoryCards({ year, compare }) {
  const years = compare ? YEARS : [year];
  return <div className="general-report-category-cards" aria-label="Grouped REMIT indicators">
    {categoryCards.map(category => <ChartCard key={category.label} title={category.label}
      className={`general-report-category-card${compare ? " compare" : ""}`}
      description={compare ? "Reported percentages by year" : `Reported percentages in ${year}`}
      showReportingIndicator={false}>
      <div className="general-report-category-metrics">
        {category.groups.map(group => <div className="general-report-category-metric" key={group.code}>
          <strong className="general-report-category-metric-label">{group.code}: {group.item}</strong>
          {group.rows.map(row => <div className={`general-report-category-series${row.group ? " has-group" : ""}`} key={row.id}>
            {row.group && <span className="general-report-category-series-label">{row.group}</span>}
            {years.map(value => <div className="general-report-category-year" key={value}>
              {compare && <span className="general-report-category-year-label">{value}</span>}
              <ReportBar value={row[`year${value}`].percent} tone={`year-${value}`} />
              <strong>{row[`year${value}`].percent.toFixed(1)}%</strong>
              <small>n = {row[`year${value}`].count}</small>
            </div>)}
          </div>)}
        </div>)}
      </div>
    </ChartCard>)}
  </div>;
}

function IndicatorChart() {
  const renderGroup = group => <div className="general-report-change-row" key={group.code}>
    <div className="general-report-change-label"><strong>{group.code}: {group.item}</strong></div>
    <div className="general-report-series-list">
      {group.rows.map(row => <div className="general-report-series-line" key={row.id}>
        <div className="general-report-series-bar"><span>{row.group}</span><ReportDeltaBar value={row.change} extent={changeExtent} /></div>
        <div className="general-report-change-values"><strong>{row.change > 0 ? "+" : ""}{row.change.toFixed(1)} pp</strong><span>{row.year2025.percent.toFixed(1)}% → {row.year2026.percent.toFixed(1)}%</span><small>n = {row.year2025.count} → {row.year2026.count}</small></div>
      </div>)}
    </div>
  </div>;
  return <ChartCard title="How reported percentages changed" className="general-report-chart-card"
    description="2026 minus 2025, in percentage points. Bars to the right increased; bars to the left decreased. Direction alone does not indicate better or worse care."
    showReportingIndicator={false}>
    <div className="general-report-change-key" aria-hidden="true"><span>Decrease</span><span>0</span><span>Increase</span></div>
    <div className="general-report-change-list">
      {chartIndicatorBlocks.map(block => renderGroup(block.group))}
    </div>
    <p className="report-featured-footer">The chart compares percentages, not counts. The <i>n</i> values are the counts reported in the reference image. Item 32b has an incomplete label in that image.</p>
  </ChartCard>;
}

const referralSourceColors = {
  "Inpatient": "var(--action-coral)",
  "Community mental health service": "var(--data-amber)",
  "Primary health care": "var(--data-teal)",
  "Family/friend": "var(--data-violet)",
  "headspace": "var(--data-blue)",
  "Self-referred": "var(--orygen-lime)",
  other: "var(--surface-edge)",
};

function ReferralDonut({ year, values }) {
  const sources = values.map(value => {
    const match = value.match(/^(.*) \((\d+(?:\.\d+)?)%, n = (\d+)\)$/);
    return match ? { source: match[1], percentage: Number(match[2]), count: Number(match[3]) } : null;
  }).filter(Boolean);
  const reportedTotal = sources.reduce((total, source) => total + source.percentage, 0);
  const otherPercentage = Math.max(0, Math.round((100 - reportedTotal) * 10) / 10);
  const segments = [...sources, { source: "Other sources (approx.)", percentage: otherPercentage }];
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return <div className="general-report-referral-year">
    <h3>{year}</h3>
    <div className="general-report-referral-content">
      <div className="general-report-referral-donut" role="img" aria-label={`${year} top five referral sources account for ${reportedTotal.toFixed(1)}% of referrals; other sources account for an estimated ${otherPercentage.toFixed(1)}%.`}>
        <svg viewBox="0 0 140 140" aria-hidden="true" focusable="false">
          <circle cx="70" cy="70" r={radius} className="general-report-referral-donut-track" />
          {segments.map(segment => {
            const length = segment.percentage / 100 * circumference;
            const segmentOffset = offset;
            offset += length;
            return <circle key={segment.source} cx="70" cy="70" r={radius}
              className="general-report-referral-donut-segment"
              style={{ "--referral-slice-color": referralSourceColors[segment.source] || referralSourceColors.other }}
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
              strokeDashoffset={-segmentOffset} />;
          })}
        </svg>
        <span><strong>{reportedTotal.toFixed(1)}%</strong><small>Top five</small></span>
      </div>
      <ol className="general-report-referral-legend">
        {segments.map(segment => <li key={segment.source}>
          <span className="general-report-referral-swatch" aria-hidden="true"
            style={{ "--referral-slice-color": referralSourceColors[segment.source] || referralSourceColors.other }} />
          <strong>{segment.source}</strong>
          <span>{segment.percentage.toFixed(1)}%{segment.count ? <small> (n = {segment.count})</small> : null}</span>
        </li>)}
      </ol>
    </div>
  </div>;
}

function ReferralChart({ years }) {
  const referralRow = remitRows.find(row => row.id === "3");
  return <ChartCard title="Top referral sources" className="general-report-chart-card"
    description="Share of referrals by source. Other sources is the remainder to 100%, estimated from the rounded top-five percentages."
    showReportingIndicator={false}>
    <div className={`general-report-referral-grid${years.length === 1 ? " single-year" : ""}`}>
      {years.map(year => <ReferralDonut key={year} year={year} values={referralRow.values[year - YEARS[0]]} />)}
    </div>
    <p className="report-featured-footer">Counts are shown for the reported top five sources. The other-sources slice is approximate because it is calculated from rounded percentages.</p>
  </ChartCard>;
}

export default function GeneralReport() {
  const router = useRouter();
  const params = useSearchParams();
  const year = params.get("year") === "2025" ? 2025 : 2026;
  const compare = params.get("view") === "compare";
  const setView = (nextMode, nextYear = year) => {
    const next = new URLSearchParams(window.location.search);
    if (nextMode === "compare") next.set("view", "compare");
    else next.delete("view");
    if (nextYear === 2025) next.set("year", "2025");
    else next.delete("year");
    router.push(`/general-report${next.size ? `?${next}` : ""}`);
  };
  return (
    <>
      <PageHeading title="General report" subtitle="REMIT illustrative results" />
      <div className="report-dashboard general-report-dashboard">
        <div className="general-report-period-heading">
          <div className="general-report-period-title">
            <h3>{compare ? "Compare years" : `${year} results`}</h3>
            <p>REMIT indicators and referral sources from the illustrative dataset.</p>
          </div>
          <div className="general-report-controls">
            <div className="general-report-year-selector"><span>Year</span>
              <Select label="Year" id="general-report-year" value={year} onChange={event => setView(compare ? "compare" : "year", Number(event.target.value))}>
                <option value="2025">2025</option><option value="2026">2026</option>
              </Select>
            </div>
            <div className="general-report-year-selector"><span>Compare</span>
              <Select label="Compare year" id="general-report-compare-year" value={compare ? (year === 2025 ? "2026" : "2025") : ""} onChange={event => setView(event.target.value ? "compare" : "year")}>
                <option value="">None</option><option value={year === 2025 ? "2026" : "2025"}>{year === 2025 ? "2026" : "2025"}</option>
              </Select>
            </div>
          </div>
        </div>
        <nav className="report-overview-links" aria-label="General report sections">
          <a href="#general-report-trends">Monthly trends</a>
          <a href="#general-report-key-indicators">Key indicators</a>
          <a href="#general-report-grouped-indicators">Grouped indicators</a>
          <a href="#general-report-referrals">Referral sources</a>
        </nav>
        <section className="report-dashboard-section general-report-charts-section" id="general-report-trends" aria-labelledby="general-report-trends-heading">
          <div className="report-section-heading"><h3 id="general-report-trends-heading">Monthly trends</h3><p>Illustrative monthly service drop-outs and patient intake.</p></div>
          <MonthlyDropoffChart year={year} compare={compare} />
        </section>
        <section className="report-dashboard-section general-report-charts-section" id="general-report-key-indicators" aria-labelledby="general-report-key-indicators-heading">
          <div className="report-section-heading"><h3 id="general-report-key-indicators-heading">Key indicators</h3><p>Selected REMIT measures for {compare ? "2025 and 2026" : year}, shown with the reported counts.</p></div>
          <HighlightCards year={year} compare={compare} />
          <StandaloneIndicatorCards year={year} compare={compare} />
        </section>
        <section className="report-dashboard-section general-report-charts-section" id="general-report-grouped-indicators" aria-labelledby="general-report-grouped-indicators-heading">
          <div className="report-section-heading"><h3 id="general-report-grouped-indicators-heading">Grouped indicators</h3><p>Related measures are grouped to make their reported results easier to compare.</p></div>
          <GroupedCategoryCards year={year} compare={compare} />
          {compare && <IndicatorChart />}
        </section>
        <section className="report-dashboard-section general-report-charts-section" id="general-report-referrals" aria-labelledby="general-report-referrals-heading">
          <div className="report-section-heading"><h3 id="general-report-referrals-heading">Referral sources</h3><p>Where referrals came from in the selected year or across both years.</p></div>
          <ReferralChart years={compare ? YEARS : [year]} />
        </section>
      </div>
    </>
  );
}
