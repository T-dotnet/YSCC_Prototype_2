import { useState, useMemo } from "react";
import { Plus, ArrowRight, CalendarX } from "lucide-react";
import { useStore } from "../store";
import { assessmentDueDatesEnabled, assessmentSchedulingEnabled } from "../assessmentFeatures";
import { patientIdentifier, patientSecondaryDetail } from "../patientIdentity";
import { formatDate, currentStaff, TODAY } from "../model";
import { appointmentIsOverdue } from "../appointments";
import { getQualityIssues } from "../dataQuality";
import { matchesWorkOwner, taskHref } from "../workflow";
import { getWorkItems, WORK_STAGES, workNeedsAttention } from "../workQueue";
import { contactVisible } from "../assessmentFeatures";
import { intakeStage } from "../intake";
import useQueueView from "../useQueueView";
import { sortQueueRows } from "../queueSort";
import { ActiveFilters, SortableHeader, useQueueSort } from "../components/QueueControls";
import { QueueCell, QueueRow } from "../components/QueueRow";
import StandardTable from "../components/StandardTable";
import ListFilterBar from "../components/ListFilterBar";
import {
  ActionGroup, PageHeading,
  Button,
  Panel,
  SearchInput,
  Select,
  Badge,
  Empty,
  Pagination,
  FilterTabs,
} from "../components/UI";

const filters = [
  "All work",
  "Needs attention",
  "Ready for review",
];
const PAGE_SIZE = 6;

