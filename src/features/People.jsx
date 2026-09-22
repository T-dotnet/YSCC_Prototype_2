import { useState, useMemo } from "react";
import useQueueView from "../useQueueView";
import { Plus, ChevronRight, CircleAlert, CheckCircle2, X } from "lucide-react";
import { useStore } from "../store";
import { age, formatDate, TODAY } from "../model";
import { getQualityIssues, recordCompleteness } from "../dataQuality";
import { comparePeople, peopleInEpisodes } from "../people";
import {
  PageHeading,
  Button,
  Panel,
  SearchInput,
  Select,
  Badge,
  Empty,
  Pagination,
  Avatar,
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
  const [sortConfig, setSortConfig] = useState({ key: "priority", direction: "asc" });
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

    if (sortConfig.key === "priority") {
      result.sort(
        (a, b) =>
          (PEOPLE_LIST_PRIORITY.get(a.person.name) ?? 1) -
            (PEOPLE_LIST_PRIORITY.get(b.person.name) ?? 1) ||
          comparePeople(a, b),
      );
    } else {
      result.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === "name") {
          valA = a.person.name;
          valB = b.person.name;
        } else if (sortConfig.key === "status") {
          valA = a.status;
          valB = b.status;
        } else if (sortConfig.key === "completeness") {
          valA = recordCompleteness(a.person, TODAY).requiredPercentage;
          valB = recordCompleteness(b.person, TODAY).requiredPercentage;
        } else if (sortConfig.key === "owner") {
          valA = a.episode?.owner || a.person.owner || "Unassigned";
          valB = b.episode?.owner || b.person.owner || "Unassigned";
        } else if (sortConfig.key === "episodeStatus") {
          valA = a.episode?.status || "Intake";
          valB = b.episode?.status || "Intake";
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [state.people, status, query, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator active">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

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
        {(assessmentStatus !== "All statuses" || status !== "All episodes" || query) && (
          <div className="active-filters-row">
            <div className="active-filters-list">
              {query && (
                <button
                  className="filter-chip"
                  onClick={() => setQuery("")}
                  title="Remove search filter"
                >
                  <span>Search: {query}</span>
                  <X size={14} />
                </button>
              )}
              {assessmentStatus !== "All statuses" && (
                <button
                  className="filter-chip"
                  onClick={() => view.set("assessment", "All statuses", "All statuses", true)}
                  title="Remove assessment filter"
                >
                  <span>Assessment: {assessmentStatus}</span>
                  <X size={14} />
                </button>
              )}
              {status !== "All episodes" && (
                <button
                  className="filter-chip"
                  onClick={() => setStatus("All episodes")}
                  title="Remove episode status filter"
                >
                  <span>Episode: {status}</span>
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className="text-button-small"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        )}
        <div className="table-scroll people-table-scroll">
          <table
            className="people-table"
            aria-label="People and assessment status"
          >
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("name")}>
                  Person <SortIndicator columnKey="name" />
                </th>
                <th className="sortable" onClick={() => toggleSort("status")}>
                  Status <SortIndicator columnKey="status" />
                </th>
                <th>Next / latest assessment</th>
                <th className="sortable" onClick={() => toggleSort("completeness")}>
                  Required data <SortIndicator columnKey="completeness" />
                </th>
                <th className="sortable people-owner" onClick={() => toggleSort("owner")}>
                  Care owner <SortIndicator columnKey="owner" />
                </th>
                <th className="sortable people-episode" onClick={() => toggleSort("episodeStatus")}>
                  Episode <SortIndicator columnKey="episodeStatus" />
                </th>
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
                  <tr key={p.id} onClick={() => open(href)}>
                    <td className="people-identity">
                      <div className="person-cell">
                        <Avatar name={p.name} />
                        <span>
                          <button
                            className="name-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(href);
                            }}
                          >
                            {p.name}
                          </button>
                          <small className="people-id">
                            {p.id} ·{" "}
                          </small>
                          <small>
                            {p.dob ? `${age(p.dob)} years` : "Age unknown"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td className="people-status">
                      <Badge>{row.status}</Badge>
                    </td>
                    <td className="people-assessment">
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
                    </td>
                    <td className="people-completeness" data-label="Required data">
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
                    </td>
                    <td className="people-owner" data-label="Care owner">
                      {episode?.owner || p.owner || "Unassigned"}
                    </td>
                    <td className="people-episode" data-label="Episode">
                      <span>{episode?.status || "Intake"}</span>
                      <small>
                        {episode
                          ? `Started ${formatDate(episode.start)}`
                          : "Not started"}
                      </small>
                    </td>
                    <td className="people-open">
                      <ChevronRight size={18} aria-hidden="true" />
                    </td>
                  </tr>
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
