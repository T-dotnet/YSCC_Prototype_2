import { useEffect, useMemo } from "react";
import useQueueView from "../useQueueView";
import { Plus, ChevronRight, CircleAlert, CheckCircle2 } from "lucide-react";
import { useStore } from "../store";
import { assessmentSchedulingEnabled, assessmentBundleGroupingEnabled } from "../assessmentFeatures";
import { mvpAssessmentMode } from "../mvpAssessmentPathway";
import { formatDate, TODAY } from "../model";
import { getQualityIssues, recordCompleteness } from "../dataQuality";
import { comparePeople, episodeDisplayStatus, peopleForList, peopleBundleSummary } from "../people";
import { ASSESSMENT_BUNDLE_STATUS_TONES } from '../assessmentBundleStatus.js';
import { sortQueueRows } from "../queueSort";
import { patientIdentifier, patientSecondaryDetail } from "../patientIdentity";
import { ActiveFilters, SortableHeader, useQueueSort } from "../components/QueueControls";
import StandardTable from "../components/StandardTable";
import { QueueCell, QueueRow } from "../components/QueueRow";
import ListFilterBar from "../components/ListFilterBar";
import {
  PageHeading,
  Button,
  Panel,
  Select,
  Badge,
  ProgressBar,
  Empty,
  Pagination,
} from "../components/UI";

const PAGE_SIZE = 6;