export default function Worklist({ navigate, openModal }) {
  const { state } = useStore();
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const showDueDates = scheduleAssessments || assessmentDueDatesEnabled(state.settings);
  const view = useQueueView();
  const query = view.params.get("q") || "";
  const filter = filters.includes(view.params.get("filter"))
    ? view.params.get("filter")
    : "All work";
  const stage = WORK_STAGES.includes(view.params.get("stage")) ? view.params.get("stage") : "All stages";
  const ownership = ["me", "team", "unassigned"].includes(
    view.params.get("owner"),
  )
    ? view.params.get("owner")
    : "me";
  const { sort: sortConfig, toggleSort } = useQueueSort({ key: "due", direction: "asc" });
  const tasks = getWorkItems(state, ownership);
  const statuses = [...new Set(tasks.map(task => task.status))].sort();
  const statusFilter = statuses.includes(view.params.get("status")) ? view.params.get("status") : "All statuses";

  // Alerts complement the worklist instead of repeating assessment tasks that
  // already have a clear next action above.
  const [alertFilter, setAlertFilter] = useState("All");
  const [alertQuery, setAlertQuery] = useState("");
  const [alertPage, setAlertPage] = useState(1);

  const peopleById = new Map((state.people || []).map((person) => [person.id, person]));
  const qualityIssues = getQualityIssues(state, TODAY).filter((issue) => {
    const person = peopleById.get(issue.personId);
    return person && !person.archivedAt && !["Resolved", "Closed"].includes(issue.status);
  });

  const dqAlerts = qualityIssues.map((issue) => ({
    id: `dq-${issue.id}`,
    issueId: issue.id,
    category: "Data quality error",
    categoryKey: "Errors",
    title: issue.title || issue.type || "Data quality error",
    person: peopleById.get(issue.personId),
    owner: issue.owner || peopleById.get(issue.personId)?.owner,
    detail: issue.summary || issue.description || issue.detail || "Data quality check failed",
    badgeColor: "coral",
    actionLabel: "Manage issue",
    date: issue.detectedAt ? issue.detectedAt.slice(0, 10) : TODAY,
  }));

  const appointmentOverdueAlerts = (state.people || []).filter((person) => !person.archivedAt).flatMap((person) =>
    (person.episodes || [])
      .filter((e) => e.status === "Active")
      .flatMap((episode) =>
        (episode.appointments || [])
          .filter((apt) => contactVisible(apt, state.settings) && appointmentIsOverdue(apt, TODAY))
          .map((apt) => ({
            id: `apto-${apt.id}`,
            category: "Contact input overdue",
            categoryKey: "Contact",
            title: `${apt.practitionerService || "Planned contact"} attendance missing`,
            person: { name: person.name, id: person.id },
            owner: episode.owner || person.owner,
            detail: `Planned for ${apt.plannedDate} at ${apt.plannedTime || "unspecified time"} · Attendance input required`,
            badgeColor: "coral",
            icon: CalendarX,
            actionLabel: "Record outcome",
            href: `/people/${encodeURIComponent(person.id)}?tab=Events&episode=${encodeURIComponent(episode.id)}`,
            date: apt.plannedDate,
          }))
      )
  );

  const allAlerts = [...dqAlerts, ...appointmentOverdueAlerts].filter((alert) =>
    matchesWorkOwner(alert.owner, state, ownership),
  );

  const alertFiltersList = [
    "All",
    "Errors",
    "Contact",
  ];

  const filteredAlerts = allAlerts.filter((alert) => {
    const matchesCategory =
      alertFilter === "All" || alert.categoryKey === alertFilter;
    const personStr = alert.person ? `${alert.person.name} ${alert.person.id}` : "";
    const searchStr = `${alert.category} ${alert.title} ${alert.detail} ${personStr}`.toLowerCase();
    const matchesQuery = searchStr.includes(alertQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const ALERT_PAGE_SIZE = 3;
  const alertPageCount = Math.max(1, Math.ceil(filteredAlerts.length / ALERT_PAGE_SIZE));
  const currentAlertPage = Math.min(alertPage, alertPageCount);
  const alertStart = (currentAlertPage - 1) * ALERT_PAGE_SIZE;
  const visibleAlerts = filteredAlerts.slice(alertStart, alertStart + ALERT_PAGE_SIZE);
  const alertShowingFrom = filteredAlerts.length ? alertStart + 1 : 0;
  const alertShowingTo = Math.min(alertStart + ALERT_PAGE_SIZE, filteredAlerts.length);
  const matchesFilter = (task, selected) => selected === "All work" ||
    (selected === "Needs attention" ? workNeedsAttention(task) : task.status === "Ready for review");
  const filtered = useMemo(() => {
    let result = tasks.filter(
      (task) =>
        matchesFilter(task, filter) &&
        (stage === "All stages" || task.stage === stage) &&
        (statusFilter === "All statuses" || task.status === statusFilter) &&
        `${task.person.name} ${task.person.id} ${task.title} ${task.status}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );

    return sortQueueRows(result, sortConfig, {
      name: (task) => task.person.name,
      due: (task) => task.due || "9999-12-31",
      status: (task) => task.status,
      item: (task) => task.title,
    });
  }, [tasks, filter, stage, statusFilter, query, sortConfig]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number(view.params.get("page"));
  const page = Math.min(
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageCount,
  );
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleTasks = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = filtered.length ? pageStart + 1 : 0;
  const showingTo = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const openTask = (task) => {
    view.remember();
    navigate(taskHref(task, view.href));
  };
  const openPerson = (person) => {
    view.remember();
    navigate(`/people/${person.id}?returnTo=${encodeURIComponent(view.href)}`);
  };

  const clearAll = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete("q");
    next.delete("point");
    next.delete("stage");
    next.delete("status");
    next.delete("filter");
    next.delete("page");
    const nextUrl = window.location.pathname + (next.size ? `?${next}` : "");
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  return (
    <>
      <PageHeading
        title="My work"
        subtitle="Client profile, initial assessment, 90-day review and other follow-up in one place."
        meta={`Today · ${formatDate(TODAY)} · Fictional sample data`}
      >
        <Button
          variant="primary"
          onClick={() => openModal({ type: "new-person" })}
        >
          <Plus size={18} />
          New person
        </Button>
      </PageHeading>

      <div className="work-grid">
        <Panel
          className="work-panel worklist-main-panel queue-list-panel"
          title="Worklist"
          action={
            <ActionGroup className="worklist-heading-actions">
              <span className="muted">{filtered.length} tasks</span>
              <Select
                label="Work ownership"
                value={ownership}
                onChange={(event) =>
                  view.set("owner", event.target.value, "me", true)
                }
              >
                <option value="me">
                  Assigned to me · {currentStaff(state)?.name}
                </option>
                <option value="team">My team · Northside Centre</option>
                <option value="unassigned">Unassigned</option>
              </Select>
            </ActionGroup>
          }
        >
          <ListFilterBar
            id="work"
            label="Work status"
            panelId="work-panel"
            value={filter}
            onChange={(value) => view.set("filter", value, "All work", true)}
            items={filters.map((value) => ({
              value,
              count: tasks.filter((task) => matchesFilter(task, value)).length,
            }))}
            query={query}
            onQueryChange={(value) => view.set("q", value, "", true)}
            placeholder="Search work"
            shown={filtered.length}
            total={tasks.length}
            noun={filtered.length === 1 ? "task" : "tasks"}
            activeAdvancedCount={Number(stage !== "All stages") + Number(statusFilter !== "All statuses")}
            onClear={clearAll}
            advanced={
              <>
                <Select label="Flow stage" value={stage}
                  onChange={(event) => view.set("stage", event.target.value, "All stages", true)}>
                  {WORK_STAGES.map(value => <option key={value}>{value}</option>)}
                </Select>
                <Select label="Work item status" value={statusFilter}
                  onChange={(event) => view.set("status", event.target.value, "All statuses", true)}>
                  <option>All statuses</option>
                  {statuses.map(value => <option key={value}>{value}</option>)}
                </Select>
              </>
            }
          />
          <div
            role="tabpanel"
            id="work-panel"
            aria-labelledby={`work-tab-${filters.indexOf(filter)}`}
          >
            <ActiveFilters
              items={[
                ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => view.set("q", "", "", true) }] : []),
                ...(stage !== "All stages" ? [{ id: "stage", label: `Stage: ${stage}`, onRemove: () => view.set("stage", "All stages", "All stages", true) }] : []),
                ...(statusFilter !== "All statuses" ? [{ id: "status", label: `Status: ${statusFilter}`, onRemove: () => view.set("status", "All statuses", "All statuses", true) }] : []),
              ]}
              onClear={clearAll}
            />
            <StandardTable className="work-table" scrollClassName="desktop-worklist" label="Work items and next actions">
                <thead>
                  <tr>
                    <SortableHeader label="Person" sortKey="name" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label="Work item" sortKey="item" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label={showDueDates ? "Due / progress" : "Progress"} sortKey="due" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" sort={sortConfig} onSort={toggleSort} />
                    <th scope="col">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const { person: p, status, action } = task;
                    return (
                      <QueueRow key={task.id} onClick={() => openTask(task)}>
                        <QueueCell label="Person" slot="subject">
                          <div className="person-cell">
                            <span>
                              <button
                                className="name-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPerson(p);
                                }}
                              >
                                {patientIdentifier(p)}
                              </button>
                              {patientSecondaryDetail(p) && <small>{patientSecondaryDetail(p)}</small>}
                            </span>
                          </div>
                        </QueueCell>
                        <QueueCell label="Work item" slot="summary">
                          {task.kind === "intake" ? `Intake · ${intakeStage(task.record)}` : task.title}
                        </QueueCell>
                        <QueueCell label={showDueDates ? "Due / progress" : "Progress"} slot="date">
                          {(showDueDates || !task.collection) && task.due && <span className={status === "Overdue" ? "status-overdue-text" : undefined}>{formatDate(task.due)}</span>}
                          {task.collection && <small className="muted">{task.completed} of {task.total} {task.total === 1 ? "measure" : "measures"} completed</small>}
                          {!task.collection && !task.due && <span className="muted">No date set</span>}
                        </QueueCell>
                        <QueueCell label="Status" slot="state">
                          <Badge>{status}</Badge>
                        </QueueCell>
                        <QueueCell label="Next action" slot="action">
                          <Button
                            type="button"
                            variant="secondary"
                            className="work-item-cta"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTask(task);
                            }}
                            aria-label={`${action} · ${patientIdentifier(p)} · ${task.title}`}
                          >
                            {action}
                            <ArrowRight size={16} />
                          </Button>
                        </QueueCell>
                      </QueueRow>
                    );
                  })}
                </tbody>
              </StandardTable>
            {!filtered.length && (
              <Empty
                title={
                  ownership === "me" && !tasks.length
                    ? "No tasks assigned to you"
                    : "No matching work"
                }
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Reset all filters
                  </Button>
                }
              >
                {ownership === "me" && !tasks.length
                  ? "Choose My team to see work assigned to other care owners."
                  : "Try another search, status, or flow stage."}
              </Empty>
            )}
            <div className="table-footer" role="status">
              <span>
                Showing {showingFrom}–{showingTo} of {filtered.length}{" "}
                {filtered.length === 1 ? "task" : "tasks"}
              </span>
              <span>Sorted by {sortConfig.key === "due" ? "due date" : sortConfig.key === "name" ? "person" : sortConfig.key === "item" ? "work item" : "status"}</span>
              <Pagination
                label="My work"
                page={page}
                pageCount={pageCount}
                onPageChange={(nextPage) =>
                  view.set("page", String(nextPage), "1")
                }
              />
            </div>
          </div>
        </Panel>

        <Panel
          className="work-panel alerts-container-panel"
          title="Additional alerts"
        >
          <p className="alerts-intro">
            Data quality and contact follow-up that is not already shown in
            the worklist.
          </p>
          <FilterTabs
            id="alerts"
            label="Alert categories"
            className="alerts-tabs"
            value={alertFilter}
            onChange={(val) => {
              setAlertFilter(val);
              setAlertPage(1);
            }}
            items={alertFiltersList.map((val) => ({
              value: val,
              count:
                val === "All"
                  ? allAlerts.length
                  : val === "Errors"
                    ? allAlerts.filter((alert) => alert.categoryKey === "Errors").length
                    : allAlerts.filter((alert) => alert.categoryKey === "Contact").length,
            }))}
          />
          <div role="tabpanel" id="alerts-panel">
            <div className="work-toolbar">
              <div className="toolbar-search-and-count">
                <SearchInput
                  value={alertQuery}
                  onChange={(val) => {
                    setAlertQuery(val);
                    setAlertPage(1);
                  }}
                  placeholder="Search additional alerts..."
                />
              </div>
            </div>
            <p className="care-event-results-count alerts-results-count" aria-live="polite">
              <span>Showing {filteredAlerts.length} of {allAlerts.length} alerts</span>
              {filteredAlerts.length !== allAlerts.length && (
                <button
                  type="button"
                  className="filter-count-clear"
                  onClick={() => { setAlertFilter("All"); setAlertQuery(""); setAlertPage(1); }}
                >Clear filters</button>
              )}
            </p>
            <ActiveFilters
              items={alertQuery ? [{ id: "search", label: `Search: ${alertQuery}`, onRemove: () => setAlertQuery("") }] : []}
              onClear={() => setAlertQuery("")}
            />
            <div className="alerts-side-list">
              {visibleAlerts.map((alert) => (
                <article className="alert-card-item" key={alert.id}>
                  <div className="alert-card-header">
                    <Badge tone={alert.badgeColor}>{alert.category}</Badge>
                    <span className={`small-text${alert.categoryKey === "Contact" ? " status-overdue-text" : " muted"}`}>{formatDate(alert.date)}</span>
                  </div>
                  <div className="alert-card-body">
                    <strong className="alert-card-title">{alert.title}</strong>
                    {alert.person ? (
                      <div className="person-cell small">
                        <button
                          className="name-link"
                          onClick={() => openPerson(alert.person)}
                        >
                          {patientIdentifier(alert.person)}
                        </button>
                      </div>
                    ) : (
                      <div className="muted small">System record</div>
                    )}
                    <p className="alert-card-detail">{alert.detail}</p>
                  </div>
                  <div className="alert-card-footer">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        view.remember();
                        if (alert.issueId)
                          openModal({
                            type: "quality-issue",
                            personId: alert.person.id,
                            issueId: alert.issueId,
                          });
                        else navigate(alert.href);
                      }}
                    >
                      {alert.actionLabel}
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            {!filteredAlerts.length && (
              <Empty visual="botanical" title="No additional alerts match">
                Try another category or clear your search term.
              </Empty>
            )}
            <div className="table-footer" role="status">
              <span>
                Showing {alertShowingFrom}–{alertShowingTo} of {filteredAlerts.length}{" "}
                {filteredAlerts.length === 1 ? "item" : "items"}
              </span>
              <Pagination
                label="Additional alerts"
                page={currentAlertPage}
                pageCount={alertPageCount}
                onPageChange={(nextPage) => setAlertPage(nextPage)}
              />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
