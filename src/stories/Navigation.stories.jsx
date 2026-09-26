import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, CircleAlert, FileCheck2, Plus } from "lucide-react";
import ListFilterBar from "../components/ListFilterBar";
import RecordItem from "../components/RecordItem";
import CareEvents from "../features/CareEvents";
import { Button, FilterTabs, Pagination, RecordTabs, Select, TextLink } from "../components/UI";
import { createSeed, formatDate } from "../model";

const recordItems = ["Overview", "Assessment", { value: "Events", label: "Care events" }, "Report", { value: "Consent & respondents", label: "Consent" }];
const person = createSeed().people.find((item) => item.id === "YS-1024");
const consentRequests = person.consentRequests;
const consentItems = ["all", ...new Set(consentRequests.map((request) => request.status))].map((value) => ({
  value,
  label: value === "all" ? "All" : value,
  count: value === "all" ? consentRequests.length : consentRequests.filter((request) => request.status === value).length,
}));

function PersonStoryFrame({ active, onTabChange, tabsId = "story-record-tabs", children }) {
  const [localTab, setLocalTab] = useState(active);
  const selected = onTabChange ? active : localTab;
  return (
    <div className="main main-internal ds-person-main">
      <button className="back-link" type="button"><ArrowLeft size={17} aria-hidden="true" />Back to people</button>
      <div className="person-heading">
        <div>
          <div className="person-heading-title-row">
            <h1 className="person-name-heading"><span>{person.name}</span></h1>
            <div className="person-heading-tags" aria-label="Person tags">
              <span className="person-tag">Review requested</span>
              <button type="button" className="person-tag-add" aria-label="Add person tag"><Plus size={14} aria-hidden="true" /></button>
            </div>
          </div>
          <p className="person-heading-details"><small className="person-heading-role">Patient</small><span>·</span>{person.id}<span>·</span>17 years<span>·</span>{person.pronouns}<TextLink type="button">More info</TextLink></p>
        </div>
        <div className="actions"><Button>Care episode actions <ChevronDown size={16} aria-hidden="true" /></Button></div>
      </div>
      <button className="care-event-attention" type="button">
        <CircleAlert size={20} aria-hidden="true" />
        <span className="care-event-attention-summary"><strong>2 things need attention</strong><span>1 planned contact overdue · 1 assessment overdue</span></span>
        <span className="care-event-attention-action">View all <ArrowRight size={16} aria-hidden="true" /></span>
      </button>
      <div className="person-content-surface person-open-surface">
        <div className="person-record-navigation">
          <RecordTabs id={tabsId} label="Person record" items={recordItems} value={selected} onChange={onTabChange || setLocalTab} />
        </div>
        <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${recordItems.findIndex((item) => (typeof item === "string" ? item : item.value) === selected)}`}>
          {selected === active || onTabChange ? children : <h2>{selected === "Events" ? "Care events" : selected === "Consent & respondents" ? "Consent & respondents" : selected}</h2>}
        </div>
      </div>
    </div>
  );
}

export default {
  title: "03 Navigation/Filters and tabs",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shared Tabs component provides keyboard behaviour for record navigation and quick filters. ListFilterBar adds search, advanced filters, result count, and clear actions.",
      },
    },
  },
};

export const RecordNavigation = {
  parameters: { layout: "fullscreen" },
  render: () => {
    const [active, setActive] = useState("Assessment");
    return (
      <div className="ds-story ds-record-frame">
        <PersonStoryFrame active={active} onTabChange={setActive}>
          <h2>{active === "Events" ? "Care events" : active === "Consent & respondents" ? "Consent & respondents" : active}</h2>
        </PersonStoryFrame>
        <div className="ds-note">This uses the same tab values and page ancestors as the person record. On narrow screens the primary tabs scroll horizontally.</div>
      </div>
    );
  },
};

export const QuickFilters = {
  render: () => {
    const [active, setActive] = useState("All");
    return (
      <div className="ds-story">
        <h2>Quick filters</h2>
        <FilterTabs id="story-filter-tabs" label="Assessment status" items={["All", "Due", "Ready for review", "Completed"]} value={active} onChange={setActive} />
        <p id="story-filter-tabs-panel" className="ds-caption" style={{ marginTop: 20 }}>Showing: {active}</p>
      </div>
    );
  },
};

export const FilterToolbar = {
  parameters: { layout: "fullscreen" },
  render: () => {
    const [active, setActive] = useState("all");
    const [query, setQuery] = useState("");
    const [channel, setChannel] = useState("all");
    const visible = consentRequests.filter((request) =>
      (active === "all" || request.status === active) &&
      (channel === "all" || request.channel === channel) &&
      `${request.title} ${request.version} ${request.scope} ${request.status} ${request.channel}`
        .toLowerCase().includes(query.trim().toLowerCase()),
    );
    const clear = () => { setActive("all"); setQuery(""); setChannel("all"); };
    return (
      <div className="ds-story ds-record-frame">
        <PersonStoryFrame active="Consent & respondents" tabsId="story-consent-record-tabs">
        <div className="consent-board">
          <div className="section-toolbar consent-board-heading">
            <div><h2>Consent & respondents</h2><p>Review the current decision and who can contribute.</p></div>
            <Button variant="primary">Send consent request</Button>
          </div>
          <ListFilterBar
            id="story-consent-status"
            label="Consent request status"
            items={consentItems}
            value={active}
            onChange={setActive}
            query={query}
            onQueryChange={setQuery}
            placeholder="Search consent requests"
            shown={visible.length}
            total={consentRequests.length}
            noun="requests"
            activeAdvancedCount={Number(channel !== "all")}
            onClear={clear}
            advanced={
              <Select label="Delivery channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
                <option value="all">All channels</option>
                {[...new Set(consentRequests.map((request) => request.channel))].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            }
          />
          {visible.map((request) => (
            <RecordItem
              key={request.id}
              title={request.title}
              subtitle={`${request.version} · ${request.scope}`}
              status={request.status}
              collapsible
              lead={<><span className="record-item-lead-icon"><FileCheck2 size={22} aria-hidden="true" /></span><span><strong>{request.version}</strong></span></>}
              facts={[
                { label: "Scope", value: request.scope },
                { label: "Delivery", value: `${request.channel} · ${formatDate(request.sentAt)}` },
                { label: "Current decision", value: request.status },
                { label: "Decision maker", value: request.decisionMaker },
              ]}
              note="Open request history and the permitted next action."
              actions={<Button variant="secondary">View request</Button>}
            />
          ))}
          {!visible.length && <p>No consent requests match these filters.</p>}
        </div>
        </PersonStoryFrame>
      </div>
    );
  },
};

export const CareEventFilters = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="ds-story ds-record-frame">
      <PersonStoryFrame active="Events" tabsId="story-events-record-tabs">
        <CareEvents episode={person.episodes[0]} person={person} openModal={() => {}} />
      </PersonStoryFrame>
      <div className="ds-note">This renders the Care events feature itself, including its own quick filters and dated record timeline.</div>
    </div>
  ),
};

export const PageControls = {
  render: () => {
    const [page, setPage] = useState(1);
    return (
      <div className="ds-story">
        <h2>Pagination</h2>
        <Pagination page={page} pageCount={3} onPageChange={setPage} label="People" />
        <p className="ds-caption">Page {page} is selected.</p>
      </div>
    );
  },
};
