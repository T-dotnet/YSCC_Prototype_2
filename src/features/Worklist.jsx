import { useState, useMemo } from "react";
import { Plus, ArrowRight, CalendarX } from "lucide-react";
import { useStore } from "../store";
import {
  getTasks,
  formatDate,
  currentStaff,
  TODAY,
} from "../model";
import { appointmentIsOverdue } from "../appointments";
import { getQualityIssues } from "../dataQuality";
import { ownedTasks, taskHref } from "../workflow";
import { intakeStage } from "../intake";
import useQueueView from "../useQueueView";
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
  FilterTabs,
} from "../components/UI";

const filters = [
  "All work",
  "Needs attention",
  "Ready for review",
  "Intake",
  "Referrals",
];
const PAGE_SIZE = 6;

const workRecord = (task) =>
  task.collection || {
    id: task.record.id,
    label:
      task.kind === "intake"
        ? "Intake"
        : `Referral · ${task.record.destination}`,
    due: task.record.reviewDate,
  };
export default function Worklist({ navigate, openModal }) {
  const { state } = useStore();
  const view = useQueueView();
  const query = view.params.get("q") || "";
  const filter = filters.includes(view.params.get("filter"))
    ? view.params.get("filter")
    : "All work";
  const point = view.params.get("point") || "All collection points";
  const ownership = ["me", "team", "unassigned"].includes(
    view.params.get("owner"),
  )
    ? view.params.get("owner")
    : "me";
  const { sort: sortConfig, toggleSort } = useQueueSort({ key: "due", direction: "asc" });
  const tasks = ownedTasks(getTasks(state), state, ownership);

  // Alerts complement the worklist instead of repeating assessment tasks that
  // already have a clear next action above.
  const [alertFilter, setAlertFilter] = useState("All");
  const [alertQuery, setAlertQuery] = useState("");
  const [alertPage, setAlertPage] = useState(1);

  const qualityIssues = getQualityIssues(state, TODAY).filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status)
  );

  const dqAlerts = qualityIssues.map((issue) => ({
    id: `dq-${issue.id}`,
    category: "Data quality error",
    categoryKey: "Errors",
    title: issue.title || issue.type || "Data quality error",
    person: issue.person ? { name: issue.person.name, id: issue.person.id } : null,
    detail: issue.summary || issue.description || issue.detail || "Data quality check failed",
    badgeColor: "coral",
    actionLabel: "Resolve issue",
    href: issue.person ? `/people/${encodeURIComponent(issue.person.id)}?tab=quality` : "/quality",
    date: issue.detectedAt ? issue.detectedAt.slice(0, 10) : TODAY,
  }));

  const appointmentOverdueAlerts = (state.people || []).flatMap((person) =>
    (person.episodes || [])
      .filter((e) => e.status === "Active")
      .flatMap((episode) =>
        (episode.appointments || [])
          .filter((apt) => appointmentIsOverdue(apt, TODAY))
          .map((apt) => ({
            id: `apto-${apt.id}`,
            category: "Appointment input overdue",
            categoryKey: "Appointments",
            title: `${apt.practitionerService || "Planned contact"} attendance missing`,
            person: { name: person.name, id: person.id },
            detail: `Planned for ${apt.plannedDate} at ${apt.plannedTime || "unspecified time"} · Attendance input required`,
            badgeColor: "amber",
            icon: CalendarX,
            actionLabel: "Record outcome",
            href: `/people/${encodeURIComponent(person.id)}?tab=appointments`,
            date: apt.plannedDate,
          }))
      )
  );

  const allAlerts = [...dqAlerts, ...appointmentOverdueAlerts];

  const alertFiltersList = [
    "All",
    "Errors",
    "Appointments",
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
  const matchesFilter = (task, selected) =>
    selected === "All work" ||
    (selected === "Intake"
      ? task.kind === "intake"
      : selected === "Referrals"
        ? task.kind === "referral"
        : selected === "Needs attention"
          ? ["Overdue", "Sending failed", "Declined"].includes(task.status)
          : task.status === "Ready for review");
  const filtered = useMemo(() => {
    let result = tasks.filter(
      (task) =>
        matchesFilter(task, filter) &&
        (point === "All collection points" || workRecord(task).label === point) &&
        `${task.person.name} ${task.person.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );

    return sortQueueRows(result, sortConfig, {
      name: (task) => task.person.name,
      due: (task) => workRecord(task).due,
      status: (task) => task.status,
      item: (task) => task.kind === "intake" ? "Intake" : workRecord(task).label,
    });
  }, [tasks, filter, point, query, sortConfig]);
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
        subtitle="Intake, assessment and referral follow-up in one place."
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
          className="work-panel worklist-main-panel"
          title="Worklist"
          action={
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
          }
        >
          <FilterTabs
            id="work"
            label="Work status"
            className="worklist-status-tabs"
            value={filter}
            onChange={(value) => view.set("filter", value, "All work", true)}
            items={filters.map((value) => ({
              value,
              count: tasks.filter((task) => matchesFilter(task, value)).length,
            }))}
          />
          <div
            role="tabpanel"
            id="work-panel"
            aria-labelledby={`work-tab-${filters.indexOf(filter)}`}
          >
            <div className="work-toolbar">
              <div className="toolbar-search-and-count">
                <SearchInput
                  value={query}
                  onChange={(value) => view.set("q", value, "", true)}
                />
                <span className="toolbar-count" aria-live="polite">
                  Showing {filtered.length} of {tasks.length}
                </span>
              </div>
              <Select
                label="Collection point filter"
                value={point}
                onChange={(event) =>
                  view.set(
                    "point",
                    event.target.value,
                    "All collection points",
                    true,
                  )
                }
              >
                <option>All collection points</option>
                {[...new Set(tasks.map((task) => workRecord(task).label))].map(
                  (label) => (
                    <option key={label}>{label}</option>
                  ),
                )}
              </Select>
            </div>
            <ActiveFilters
              items={[
                ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => view.set("q", "", "", true) }] : []),
                ...(point !== "All collection points" ? [{ id: "point", label: `Point: ${point}`, onRemove: () => view.set("point", "All collection points", "All collection points", true) }] : []),
              ]}
              onClear={clearAll}
            />
            <div className="table-scroll desktop-worklist">
              <table
                className="work-table responsive-queue-table"
                aria-label="Work items and next actions"
              >
                <thead>
                  <tr>
                    <SortableHeader label="Person" sortKey="name" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label="Work item" sortKey="item" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label="Due / review date" sortKey="due" sort={sortConfig} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" sort={sortConfig} onSort={toggleSort} />
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const { person: p, status, action } = task;
                    const c = workRecord(task);
                    return (
                      <QueueRow key={c.id} onClick={() => openTask(task)}>
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
                                {p.name}
                              </button>
                              <small>{p.id}</small>
                            </span>
                          </div>
                        </QueueCell>
                        <QueueCell label="Work item" slot="summary">
                          {task.kind === "intake"
                            ? `Intake - ${intakeStage(task.record)}`
                            : c.label}
                        </QueueCell>
                        <QueueCell label="Due / review date" slot="date">
                          {c.response === "Submitted" ? (
                            <span className="muted">Response received · review pending</span>
                          ) : (
                            formatDate(c.due)
                          )}
                        </QueueCell>
                        <QueueCell label="Status" slot="state">
                          <Badge>{status}</Badge>
                        </QueueCell>
                        <QueueCell label="Next action" slot="action">
                          <Button
                            className="task-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTask(task);
                            }}
                            aria-label={`${action} · ${p.name} · ${c.label}`}
                          >
                            {action}
                            <ArrowRight size={16} />
                          </Button>
                        </QueueCell>
                      </QueueRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  : "Try another search, status, or collection point."}
              </Empty>
            )}
            <div className="table-footer" role="status">
              <span>
                Showing {showingFrom}–{showingTo} of {filtered.length}{" "}
                {filtered.length === 1 ? "task" : "tasks"}
              </span>
              <span>Sorted by priority, then due / review date</span>
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
            Data quality and appointment follow-up that is not already shown in
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
                    ? dqAlerts.length
                    : appointmentOverdueAlerts.length,
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
                <span className="toolbar-count" aria-live="polite">
                  Showing {filteredAlerts.length} of {allAlerts.length}
                </span>
              </div>
            </div>
            <ActiveFilters
              items={alertQuery ? [{ id: "search", label: `Search: ${alertQuery}`, onRemove: () => setAlertQuery("") }] : []}
              onClear={() => setAlertQuery("")}
            />
            <div className="alerts-side-list">
              {visibleAlerts.map((alert) => (
                <article className="alert-card-item" key={alert.id}>
                  <div className="alert-card-header">
                    <Badge tone={alert.badgeColor}>{alert.category}</Badge>
                    <span className="small-text muted">{formatDate(alert.date)}</span>
                  </div>
                  <div className="alert-card-body">
                    <strong className="alert-card-title">{alert.title}</strong>
                    {alert.person ? (
                      <div className="person-cell small">
                        <button
                          className="name-link"
                          onClick={() => openPerson(alert.person)}
                        >
                          {alert.person.name} <small>({alert.person.id})</small>
                        </button>
                      </div>
                    ) : (
                      <div className="muted small">System record</div>
                    )}
                    <p className="alert-card-detail">{alert.detail}</p>
                  </div>
                  <div className="alert-card-footer">
                    <Button
                      className="task-action small"
                      onClick={() => {
                        view.remember();
                        navigate(alert.href);
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
