import { useState, useMemo } from "react";
import { Plus, ArrowRight, ShieldAlert, Clock, CalendarX, FileCheck, X } from "lucide-react";
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
import {
  PageHeading,
  Button,
  Panel,
  SearchInput,
  Select,
  Badge,
  Empty,
  Pagination,
  Tabs,
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
  const [sortConfig, setSortConfig] = useState({ key: "due", direction: "asc" });
  const tasks = ownedTasks(getTasks(state), state, ownership);

  // --- Notifications, Tasks & Alerts Container Data ---
  const [alertFilter, setAlertFilter] = useState("All alerts");
  const [alertQuery, setAlertQuery] = useState("");
  const [alertPage, setAlertPage] = useState(1);

  const qualityIssues = getQualityIssues(state, TODAY).filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status)
  );

  const dqAlerts = qualityIssues.map((issue) => ({
    id: `dq-${issue.id}`,
    category: "Data quality error",
    categoryKey: "Data quality errors",
    title: issue.title || issue.type || "Data quality error",
    person: issue.person ? { name: issue.person.name, id: issue.person.id } : null,
    detail: issue.summary || issue.description || issue.detail || "Data quality check failed",
    badgeColor: "coral",
    icon: ShieldAlert,
    actionLabel: "Resolve issue",
    href: issue.person ? `/people/${encodeURIComponent(issue.person.id)}?tab=quality` : "/quality",
    date: issue.detectedAt ? issue.detectedAt.slice(0, 10) : TODAY,
  }));

  const assessmentOverdueAlerts = tasks
    .filter((task) => task.status === "Overdue" && task.collection)
    .map((task) => ({
      id: `ao-${task.collection.id}`,
      category: "Assessment overdue",
      categoryKey: "Assessment overdue",
      title: task.collection.label || "Assessment collection",
      person: task.person,
      detail: `Due ${formatDate(task.collection.due)} · Questionnaire response overdue`,
      badgeColor: "amber",
      icon: Clock,
      actionLabel: task.action || "Follow up",
      href: taskHref(task, view.href),
      date: task.collection.due,
    }));

  const appointmentOverdueAlerts = state.people.flatMap((person) =>
    (person.episodes || [])
      .filter((e) => e.status === "Active")
      .flatMap((episode) =>
        (episode.appointments || [])
          .filter((apt) => appointmentIsOverdue(apt, TODAY))
          .map((apt) => ({
            id: `apto-${apt.id}`,
            category: "Appointment input overdue",
            categoryKey: "Appointment input overdue",
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

  const assessmentReviewAlerts = tasks
    .filter((task) => task.status === "Ready for review" && task.collection)
    .map((task) => ({
      id: `ar-${task.collection.id}`,
      category: "Assessment ready for review",
      categoryKey: "Ready for review",
      title: task.collection.label || "Assessment review",
      person: task.person,
      detail: "Submitted response is awaiting clinical review",
      badgeColor: "purple",
      icon: FileCheck,
      actionLabel: "Review response",
      href: `/people/${encodeURIComponent(task.person.id)}/assessment-review/${encodeURIComponent(task.collection.id)}`,
      date: task.collection.due || TODAY,
    }));

  const allAlerts = [
    ...dqAlerts,
    ...assessmentOverdueAlerts,
    ...appointmentOverdueAlerts,
    ...assessmentReviewAlerts,
  ];

  const alertFiltersList = [
    "All alerts",
    "Data quality errors",
    "Assessment overdue",
    "Appointment input overdue",
    "Ready for review",
  ];

  const filteredAlerts = allAlerts.filter((alert) => {
    const matchesCategory =
      alertFilter === "All alerts" || alert.categoryKey === alertFilter;
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

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === "name") {
          valA = a.person.name;
          valB = b.person.name;
        } else if (sortConfig.key === "due") {
          valA = workRecord(a).due || "";
          valB = workRecord(b).due || "";
        } else if (sortConfig.key === "status") {
          valA = a.status;
          valB = b.status;
        } else if (sortConfig.key === "item") {
          valA = a.kind === "intake" ? "Intake" : workRecord(a).label;
          valB = b.kind === "intake" ? "Intake" : workRecord(b).label;
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [tasks, filter, point, query, sortConfig]);

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
          <Tabs
            id="work"
            label="Work status"
            className="work-tabs"
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
            {(point !== "All collection points" || query) && (
              <div className="active-filters-row">
                <div className="active-filters-list">
                  {query && (
                    <button
                      className="filter-chip"
                      onClick={() => view.set("q", "", "", true)}
                      title="Remove search filter"
                    >
                      <span>Search: {query}</span>
                      <X size={14} />
                    </button>
                  )}
                  {point !== "All collection points" && (
                    <button
                      className="filter-chip"
                      onClick={() => view.set("point", "All collection points", "All collection points", true)}
                      title="Remove collection point filter"
                    >
                      <span>Point: {point}</span>
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
            <div className="table-scroll desktop-worklist">
              <table
                className="work-table"
                aria-label="Work items and next actions"
              >
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("name")}>
                      Person <SortIndicator columnKey="name" />
                    </th>
                    <th className="sortable" onClick={() => toggleSort("item")}>
                      Work item <SortIndicator columnKey="item" />
                    </th>
                    <th className="sortable" onClick={() => toggleSort("due")}>
                      Due / review date <SortIndicator columnKey="due" />
                    </th>
                    <th className="sortable" onClick={() => toggleSort("status")}>
                      Status <SortIndicator columnKey="status" />
                    </th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => {
                    const { person: p, status, action } = task;
                    const c = workRecord(task);
                    return (
                      <tr key={c.id} onClick={() => openTask(task)}>
                        <td>
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
                        </td>
                        <td>
                          {task.kind === "intake"
                            ? `Intake - ${intakeStage(task.record)}`
                            : c.label}
                        </td>
                        <td>
                          {c.response === "Submitted" ? (
                            <span className="muted">Response received</span>
                          ) : (
                            formatDate(c.due)
                          )}
                        </td>
                        <td>
                          <Badge>{status}</Badge>
                        </td>
                        <td>
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-worklist">
              {visibleTasks.map((task) => {
                const { person: p, status, action } = task;
                const c = workRecord(task);
                return (
                  <article className="task-card" key={c.id}>
                    <div className="task-card-heading">
                      <button className="name-link" onClick={() => openPerson(p)}>
                        {p.name}
                      </button>
                      <Badge>{status}</Badge>
                    </div>
                    <p>
                      {p.id} ·{" "}
                      {task.kind === "intake" &&
                        `Intake - ${intakeStage(task.record)}`}
                      {task.kind !== "intake" && c.label}
                    </p>
                    <p>
                      {c.response === "Submitted"
                        ? "Response received · review pending"
                        : `${task.kind ? "Review" : "Collection due"} ${formatDate(c.due)}`}
                    </p>
                    <Button
                      onClick={() => openTask(task)}
                      aria-label={`${action} · ${p.name} · ${c.label}`}
                    >
                      {action}
                      <ArrowRight size={16} />
                    </Button>
                  </article>
                );
              })}
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
          title="Tasks & Alerts"
        >
          <Tabs
            id="alerts"
            label="Alert categories"
            className="work-tabs"
            value={alertFilter}
            onChange={(val) => {
              setAlertFilter(val);
              setAlertPage(1);
            }}
            items={alertFiltersList.map((val) => ({
              value: val,
              count:
                val === "All alerts"
                  ? allAlerts.length
                  : val === "Data quality errors"
                    ? dqAlerts.length
                    : val === "Assessment overdue"
                      ? assessmentOverdueAlerts.length
                      : val === "Appointment input overdue"
                        ? appointmentOverdueAlerts.length
                        : assessmentReviewAlerts.length,
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
                  placeholder="Search tasks & alerts..."
                />
                <span className="toolbar-count" aria-live="polite">
                  Showing {filteredAlerts.length} of {allAlerts.length}
                </span>
              </div>
            </div>
            {alertQuery && (
              <div className="active-filters-row">
                <div className="active-filters-list">
                  <button
                    className="filter-chip"
                    onClick={() => setAlertQuery("")}
                    title="Remove search filter"
                  >
                    <span>Search: {alertQuery}</span>
                    <X size={14} />
                  </button>
                </div>
                <button
                  className="text-button-small"
                  onClick={() => setAlertQuery("")}
                >
                  Clear search
                </button>
              </div>
            )}
            <div className="alerts-side-list">
              {visibleAlerts.map((alert) => (
                <article className="alert-card-item" key={alert.id}>
                  <div className="alert-card-header">
                    <Badge className={alert.badgeColor}>{alert.category}</Badge>
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
              <Empty visual="botanical" title="No tasks or alerts matching filter">
                Try selecting another category or clear your search term.
              </Empty>
            )}
            <div className="table-footer" role="status">
              <span>
                Showing {alertShowingFrom}–{alertShowingTo} of {filteredAlerts.length}{" "}
                {filteredAlerts.length === 1 ? "item" : "items"}
              </span>
              <Pagination
                label="Tasks & Alerts"
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
