import { useState, useEffect, useRef } from "react";
import {
  House,
  Users,
  ChartNoAxesColumnIncreasing,
  History,
  Settings,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe2,
  Menu,
  X,
  LogOut,
  Search,
} from "lucide-react";
import { Logo, Avatar } from "./UI";
import NotificationBell from "./NotificationBell";
import { useStore } from "../store";
import { currentStaff } from "../model";
const links = [
  ["/", "My work", House],
  ["/people", "People", Users],
  ["/quality", "Data quality", ChartNoAxesColumnIncreasing],
  ["/change-log", "Change log", History],
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
  const isInternalPage = path.startsWith("/people/");
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const searchResults = normalizedSearchQuery
    ? state.people
        .filter((person) =>
          `${person.name} ${person.id}`
            .toLocaleLowerCase()
            .includes(normalizedSearchQuery),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6)
    : [];
  useEffect(() => {
    if (!mobile) return;
    menuRef.current?.querySelector(".mobile-only")?.focus();
    const handle = (event) => {
      if (event.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [mobile]);
  useEffect(() => {
    if (isInternalPage) return;
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isInternalPage]);
  useEffect(() => {
    if (isInternalPage) setSearchOpen(false);
  }, [isInternalPage]);
  useEffect(() => {
    if (!searchOpen) return;
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [searchOpen]);
  const active = path.startsWith("/people") ? "/people" : path;
  const go = (p) => {
    navigate(p);
    setMobile(false);
  };
  const selectPerson = (person) => {
    setSearchQuery("");
    setSearchOpen(false);
    setActiveSearchIndex(-1);
    go(`/people/${person.id}`);
  };
  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
    if (event.key === "ArrowDown" && searchResults.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((index) =>
        index < searchResults.length - 1 ? index + 1 : 0,
      );
    }
    if (event.key === "ArrowUp" && searchResults.length) {
      event.preventDefault();
      setActiveSearchIndex((index) =>
        index > 0 ? index - 1 : searchResults.length - 1,
      );
    }
  };
  const submitSearch = (event) => {
    event.preventDefault();
    const selected = searchResults[activeSearchIndex] || searchResults[0];
    if (selected) selectPerson(selected);
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
          {isInternalPage && (
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <span>People</span>
              <span className="breadcrumb-separator">/</span>
              <span>{path.split("/")[2]}</span>
            </div>
          )}
          {!isInternalPage && (
            <form
              ref={searchRef}
              className={`topbar-search ${searchOpen ? "search-open" : ""}`}
              role="search"
              onSubmit={submitSearch}
            >
              <button
                className="topbar-search-trigger"
                type="button"
                aria-label="Open global search"
                aria-expanded={searchOpen}
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
              >
                <Search size={19} />
              </button>
              <div className="global-search-input">
                <Search size={18} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveSearchIndex(-1);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search people or record ID"
                  role="combobox"
                  aria-label="Global search"
                  aria-autocomplete="list"
                  aria-controls={searchOpen && normalizedSearchQuery ? "global-search-results" : undefined}
                  aria-expanded={searchOpen && Boolean(normalizedSearchQuery)}
                  aria-activedescendant={
                    activeSearchIndex >= 0
                      ? `global-search-option-${activeSearchIndex}`
                      : undefined
                  }
                />
                {searchQuery && (
                  <button
                    className="global-search-clear"
                    type="button"
                    aria-label="Clear global search"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveSearchIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {searchOpen && normalizedSearchQuery && (
                <div
                  id="global-search-results"
                  className="global-search-results"
                  role="listbox"
                  aria-label="Matching people"
                >
                  {searchResults.length ? (
                    searchResults.map((person, index) => (
                      <button
                        id={`global-search-option-${index}`}
                        key={person.id}
                        type="button"
                        role="option"
                        aria-selected={activeSearchIndex === index}
                        className={
                          activeSearchIndex === index ? "active" : undefined
                        }
                        onMouseEnter={() => setActiveSearchIndex(index)}
                        onClick={() => selectPerson(person)}
                      >
                        <span>{person.name}</span>
                        <small>{person.id}</small>
                      </button>
                    ))
                  ) : (
                    <p>No people match “{searchQuery.trim()}”.</p>
                  )}
                </div>
              )}
            </form>
          )}
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
        <main
          id="main"
          className={`main${isInternalPage ? " main-internal" : ""}`}
          tabIndex={-1}
        >
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