export default function People({ navigate, openModal }) {
  const { state } = useStore();
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const mvpMode = mvpAssessmentMode(state.settings);
  const listPeople = useMemo(() => mvpMode
    ? state.people.filter(person => person.episodes?.length || person.archivedAt)
    : state.people, [state.people, mvpMode]);
  const groupedBundles = assessmentBundleGroupingEnabled(state.settings);
  const summaryLabel = 'Assessment Pack';
  const view = useQueueView();
  const query = view.params.get("q") || "";
  const { sort: sortConfig, toggleSort } = useQueueSort({ key: "priority", direction: "asc" });
  const episodeStages = [...(mvpMode ? [] : ["Intake"]), "Profiling", "Assessment", "Ongoing review", "Not proceed", "Paused", "Closed", "Completed", "Discharged"];
  const currentRows = peopleForList(listPeople, 'All episodes', '', state.settings);
  const availableStages = [...new Set(currentRows.map((row) => episodeDisplayStatus(row.episode, state.settings)))];
  const episodeFilters = ["All episodes", ...episodeStages.filter((stage) => availableStages.includes(stage)),
    ...availableStages.filter((stage) => !episodeStages.includes(stage)),
    ...(listPeople.some((person) => person.archivedAt) ? ["Archived"] : [])];
  const requestedStatus = view.params.get("status");
  const status = episodeFilters.includes(requestedStatus) ? requestedStatus : "All episodes";
  useEffect(() => {
    if (requestedStatus && requestedStatus !== status)
      view.set("status", "All episodes", "All episodes", true);
  }, [requestedStatus, status]);
  const setQuery = (value) => view.set("q", value, "", true);
  const setStatus = (value) => view.set("status", value, "All episodes", true);
  const assessmentStatus = view.params.get("assessment") || "All statuses";
  const open = (href) => {
    view.remember();
    navigate(href);
  };

  const clearAll = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete("q");
    next.delete("assessment");
    next.delete("status");
    next.delete("page");
    const nextUrl = window.location.pathname + (next.size ? `?${next}` : "");
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  const qualityIssues = useMemo(() => getQualityIssues(state, TODAY), [state]);

  const rows = useMemo(() => {
    let result = peopleForList(listPeople, status, query, state.settings);
    if (!scheduleAssessments) result = result.map((row) => {
      if (!row.collection) return row;
      const assessmentState = row.collection.response === "Submitted" ? "Completed"
        : row.collection.response === "Draft" ? "Draft" : "Not started";
      return {
        ...row,
        status: assessmentState,
        detail: assessmentState === "Completed" ? "Measure completed"
          : assessmentState === "Draft" ? "Draft saved" : "Measure created",
        due: "",
      };
    });

    if (groupedBundles) result = result.map(row => peopleBundleSummary(row,state.settings));

    return sortQueueRows(result, sortConfig, {
      priority: () => 0,
      name: (row) => row.person.name,
      status: (row) => row.status,
      completeness: (row) => recordCompleteness(row.person, TODAY).requiredPercentage,
      owner: (row) => row.episode?.owner || row.person.owner || "Unassigned",
      episodeStatus: (row) => episodeDisplayStatus(row.episode, state.settings),
    }, sortConfig.key === "priority" ? comparePeople : undefined);
  }, [listPeople, state.settings, groupedBundles, scheduleAssessments, status, query, sortConfig]);

  const statusOptions = [...new Set(rows.map((row) => row.status))];
  if (
    assessmentStatus !== "All statuses" &&
    !statusOptions.includes(assessmentStatus)
  )
    statusOptions.push(assessmentStatus);
  const people = rows.filter(
    (row) =>
      assessmentStatus === "All statuses" || row.status === assessmentStatus,
  );
  const episodeFilterItems = episodeFilters.map((value) => ({
    value,
    label: value === "All episodes" ? "All" : value,
    verbatim: true,
    count: value === "All episodes" ? currentRows.length
      : value === "Archived" ? listPeople.filter((person) => person.archivedAt).length
        : currentRows.filter((row) => episodeDisplayStatus(row.episode, state.settings) === value).length,
  }));
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const requestedPage = Number(view.params.get("page"));
  const page = Math.min(
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageCount,
  );
  const pageStart = (page - 1) * PAGE_SIZE;
  const visiblePeople = people.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = people.length ? pageStart + 1 : 0;
  const showingTo = Math.min(pageStart + PAGE_SIZE, people.length);
  const activeFilterItems = [
    ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => setQuery("") }] : []),
    ...(assessmentStatus !== "All statuses" ? [{ id: "assessment", label: `${groupedBundles ? "Assessment" : "Measure"}: ${assessmentStatus}`, onRemove: () => view.set("assessment", "All statuses", "All statuses", true) }] : []),
    ...(status !== "All episodes" ? [{ id: "episode", label: `Episode: ${status}`, onRemove: () => setStatus("All episodes") }] : []),
  ];
  const personHref = ({ person, episode, collection }) => {
    const params = new URLSearchParams({ returnTo: view.href });
    if (episode) params.set("episode", episode.id);
    else params.set("tab", "intake");
    if (collection) params.set("collection", collection.id);
    return `/people/${person.id}?${params}`;
  };
  return (
    <>
      <PageHeading
        title="People"
        subtitle="See who needs attention and where they are in their care."
        meta={`Today · ${formatDate(TODAY)} · Fictional sample data`}
      >
        <Button
          variant="primary"
          onClick={() => openModal({ type: "new-person" })}
        >
          <Plus size={18} />
          New person
        </Button>
        <Button
          variant="secondary"
          onClick={() => openModal({ type: "import-people" })}
        >
          Import
        </Button>
      </PageHeading>
      <Panel
        className="people-panel queue-list-panel"
        title="People at Northside Centre"
        action={<span className="muted">{people.length} people</span>}
      >
        <ListFilterBar
          id="people-filters"
          label="Care episode status"
          items={episodeFilterItems}
          value={status}
          onChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          placeholder="Search people"
          shown={people.length}
          total={peopleForList(listPeople, status, '', state.settings).length}
          noun="people"
          activeAdvancedCount={Number(assessmentStatus !== "All statuses")}
          resultAction={<ActiveFilters items={activeFilterItems} onClear={clearAll} inline />}
          advanced={
            <Select
              label={groupedBundles ? "Assessment status" : "Measure status"}
              value={assessmentStatus}
              onChange={(e) =>
                view.set("assessment", e.target.value, "All statuses", true)
              }
            >
              <option value="All statuses">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s} ({rows.filter((row) => row.status === s).length})
                </option>
              ))}
            </Select>
          }
        />
        <StandardTable className="people-table" scrollClassName="people-table-scroll" label="People and assessment status">
            <thead>
              <tr>
                <SortableHeader label="Person" sortKey="name" sort={sortConfig} onSort={toggleSort} />
                <th>{summaryLabel}</th>
                <SortableHeader label="Status" sortKey="status" sort={sortConfig} onSort={toggleSort} />
                <SortableHeader label="Required data" sortKey="completeness" sort={sortConfig} onSort={toggleSort} />
                <SortableHeader label="Care owner" sortKey="owner" sort={sortConfig} onSort={toggleSort} className="people-owner" />
                <SortableHeader label="Episode" sortKey="episodeStatus" sort={sortConfig} onSort={toggleSort} className="people-episode" />
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((row) => {
                const { person: p, episode } = row;
                const href = personHref(row);
                const completeness = recordCompleteness(p, TODAY);
                const validationIssue = qualityIssues.find(
                  (issue) =>
                    issue.personId === p.id &&
                    !["Resolved", "Closed"].includes(issue.status),
                );
                return (
                  <QueueRow key={p.id} onClick={() => open(href)}>
                    <QueueCell label="Person" slot="subject" className="people-identity">
                      <div className="person-cell">
                        <span className="people-identity-copy">
                          <button
                            className="name-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(href);
                            }}
                          >
                            {patientIdentifier(p)}
                          </button>
                          <span className="people-identity-meta">
                            {patientSecondaryDetail(p) && <small>{patientSecondaryDetail(p)}</small>}
                          </span>
                        </span>
                      </div>
                    </QueueCell>
                    <QueueCell label={summaryLabel} slot="summary" className="people-assessment">
                      <div className="people-assessment-heading">
                        <span>{summaryLabel}</span>
                        <Badge tone={row.bundleStatus ? ASSESSMENT_BUNDLE_STATUS_TONES[row.bundleStatus] : undefined}>{row.status}</Badge>
                      </div>
                      <span>
                        {!groupedBundles && row.stage ? `Intake - ${row.stage}` : row.label}
                      </span>
                      {(!groupedBundles || row.due) && (
                        <small className={row.status === "Overdue" ? "people-overdue" : ""}>
                          {groupedBundles ? `Due ${formatDate(row.due)}` : row.detail}
                        </small>
                      )}
                    </QueueCell>
                    <QueueCell label="Status" slot="state" className="people-status">
                      <Badge tone={row.bundleStatus ? ASSESSMENT_BUNDLE_STATUS_TONES[row.bundleStatus] : undefined}>{row.status}</Badge>
                    </QueueCell>
                    <QueueCell label="Required data" slot="metric" className="people-completeness">
                      <div className={`people-completeness-summary ${completeness.requiredPercentage === 100 ? "complete-100" : ""}`}>
                        {completeness.requiredPercentage === 100 ? (
                          <span className="people-completeness-100-badge">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            <strong>100%</strong>
                          </span>
                        ) : (
                          <strong>{completeness.requiredPercentage}%</strong>
                        )}
                        <ProgressBar
                          className="people-completeness-bar"
                          value={completeness.requiredPercentage}
                          label={`${completeness.requiredPercentage}% of required data complete`}
                        />
                        {validationIssue && (
                          <span className="people-validation-indicator">
                            <button
                              type="button"
                              className="people-validation-trigger"
                              aria-label={`Validation issue: ${validationIssue.description}`}
                              aria-describedby={`validation-${p.id}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <CircleAlert size={17} aria-hidden="true" />
                            </button>
                            <span
                              id={`validation-${p.id}`}
                              className="people-validation-tooltip"
                              role="tooltip"
                            >
                              <strong>{validationIssue.title}</strong>
                              <span>{validationIssue.description}</span>
                              <a
                                href="/quality"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  open("/quality");
                                }}
                              >
                                Manage data quality issue
                              </a>
                            </span>
                          </span>
                        )}
                      </div>
                    </QueueCell>
                    <QueueCell label="Care owner" slot="owner" className="people-owner">
                      {episode?.owner || p.owner || "Unassigned"}
                    </QueueCell>
                    <QueueCell label="Episode" slot="date" className="people-episode" verbatim>
                      <span>{episodeDisplayStatus(episode, state.settings)}</span>
                      <small>
                        {episode
                          ? `Started ${formatDate(episode.start)}`
                          : "Not started"}
                      </small>
                    </QueueCell>
                    <QueueCell label="Open" slot="action" className="people-open">
                      <ChevronRight size={18} aria-hidden="true" />
                    </QueueCell>
                  </QueueRow>
                );
              })}
            </tbody>
        </StandardTable>
        {!people.length && (
          <Empty
            visual="botanical"
            title="No matching people"
            action={
              <Button variant="secondary" onClick={clearAll}>
                Reset all filters
              </Button>
            }
          />
        )}
        <div className="table-footer" role="status">
          <span>
            Showing {showingFrom}–{showingTo} of {people.length} people
          </span>
          <span>{groupedBundles ? 'Assessment Pack shown first' : 'Highest-priority measure shown first'}</span>
          <Pagination
            label="People"
            page={page}
            pageCount={pageCount}
            onPageChange={(nextPage) => view.set("page", String(nextPage), "1")}
          />
        </div>
      </Panel>
    </>
  );
}
