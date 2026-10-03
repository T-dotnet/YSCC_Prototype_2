import StandardTable from "../components/StandardTable";
import AssessmentScheduleSettings from "../components/AssessmentScheduleSettings";
import AdminInstrumentsTable from "../components/AdminInstrumentsTable";
import AdminOutcomeOptions from "../components/AdminOutcomeOptions";
import ProductTerminology from "../components/ProductTerminology";
import useQueueView from "../useQueueView";
import { lazy, Suspense, useMemo } from "react";
const AdminDataDictionary = lazy(() => import("../components/AdminDataDictionary"));
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from "../instruments";
import {
  Plus,
  ArrowRight,
  ShieldAlert,
  Clock,
  CalendarX,
  FileCheck,
  Search,
  ClipboardList,
  FileCheck2,
  CalendarClock,
  Users,
  SlidersHorizontal,
  MessageSquare,
  ShieldCheck,
  BookOpen,
  Database,
} from "lucide-react";
import { useStore } from "../store";
import { assessmentSmsEnabled } from "../assessmentFeatures";
import { mvpAssessmentMode } from '../mvpAssessmentPathway';
import { patientIdentifier, patientSecondaryDetail } from "../patientIdentity";
import { currentStaff, formatDate, TODAY } from "../model";
import { sortQueueRows } from "../queueSort";
import { ActiveFilters, SortableHeader, useQueueSort } from "../components/QueueControls";
import { QueueCell, QueueRow } from "../components/QueueRow";
import ListFilterBar from "../components/ListFilterBar";
import {
  QUALITY_SEVERITIES,
  QUALITY_STATUSES,
  getQualityIssues,
} from "../dataQuality";
import {
  ActionGroup, PageHeading,
  Panel,
  Button,
  Badge,
  Notice,
  Empty,
  Select,
  Tabs,
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

  const { sort: sortConfig, toggleSort } = useQueueSort({
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

    return sortQueueRows(result, sortConfig, {
      severity: (issue) => severityValue(issue.severity),
      type: (issue) => issue.type,
      owner: (issue) => issue.owner,
      status: (issue) => issue.status,
      dueDate: (issue) => issue.dueDate,
    });
  }, [issues, query, state.people, filters, sortConfig]);
  const filterOptions = {
    organisations: [...new Set(issues.map((issue) => issue.organisation))],
    clinicians: [...new Set(issues.map((issue) => issue.owner))],
    periods: [...new Set(issues.map((issue) => issue.submissionPeriod))],
  };
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "status" && value !== EMPTY_FILTERS[key],
  ).length;
  return (
    <>
      <PageHeading
        title="Data quality"
        subtitle="Continuously check completeness, resolve the source, and retain the evidence."
        meta={`Sample PMHC-MDS rule set · Northside Centre · Today ${formatDate(TODAY)}`}
      />
      <Panel
        title="Validation issues"
        action={<Badge>{unresolved.length} unresolved</Badge>}
        className="quality-queue queue-list-panel"
      >
        <ListFilterBar
          id="quality-status"
          label="Validation issue status"
          items={["All statuses", ...QUALITY_STATUSES].map((value) => ({
            value,
            label: value === "All statuses" ? "All" : value,
            count: value === "All statuses" ? issues.length : issues.filter((issue) => issue.status === value).length,
          }))}
          value={filters.status}
          onChange={(value) => setFilter("status", value)}
          query={query}
          onQueryChange={setQuery}
          placeholder="Search issues"
          shown={visibleIssues.length}
          total={issues.length}
          noun="issues"
          activeAdvancedCount={activeFilterCount}
          onClear={clearAll}
          advanced={<>
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
          </>}
        />
        <ActiveFilters
          items={[
            ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => setQuery("") }] : []),
            ...Object.entries(filters)
              .filter(([key, value]) => value !== EMPTY_FILTERS[key])
              .map(([key, value]) => ({
                id: key,
                label: `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}: ${value}`,
                onRemove: () => setFilter(key, EMPTY_FILTERS[key]),
              })),
          ]}
          onClear={clearAll}
        />
        {visibleIssues.length ? (
          <StandardTable className="quality-table" scrollClassName="quality-table-scroll" label="Validation issue queue">
              <thead>
                <tr>
                  <SortableHeader label="Severity" sortKey="severity" sort={sortConfig} onSort={toggleSort} />
                  <th scope="col">Client</th>
                  <SortableHeader label="Issue" sortKey="type" sort={sortConfig} onSort={toggleSort} />
                  <SortableHeader label="Owner" sortKey="owner" sort={sortConfig} onSort={toggleSort} />
                  <SortableHeader label="Status" sortKey="status" sort={sortConfig} onSort={toggleSort} />
                  <SortableHeader label="Due" sortKey="dueDate" sort={sortConfig} onSort={toggleSort} />
                  <th scope="col">
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
                    <QueueRow
                      key={issue.id}
                      onClick={() =>
                        openModal({
                          type: "quality-issue",
                          personId: person.id,
                          issueId: issue.id,
                        })
                      }
                    >
                      <QueueCell label="Severity" slot="priority" className="quality-severity-cell">
                        <Badge>{issue.severity}</Badge>
                      </QueueCell>
                      <QueueCell label="Client" slot="subject" className="quality-client-cell">
                        <div className="person-cell">
                          <span>
                            <button
                              className="name-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/people/${person.id}`);
                              }}
                            >
                              {patientIdentifier(person)}
                            </button>
                            {patientSecondaryDetail(person) && <small>{patientSecondaryDetail(person)}</small>}
                          </span>
                        </div>
                      </QueueCell>
                      <QueueCell label="Issue" slot="summary" className="quality-issue-cell">
                        <strong>{issue.type}</strong>
                        <span>{issue.description}</span>
                      </QueueCell>
                      <QueueCell label="Owner" slot="owner" className="quality-owner-cell">
                        <span>{issue.owner}</span>
                      </QueueCell>
                      <QueueCell label="Status" slot="state" className="quality-status-cell">
                        <Badge>{issue.status}</Badge>
                      </QueueCell>
                      <QueueCell label="Due" slot="date" className="quality-due-cell">
                        <span>{issue.dueDate ? formatDate(issue.dueDate) : "Not set"}</span>
                      </QueueCell>
                      <QueueCell label="Manage" slot="action" className="quality-manage-cell">
                        <Button
                          variant="secondary"
                          aria-label={`Manage ${issue.type} for ${patientIdentifier(person)}`}
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
                      </QueueCell>
                    </QueueRow>
                  );
                })}
              </tbody>
            </StandardTable>
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
export function Administration({ openModal, navigate }) {
  const { state } = useStore();
  const staff = currentStaff(state);
  const view = useQueueView();
  const adminTabs = ["workspace", "bundles", "instruments", "data-dictionary", "outcomes"];
  const adminTab = adminTabs.includes(view.params.get("tab")) ? view.params.get("tab") : "workspace";
  return (
    <>
      <PageHeading
        title="Administration"
        subtitle="The foundations of a consistent care experience."
      />
      <Tabs id="administration" panelId="administration-panel" label="Administration sections" className="administration-tabs" autoReveal
        items={[{ value: "workspace", label: "Workspace" }, { value: "bundles", label: "Assessment Packs" }, { value: "instruments", label: "Measures" }, { value: "data-dictionary", label: "Data dictionary" }, { value: "outcomes", label: "Record outcomes" }]}
        value={adminTab} onChange={(value) => view.set("tab", value, "workspace")} />
      <div role="tabpanel" id="administration-panel" className="administration-tab-content" aria-labelledby={`administration-tab-${adminTabs.indexOf(adminTab)}`}>
      {adminTab === "bundles" && <AssessmentScheduleSettings />}
      {adminTab === "instruments" && <AdminInstrumentsTable settings={state.settings} />}
      {adminTab === "outcomes" && <AdminOutcomeOptions />}
      {adminTab === "data-dictionary" && <Suspense fallback={<p role="status">Opening data dictionary…</p>}><AdminDataDictionary /></Suspense>}
      {adminTab === "workspace" && <div className="stack">
      <div className="section-toolbar administration-section-heading">
        <div>
          <h2>Workspace configuration</h2>
          <p>Shared setup for this workspace.</p>
        </div>
      </div>
      <Panel className="admin-panel">
        {[
          [
            SlidersHorizontal,
            "Assessment Packs",
            mvpAssessmentMode(state.settings)
              ? "Defined measure sets for initial assessments and 90-day reviews"
              : "Define measure sets by program, care level, or a recorded event",
            "bundles",
            "Manage Assessment Packs",
          ],
          [
            BookOpen,
            "Measures",
            `${(mvpAssessmentMode(state.settings) ? INSTRUMENTS : STANDARD_INSTRUMENTS).length} codebook measures · Browse fields and preview questions`,
            "instruments",
            "Browse measures",
          ],
          [
            Database,
            "Data dictionary",
            "Field definitions, coding, and extract mappings",
            "data-dictionary",
            "Browse data dictionary",
          ],
          [
            FileCheck2,
            "Record outcomes",
            "Configure outcome choices for measure status changes",
            "outcomes",
            "Manage outcomes",
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
        ].filter(([, , , type]) => type !== "messages" || assessmentSmsEnabled(state.settings))
          .map(([Icon, title, desc, type, action]) => (
          <div className="admin-row" key={title}>
            <span className="admin-icon">
              <Icon size={24} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
            <Button onClick={() => ["bundles", "instruments", "outcomes", "data-dictionary"].includes(type) ? navigate(`/administration?tab=${type}`) : openModal({ type })}>
              {action}
              <ArrowRight size={17} />
            </Button>
          </div>
        ))}
      </Panel>
      </div>}
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
            "Open Kai’s record, choose Set up collection, confirm a sample collection method, and complete the measure.",
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
            "Try a longer measure with questions that adapt to your answers, without updating a person’s care record. No account is needed.",
            "Try a sample measure",
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
      <ProductTerminology />
    </>
  );
}
