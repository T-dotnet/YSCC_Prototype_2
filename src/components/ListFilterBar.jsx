import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { FilterTabs, SearchInput } from "./UI";

export default function ListFilterBar({
  id,
  label,
  panelId = null,
  items,
  value,
  onChange,
  query,
  onQueryChange,
  placeholder,
  shown,
  total,
  noun = "records",
  advanced,
  activeAdvancedCount = 0,
  onClear,
  resultAction,
  className = "",
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`care-event-filter-bar list-filter-bar ${className}`.trim()}>
      <FilterTabs
        id={id}
        label={label}
        panelId={panelId}
        className="care-event-quick-filters"
        value={value}
        onChange={onChange}
        items={items}
      />
      <div className="care-event-search-row">
        <SearchInput value={query} onChange={onQueryChange} placeholder={placeholder} />
        <button
          type="button"
          className={`care-event-more-filters${activeAdvancedCount ? " has-active-filters" : ""}`}
          aria-expanded={open}
          aria-controls={`${id}-advanced-filters`}
          onClick={() => setOpen((current) => !current)}
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span className="care-event-more-label">More filters</span>
          <span className="care-event-more-label-short">Filters</span>
          {activeAdvancedCount > 0 && <span className="care-event-more-count">{activeAdvancedCount}</span>}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div id={`${id}-advanced-filters`} className="care-event-advanced-filters" hidden={!open}>
        {advanced}
      </div>
      <p className="care-event-results-count" aria-live="polite">
        <span>Showing {shown} of {total} {noun}</span>
        {shown !== total && onClear && (
          <button type="button" className="filter-count-clear" onClick={onClear}>Clear filters</button>
        )}
        {resultAction && <span className="filter-result-action">{resultAction}</span>}
      </p>
    </div>
  );
}
