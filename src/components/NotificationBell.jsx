import { useState, useRef, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  Clock,
  CalendarClock,
  FileCheck,
  ChevronRight,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { TODAY, formatDate } from "../model";
import { getNotifications } from "../notifications";

const CATEGORY_MAP = {
  data_quality: {
    label: "Data quality error",
    shortLabel: "Data quality",
    Icon: AlertTriangle,
    badgeClass: "coral",
  },
  assessment_overdue: {
    label: "Assessment overdue",
    shortLabel: "Assessment overdue",
    Icon: Clock,
    badgeClass: "amber",
  },
  appointment_overdue: {
    label: "Appointment input overdue",
    shortLabel: "Appointment overdue",
    Icon: CalendarClock,
    badgeClass: "amber",
  },
  assessment_review: {
    label: "Assessment ready for review",
    shortLabel: "Ready for review",
    Icon: FileCheck,
    badgeClass: "purple",
  },
};

export default function NotificationBell({ navigate }) {
  const { state } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const containerRef = useRef(null);

  const notifications = getNotifications(state, TODAY);

  const counts = {
    all: notifications.length,
    data_quality: notifications.filter((n) => n.category === "data_quality").length,
    assessment_overdue: notifications.filter(
      (n) => n.category === "assessment_overdue"
    ).length,
    appointment_overdue: notifications.filter(
      (n) => n.category === "appointment_overdue"
    ).length,
    assessment_review: notifications.filter(
      (n) => n.category === "assessment_review"
    ).length,
  };

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.category === filter);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (href) => {
    setIsOpen(false);
    navigate(href);
  };

  const tabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "data_quality", label: "Data quality", count: counts.data_quality },
    { key: "assessment_overdue", label: "Assessment overdue", count: counts.assessment_overdue },
    { key: "appointment_overdue", label: "Appointment overdue", count: counts.appointment_overdue },
    { key: "assessment_review", label: "Ready for review", count: counts.assessment_review },
  ];

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className={`icon-button notification-bell-btn ${isOpen ? "active" : ""}`}
        aria-label={`Notifications (${notifications.length} item${notifications.length === 1 ? "" : "s"})`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Notifications"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell size={19} />
        {notifications.length > 0 && (
          <span className="notification-badge-dot">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-popover"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="notification-popover-header">
            <div className="notification-popover-title">
              <h3>Notifications</h3>
              {notifications.length > 0 && (
                <span className="notification-total-chip">
                  {notifications.length} needing action
                </span>
              )}
            </div>
            <button
              type="button"
              className="icon-button close-btn"
              aria-label="Close notifications"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="notification-filter-bar" role="tablist" aria-label="Notification categories">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={filter === tab.key}
                className={`notification-pill-tab ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="notification-pill-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="notification-list">
            {filteredNotifications.length === 0 ? (
              <div className="notification-empty">
                <p>No notifications in this view.</p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const categoryInfo = CATEGORY_MAP[item.category] || {
                  label: item.categoryLabel,
                  Icon: Bell,
                  badgeClass: "neutral",
                };
                const IconComponent = categoryInfo.Icon;
                const displayDate = item.due
                  ? formatDate(item.due)
                  : item.submittedAt
                    ? formatDate(item.submittedAt)
                    : item.plannedDate
                      ? formatDate(item.plannedDate)
                      : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="notification-item"
                    onClick={() => handleItemClick(item.href)}
                  >
                    <div className={`notification-icon-wrap ${categoryInfo.badgeClass}`}>
                      <IconComponent size={18} aria-hidden="true" />
                    </div>
                    <div className="notification-item-content">
                      <div className="notification-item-header">
                        <span className={`badge ${categoryInfo.badgeClass} notification-category-badge`}>
                          {categoryInfo.label}
                        </span>
                        {displayDate && (
                          <span className="notification-item-date">{displayDate}</span>
                        )}
                      </div>
                      <h4 className="notification-item-title">{item.title}</h4>
                      <div className="notification-item-detail">{item.detail}</div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="notification-item-arrow"
                      aria-hidden="true"
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
