import useQueueView from "../useQueueView";
import { useMemo, useState } from "react";
import { INSTRUMENTS } from "../instruments";
import {
  X,
  Plus,
  ArrowRight,
  ShieldAlert,
  Clock,
  CalendarX,
  FileCheck,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  ClipboardList,
  FileCheck2,
  CalendarClock,
  Users,
  SlidersHorizontal,
  MessageSquare,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { useStore } from "../store";
import { currentStaff, formatDate, TODAY } from "../model";
import {
  QUALITY_SEVERITIES,
  QUALITY_STATUSES,
  getQualityIssues,
} from "../dataQuality";
import {
  PageHeading,
  Panel,
  Button,
  Badge,
  Notice,
  Empty,
  Select,
  SearchInput,
} from "../components/UI";

const EMPTY_FILTERS = {
  organisation: "All organisations",
  clinician: "All clinicians",
  status: "All statuses",
  severity: "All severities",
  submissionPeriod: "All submission periods",
};

export function Quality({ openModal, navigate }) {
  const { state } = useStore();
  const view = useQueueView();
  const query = view.params.get("q") || "";
  const filters = {
    organisation: view.params.get("org") || "All organisations",
    clinician: view.params.get("clinician") || "All clinicians",
    status: view.params.get("status") || "All statuses",
    severity: view.params.get("severity") || "All severities",
    submissionPeriod: view.params.get("period") || "All submission periods",
  };

  const setQuery = (v) => view.set("q", v, "", true);
  const setFilter = (key, value) => {
    const paramMap = {
      organisation: "org",
      clinician: "clinician",
      status: "status",
      severity: "severity",
      submissionPeriod: "period",
    };
    view.set(paramMap[key], value, EMPTY_FILTERS[key], true);
  };

  const clearAll = () => {
    view.set("q", "", "", false);
    view.set("org", "All organisations", "All organisations", false);
    view.set("clinician", "All clinicians", "All clinicians", false);
    view.set("status", "All statuses", "All statuses", false);
    view.set("severity", "All severities", "All severities", false);
    view.set("period", "All submission periods", "All submission periods", true);
  };

  const [sortConfig, setSortConfig] = useState({
    key: "dueDate",
    direction: "asc",
  });
  const issues = useMemo(() => getQualityIssues(state, TODAY), [state]);
  const unresolved = issues.filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status),
  );
  
  const severityValue = (s) => {
    if (s === "Critical") return 3;
    if (s === "High") return 2;
    if (s === "Medium") return 1;
    return 0;
  };

  const visibleIssues = useMemo(() => {
    let result = issues.filter((issue) => {
      const q = query.toLowerCase().trim();
      const person = state.people.find((p) => p.id === issue.personId);
      const personName = person?.name || "";
      const matchesQuery =
        !q ||
        personName.toLowerCase().includes(q) ||
        (issue.type && issue.type.toLowerCase().includes(q)) ||
        (issue.description && issue.description.toLowerCase().includes(q)) ||
        (issue.owner && issue.owner.toLowerCase().includes(q)) ||
        (issue.organisation && issue.organisation.toLowerCase().includes(q));

      return (
        matchesQuery &&
        (filters.organisation === "All organisations" ||
          issue.organisation === filters.organisation) &&
        (filters.clinician === "All clinicians" ||
          issue.owner === filters.clinician) &&
        (filters.status === "All statuses" || issue.status === filters.status) &&
        (filters.severity === "All severities" ||
          issue.severity === filters.severity) &&
        (filters.submissionPeriod === "All submission periods" ||
          issue.submissionPeriod === filters.submissionPeriod)
      );
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === "severity") {
          valA = severityValue(valA);
          valB = severityValue(valB);
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [issues, query, state.people, filters, sortConfig]);

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
  const filterOptions = {
    organisations: [...new Set(issues.map((issue) => issue.organisation))],
    clinicians: [...new Set(issues.map((issue) => issue.owner))],
    periods: [...new Set(issues.map((issue) => issue.submissionPeriod))],
  };
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== EMPTY_FILTERS[key],
  );
  return (
    <>
      <PageHeading
        title="Data quality"
        subtitle="Continuously check completeness, resolve the source, and retain the evidence."
        meta="Sample PMHC-MDS rule set · Northside Centre · 15 September 2026"
      />
      <Panel
        title="Validation issue queue"
        action={<Badge>{unresolved.length} unresolved</Badge>}
        className="quality-queue"
      >
        <div className="work-toolbar quality-toolbar">
          <div className="toolbar-search-and-count">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search issues..."
            />
            <span className="toolbar-count" aria-live="polite">
              Showing {visibleIssues.length} of {issues.length}
            </span>
          </div>
          <Select
            label="Organisation filter"
            value={filters.organisation}
            onChange={(event) =>
              setFilter("organisation", event.target.value)
            }
          >
            <option>All organisations</option>
            {filterOptions.organisations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select
            label="Clinician filter"
            value={filters.clinician}
            onChange={(event) => setFilter("clinician", event.target.value)}
          >
            <option>All clinicians</option>
            {filterOptions.clinicians.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select
            label="Status filter"
            value={filters.status}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option>All statuses</option>
            {QUALITY_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select
            label="Severity filter"
            value={filters.severity}
            onChange={(event) => setFilter("severity", event.target.value)}
          >
            <option>All severities</option>
            {QUALITY_SEVERITIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select
            label="Submission period filter"
            value={filters.submissionPeriod}
            onChange={(event) =>
              setFilter("submissionPeriod", event.target.value)
            }
          >
            <option>All submission periods</option>
            {filterOptions.periods.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </div>
        {(hasFilters || query) && (
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
              {Object.entries(filters).map(([key, value]) => {
                if (value === EMPTY_FILTERS[key]) return null;
                return (
                  <button
                    key={key}
                    className="filter-chip"
                    onClick={() => setFilter(key, EMPTY_FILTERS[key])}
                    title={`Remove ${key} filter`}
                  >
                    <span>
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}: {value}
                    </span>
                    <X size={14} />
                  </button>
                );
              })}
            </div>
            <button
              className="text-button-small"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        )}
        {visibleIssues.length ? (
          <div className="table-scroll quality-table-scroll">
            <table
              className="quality-table"
              aria-label="Validation issue queue"
            >
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("severity")}>
                    Severity <SortIndicator columnKey="severity" />
                  </th>
                  <th>Client</th>
                  <th className="sortable" onClick={() => toggleSort("type")}>
                    Issue <SortIndicator columnKey="type" />
                  </th>
                  <th className="sortable" onClick={() => toggleSort("owner")}>
                    Owner <SortIndicator columnKey="owner" />
                  </th>
                  <th className="sortable" onClick={() => toggleSort("status")}>
                    Status <SortIndicator columnKey="status" />
                  </th>
                  <th className="sortable" onClick={() => toggleSort("dueDate")}>
                    Due <SortIndicator columnKey="dueDate" />
                  </th>
                  <th>
                    <span className="sr-only">Manage issue</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.map((issue) => {
                  const person = state.people.find(
                    (item) => item.id === issue.personId,
                  );
                  return (
                    <tr
                      key={issue.id}
                      onClick={() =>
                        openModal({
                          type: "quality-issue",
                          personId: person.id,
                          issueId: issue.id,
                        })
                      }
                    >
                      <td data-label="Severity" className="quality-severity-cell">
                        <Badge>{issue.severity}</Badge>
                      </td>
                      <td data-label="Client" className="quality-client-cell">
                        <div className="person-cell">
                          <span>
                            <button
                              className="name-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/people/${person.id}`);
                              }}
                            >
                              {person.name}
                            </button>
                            <small>{person.id}</small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Issue" className="quality-issue-cell">
                        <strong>{issue.type}</strong>
                        <span>{issue.description}</span>
                      </td>
                      <td data-label="Owner" className="quality-owner-cell">
                        <span>{issue.owner}</span>
                      </td>
                      <td data-label="Status" className="quality-status-cell">
                        <Badge>{issue.status}</Badge>
                      </td>
                      <td data-label="Due" className="quality-due-cell">
                        <span>{issue.dueDate ? formatDate(issue.dueDate) : "Not set"}</span>
                      </td>
                      <td className="quality-manage-cell">
                        <Button
                          variant="secondary"
                          aria-label={`Manage ${issue.type} for ${person.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal({
                              type: "quality-issue",
                              personId: person.id,
                              issueId: issue.id,
                            });
                          }}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No validation issues match these filters"
            action={
              <Button variant="secondary" onClick={clearAll}>
                Reset all filters
              </Button>
            }
          >
            Change a filter to see another part of the queue.
          </Empty>
        )}
      </Panel>
    </>
  );
}
export function Administration({ openModal }) {
  const { state } = useStore();
  const staff = currentStaff(state);
  return (
    <>
      <PageHeading
        title="Administration"
        subtitle="The foundations of a consistent care experience."
      />
      <Notice>
        Sample configuration for exploring the workspace. Publication, clinical
        approval, and live permissions are not connected.
      </Notice>
      <Panel title="Workspace configuration" className="admin-panel">
        {[
          [
            BookOpen,
            "Instrument library",
            `${INSTRUMENTS.length} sample questionnaires · Browse topics and preview questions`,
            "instrument",
            "Browse instruments",
          ],
          [
            SlidersHorizontal,
            "Rules & schedules",
            "Explicit follow-ups, version pinning, and independent review",
            "rules",
            "View sample rules",
          ],
          [
            MessageSquare,
            "Messages & delivery",
            "A sample invitation for account-free collection",
            "messages",
            "Preview message",
          ],
          [
            ShieldCheck,
            "Organisation & access",
            `Northside Centre · ${staff?.name}, ${staff?.role}`,
            "scope",
            "View workspace",
          ],
        ].map(([Icon, title, desc, type, action]) => (
          <div className="admin-row" key={title}>
            <span className="admin-icon">
              <Icon size={24} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
            <Button onClick={() => openModal({ type })}>
              {action}
              <ArrowRight size={17} />
            </Button>
          </div>
        ))}
      </Panel>
      <div className="reset-panel">
        <div>
          <h3>Start fresh with sample data</h3>
          <p>Restore the original six people and their worklist.</p>
        </div>
        <Button onClick={() => openModal({ type: "reset" })}>
          <RotateCcw size={17} />
          Reset sample workspace
        </Button>
      </div>
    </>
  );
}
export function Help({ navigate, openModal }) {
  return (
    <>
      <PageHeading
        title="Help & guidance"
        subtitle="A few paths to explore the workspace."
      />
      <div className="help-grid">
        {[
          [
            ClipboardList,
            "Follow an overdue review",
            "Open Kai’s record, choose Set up collection, confirm a sample collection method, and complete the questionnaire.",
            "Open Kai’s record",
            () => navigate("/people/YS-1024"),
          ],
          [
            FileCheck2,
            "Review a submitted response",
            "Open Amelia’s record to review her sample answers. Saving the review preserves the response and its source.",
            "Open Amelia’s record",
            () => navigate("/people/YS-1025"),
          ],
          [
            CalendarClock,
            "Plan the next check-in",
            "Use Plan follow-up in a person record. The new time point stays within the same care episode.",
            "Explore people",
            () => navigate("/people"),
          ],
          [
            Users,
            "Try the participant experience",
            "Try a longer questionnaire with questions that adapt to your answers, without updating a person’s care record. No account is needed.",
            "Try a sample questionnaire",
            () => navigate("/preview"),
          ],
        ].map(([Icon, title, desc, label, fn]) => (
          <Panel key={title}>
            <div className="panel-body help-card">
              <Icon size={25} />
              <h2>{title}</h2>
              <p>{desc}</p>
              <Button onClick={fn}>
                {label}
                <ArrowRight size={17} />
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <Notice>
        All records and questions are fictional. No SMS is sent, no clinical
        score is calculated, and sample answers are saved only in this browser.
        Use your care team’s usual support route for real care questions.
      </Notice>
    </>
  );
}
