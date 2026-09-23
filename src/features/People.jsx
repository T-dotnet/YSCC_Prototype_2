import { useMemo } from "react";
import useQueueView from "../useQueueView";
import { Plus, ChevronRight, CircleAlert, CheckCircle2 } from "lucide-react";
import { useStore } from "../store";
import { age, formatDate, TODAY } from "../model";
import { getQualityIssues, recordCompleteness } from "../dataQuality";
import { comparePeople, peopleInEpisodes } from "../people";
import { sortQueueRows } from "../queueSort";
import { ActiveFilters, SortableHeader, useQueueSort } from "../components/QueueControls";
import { QueueCell, QueueRow } from "../components/QueueRow";
import {
  PageHeading,
  Button,
  Panel,
  SearchInput,
  Select,
  Badge,
  Empty,
  Pagination,
} from "../components/UI";

const PAGE_SIZE = 6;
const HIDDEN_FROM_PEOPLE_LIST = new Set([
  "Oliver James",
  "Zoe Patel",
  "Jordan Lee",
  "Noah Williams",
]);
const PEOPLE_LIST_PRIORITY = new Map([["Mia Robinson", 0]]);

export default function People({ navigate, openModal }) {
  const { state } = useStore();
  const view = useQueueView();
  const query = view.params.get("q") || "";
  const { sort: sortConfig, toggleSort } = useQueueSort({ key: "priority", direction: "asc" });
  const status = ["Active", "Paused", "Closed", "Intake"].includes(
    view.params.get("status"),
  )
    ? view.params.get("status")
    : "All episodes";
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
    let result = peopleInEpisodes(state.people, status)
      .filter(
        ({ person }) =>
          !HIDDEN_FROM_PEOPLE_LIST.has(person.name) &&
          `${person.name} ${person.id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      );

    return sortQueueRows(result, sortConfig, {
      priority: (row) => PEOPLE_LIST_PRIORITY.get(row.person.name) ?? 1,
      name: (row) => row.person.name,
      status: (row) => row.status,
      completeness: (row) => recordCompleteness(row.person, TODAY).requiredPercentage,
      owner: (row) => row.episode?.owner || row.person.owner || "Unassigned",
      episodeStatus: (row) => row.episode?.status || "Intake",
    }, sortConfig.key === "priority" ? comparePeople : undefined);
  }, [state.people, status, query, sortConfig]);

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
        meta="Sample date · 15 September 2026"
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
        className="people-panel"
        title="People at Northside Centre"
        action={<span className="muted">{people.length} people</span>}
      >
        <div className="work-toolbar people-toolbar">
          <div className="toolbar-search-and-count">
            <SearchInput value={query} onChange={setQuery} />
            <span className="toolbar-count" aria-live="polite">
              Showing {people.length} of {state.people.filter(p => !HIDDEN_FROM_PEOPLE_LIST.has(p.name)).length}
            </span>
          </div>
          <div className="people-toolbar-filters">
            <Select
              label="Episode status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["All episodes", "Intake", "Active", "Paused", "Closed"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </Select>
            <Select
              label="Assessment status"
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
          </div>
        </div>
        <ActiveFilters
          items={[
            ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => setQuery("") }] : []),
            ...(assessmentStatus !== "All statuses" ? [{ id: "assessment", label: `Assessment: ${assessmentStatus}`, onRemove: () => view.set("assessment", "All statuses", "All statuses", true) }] : []),
            ...(status !== "All episodes" ? [{ id: "episode", label: `Episode: ${status}`, onRemove: () => setStatus("All episodes") }] : []),
          ]}
          onClear={clearAll}
        />
        <div className="table-scroll people-table-scroll">
          <table
            className="people-table responsive-queue-table"
            aria-label="People and assessment status"
          >
            <thead>
              <tr>
                <SortableHeader label="Person" sortKey="name" sort={sortConfig} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" sort={sortConfig} onSort={toggleSort} />
                <th>Next / latest assessment</th>
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
                            {p.name}
                          </button>
                          <span className="people-identity-meta">
                            <small className="people-id">{p.id}</small>
                            <small>
                              {p.dob ? `${age(p.dob)} years` : "Age unknown"}
                            </small>
                          </span>
                        </span>
                      </div>
                    </QueueCell>
                    <QueueCell label="Status" slot="state" className="people-status">
                      <Badge>{row.status}</Badge>
                    </QueueCell>
                    <QueueCell label="Next / latest assessment" slot="summary" className="people-assessment">
                      <span>
                        {row.stage ? `Intake - ${row.stage}` : row.label}
                      </span>
                      <small
                        className={
                          row.status === "Overdue" ? "people-overdue" : ""
                        }
                      >
                        {row.detail}
                      </small>
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
                        <span
                          className={`people-completeness-bar ${completeness.requiredPercentage === 100 ? "complete-100" : ""}`}
                          role="progressbar"
                          aria-label={`${completeness.requiredPercentage}% of required data complete`}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={completeness.requiredPercentage}
                        >
                          <span
                            style={{ width: `${completeness.requiredPercentage}%` }}
                          />
                        </span>
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
                    <QueueCell label="Episode" slot="date" className="people-episode">
                      <span>{episode?.status || "Intake"}</span>
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
          </table>
        </div>
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
          <span>Highest-priority assessment shown first</span>
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
