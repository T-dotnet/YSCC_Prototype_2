import { useState, useEffect, useRef } from "react";
import {
  House,
  Users,
  ChartNoAxesColumnIncreasing,
  Settings,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe2,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Logo, Avatar } from "./UI";
import NotificationBell from "./NotificationBell";
import { useStore } from "../store";
import { currentStaff } from "../model";
const links = [
  ["/", "My work", House],
  ["/people", "People", Users],
  ["/quality", "Data quality", ChartNoAxesColumnIncreasing],
  ["/administration", "Administration", Settings],
];
export default function Shell({
  path,
  navigate,
  qualityCount,
  children,
  openModal,
  storageError,
}) {
  const { state } = useStore();
  const staff = currentStaff(state);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!mobile) return;
    menuRef.current?.querySelector(".mobile-only")?.focus();
    const handle = (event) => {
      if (event.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [mobile]);
  const active = path.startsWith("/people") ? "/people" : path;
  const go = (p) => {
    navigate(p);
    setMobile(false);
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={menuRef}
        className={`sidebar ${mobile ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      >
        <div className="brand-row">
          <Logo />
          <button
            className="icon-button sidebar-collapse"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <button
          className="scope"
          aria-label="Northside Centre · Your workspace"
          title={collapsed ? "Northside Centre · Your workspace" : undefined}
          onClick={() => openModal({ type: "scope" })}
        >
          <strong>Northside Centre</strong>
          {collapsed ? <Globe2 size={20} /> : <ChevronDown size={16} />}
          <span>Your workspace</span>
        </button>
        <nav aria-label="Main navigation">
          {links.map(([href, label, Icon]) => (
            <button
              key={href}
              className={`nav-item ${active === href ? "active" : ""}`}
              title={collapsed ? label : undefined}
              onClick={() => go(href)}
              aria-current={active === href ? "page" : undefined}
            >
              <Icon
                size={21}
                strokeWidth={1.8}
                fill={active === "/" && href === "/" ? "currentColor" : "none"}
              />
              <span>{label}</span>
              {href === "/quality" && qualityCount > 0 && (
                <span className="nav-count">{qualityCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${active === "/help" ? "active" : ""}`}
            title={collapsed ? "Help & guidance" : undefined}
            aria-current={active === "/help" ? "page" : undefined}
            onClick={() => go("/help")}
          >
            <CircleHelp size={21} />
            <span>Help & guidance</span>
          </button>
          <button
            className="profile"
            onClick={() => openModal({ type: "profile" })}
          >
            <Avatar name={staff?.name || "Staff"} />
            <span>
              <strong>{staff?.name || "Staff"}</strong>
              <small>{staff?.role || "Unavailable"}</small>
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
      </aside>
      <div className="app-body" inert={mobile || undefined}>
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <span>
              {links.find((l) => l[0] === active)?.[1] || "Help & guidance"}
            </span>
            {path.startsWith("/people/") && (
              <>
                <span className="breadcrumb-separator">/</span>
                <span>{path.split("/")[2]}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <button
              className="system-status-indicator"
              type="button"
              title="System Status: All services operational"
              onClick={() => openModal({ type: "system-status" })}
            >
              <span className="system-status-dot" />
              <span className="system-status-text">Operational</span>
            </button>
            <div className="topbar-divider" aria-hidden="true" />
            <NotificationBell navigate={navigate} />
            <div className="topbar-divider" aria-hidden="true" />
            <button
              className="logout-button"
              type="button"
              title="Log out"
              onClick={() => openModal({ type: "logout" })}
            >
              <LogOut size={16} />
              <span className="logout-label">Log out</span>
            </button>
          </div>
        </header>
        <main id="main" className="main" tabIndex={-1}>
          {storageError && (
            <div className="error-banner" role="alert">
              Changes are only held in this open tab. Browser storage is
              unavailable; keep the tab open to retain your work.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
