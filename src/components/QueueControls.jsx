import { useState } from "react";
import { X } from "lucide-react";

export function useQueueSort(initialSort) {
  const [sort, setSort] = useState(initialSort);
  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };
  return { sort, toggleSort };
}

export function SortableHeader({ label, sortKey, sort, onSort, className = "" }) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`sortable ${className}`.trim()}
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button type="button" className="sort-header-button" onClick={() => onSort(sortKey)}>
        {label}
        <span className={`sort-indicator ${active ? "active" : ""}`} aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function ActiveFilters({ items, onClear }) {
  if (!items.length) return null;
  return (
    <div className="active-filters-row">
      <div className="active-filters-list">
        {items.map(({ id, label, onRemove }) => (
          <button
            key={id}
            type="button"
            className="filter-chip"
            onClick={onRemove}
            aria-label={`Remove ${label} filter`}
          >
            <span>{label}</span>
            <X size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="text-button-small" onClick={onClear}>
        Clear all
      </button>
    </div>
  );
}
