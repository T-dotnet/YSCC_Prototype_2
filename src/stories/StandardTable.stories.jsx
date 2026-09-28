import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import StandardTable from "../components/StandardTable";
import { QueueRow, QueueCell } from "../components/QueueRow";
import { SortableHeader, useQueueSort } from "../components/QueueControls";
import { AlertLabel, Button } from "../components/UI";
import AssessmentBundleDetails from "../components/AssessmentBundleDetails";
import { INSTRUMENTS } from "../instruments";
import People from "../features/People";

const bundles = [
  { id:"general", name:"General care review", due:"21 Sep 2026", dueKey:"2026-09-21", note:"7 days overdue", method:"Clinic tablet", respondent:"Patient", completed:7, total:13, overdue:true },
  { id:"youth", name:"Youth and family check-in", due:"5 Oct 2026", dueKey:"2026-10-05", note:"7 days away", method:"Clinic tablet", respondent:"Patient", completed:6, total:9 },
  { id:"start", name:"Getting started with care", due:"16 Jun 2026", dueKey:"2026-06-16", note:"Completed bundle", method:"Clinician entry", respondent:"Patient", completed:4, total:4 },
];

function BundleExample({ rows = bundles, withContacts = true, scheduleAssessments = true }) {
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState("");
  const { sort, toggleSort } = useQueueSort({key:"name",direction:"asc"});
  const sorted = [...rows].sort((a,b) => (sort.direction === "asc" ? 1 : -1) * String(a[sort.key]).localeCompare(String(b[sort.key])));
  return <div className="ds-story">
    <StandardTable label="Assessment bundle example" className="assessment-bundle-table">
      <thead><tr>
        <SortableHeader label="Bundle name" sortKey="name" sort={sort} onSort={toggleSort} />
        <SortableHeader label="Due date" sortKey="dueKey" sort={sort} onSort={toggleSort} />
        <th scope="col">Collection method</th><th scope="col">Respondent</th><th scope="col">Completion</th><th scope="col">Actions</th>
      </tr></thead>
      <tbody>{sorted.map(row => <QueueRow key={row.id} onClick={event => {if (!event.target.closest('button, a')) setDetails(row);}}>
        <QueueCell label="Bundle name" slot="subject"><button type="button" className="name-link assessment-bundle-table-name"
          aria-label={`View details for ${row.name}`} aria-haspopup="dialog" onClick={() => setDetails(row)}>{row.name}</button></QueueCell>
        <QueueCell label="Due date" slot="summary"><time dateTime={row.dueKey}>{row.due}</time><small>{row.note}</small>{row.overdue && <AlertLabel tone="danger">Past due</AlertLabel>}</QueueCell>
        <QueueCell label="Collection method" slot="method">{row.method}</QueueCell>
        <QueueCell label="Respondent" slot="respondent">{row.respondent}</QueueCell>
        <QueueCell label="Completion" slot="metric"><div className="people-completeness-summary">
          <strong>{row.completed} / {row.total}</strong>
          <span className={`people-completeness-bar${row.completed === row.total ? ' complete-100' : ''}`} role="progressbar"
            aria-label={`${row.name} completion`} aria-valuemin={0} aria-valuemax={row.total} aria-valuenow={row.completed}>
            <span style={{width:`${row.completed / row.total * 100}%`}} />
          </span>
        </div></QueueCell>
        <QueueCell label="Actions" slot="action"><div className="assessment-bundle-table-actions">
          <Button disabled={row.completed === row.total} aria-label={`Collect response for ${row.name}`} onClick={() => setMessage(`Collect response selected for ${row.name}.`)}>Collect response</Button>
        </div></QueueCell>
      </QueueRow>)}{!rows.length && <tr><td colSpan={6}>No bundles match these filters.</td></tr>}</tbody>
    </StandardTable>
    {message && <p role="status">{message}</p>}
    {details && <AssessmentBundleDetails
      group={{key:details.id,name:details.name,records:Array.from({length:details.total},(_,index) => ({
        id:`${details.id}-${index}`,label:`${INSTRUMENTS[index % INSTRUMENTS.length].name} · Review ${index + 1}`,
        version:INSTRUMENTS[index % INSTRUMENTS.length].version,bundleRequirement:index < 2 ? 'Mandatory' : 'Optional',
        due:details.dueKey,response:index < details.completed ? 'Submitted' : 'Not started',
      }))}}
      scheduleAssessments={scheduleAssessments}
      delivery={{channel:details.method,recipient:details.respondent}} showDueDates
      statusFor={record => record.response === 'Submitted' ? 'Completed' : 'Not started'}
      onClose={() => setDetails(null)}
      episode={withContacts ? {
        collections:[{id:`${details.id}-0`},{id:`${details.id}-1`}],
        appointments:[{id:'story-contact',contactType:'Care review',practitionerService:'Jess Taylor · Northside Centre',actualDate:'2026-09-21',attendance:'Attended'}, {id:'story-planned-contact',contactType:'Planned follow-up',plannedDate:'2026-10-05',attendance:'Planned'}],
        assessmentContactLinks:[{collectionId:`${details.id}-0`,appointmentId:'story-planned-contact'},{collectionId:`${details.id}-0`,appointmentId:'story-contact'},{collectionId:`${details.id}-1`,appointmentId:'story-contact'}],
      } : {collections:[],appointments:[]}}
    />}
  </div>;
}

export default {
  title:"04 Records/Standard table",
  component:StandardTable,
  tags:["autodocs"],
  parameters:{docs:{description:{component:
    "People is the visual reference for StandardTable: uppercase 12px headers, 12px cell padding, 15px values, 64px minimum row height, subtle dividers, and inline completion bars. Use semantic table headers plus QueueRow and QueueCell. People and the Assessment ledger adapt to labelled rows below 860px of available table width. Click a ledger row to open details, or use its named bundle button with the keyboard. Collect response works independently. Story actions only change temporary story state."
  }}},
  argTypes:{children:{table:{disable:true}},className:{table:{disable:true}},scrollClassName:{table:{disable:true}}},
};

export const PeopleReference = {
  render:() => <div className="ds-story"><People navigate={() => {}} openModal={() => {}} /></div>,
  parameters:{docs:{description:{story:"The production People page, rendered with isolated fictional Storybook data. Sorting, filtering and pagination use the production components. Navigation and create/import callbacks are disabled in this reference."}}},
};
export const AssessmentBundles = {
  render:() => <BundleExample />,
  play:async ({canvasElement}) => {
    const canvas=within(canvasElement);
    const nameButton=canvas.getByRole("button",{name:"View details for General care review"});
    await userEvent.click(nameButton.closest('tr').querySelector('[data-slot="summary"]'));
    let dialog=within(canvas.getByRole("dialog"));
    await expect(dialog.getByText("7 / 13 assessments completed")).toBeVisible();
    await expect(dialog.getByRole('tab',{name:'Assessments',exact:true})).toHaveAttribute('aria-selected','true');
    await userEvent.click(dialog.getByRole('tab',{name:'Contacts',exact:true}));
    const contacts=within(dialog.getByRole('table',{name:'Contacts associated with General care review'}));
    await expect(contacts.getByText('Care review',{exact:true})).toBeInTheDocument();
    await expect(contacts.getAllByRole('row')).toHaveLength(3);
    await expect(dialog.queryByRole('button',{name:/View responses for/})).not.toBeInTheDocument();
    await expect(dialog.queryByRole('button',{name:/Collect response for/})).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button",{name:"Close",exact:true}));
    nameButton.focus();
    await userEvent.keyboard('{Enter}');
    dialog=within(canvas.getByRole("dialog"));
    await expect(dialog.getByText("7 / 13 assessments completed")).toBeVisible();
    await userEvent.click(dialog.getByRole("button",{name:"Close",exact:true}));
    await userEvent.click(canvas.getByRole("button",{name:"Collect response for General care review"}));
    await expect(canvas.getByRole("status")).toHaveTextContent("Collect response selected for General care review.");
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button",{name:"Collect response for Getting started with care"})).toBeDisabled();
  },
};
export const LongContent = {
  render:() => <BundleExample rows={[{...bundles[0],name:"General care review with additional assessments for the current care episode",respondent:"Family respondent",method:"Clinician entry"},...bundles.slice(1)]} />,
};
export const Empty = {render:() => <BundleExample rows={[]} />};
export const WithoutAssociatedContacts = {
  render:() => <BundleExample withContacts={false} />,
  play:async ({canvasElement}) => {
    const canvas=within(canvasElement);
    await userEvent.click(canvas.getByRole('button',{name:'View details for Getting started with care'}));
    const dialog=within(canvas.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('tab',{name:'Contacts',exact:true}));
    await expect(dialog.getByText('No contacts associated with these assessments.')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button',{name:'Close',exact:true}));
  },
};
export const NarrowAssessmentTable = {
  render:() => <div style={{maxWidth:390}}><BundleExample /></div>,
  parameters:{docs:{description:{story:"At 390px the ledger follows People’s labelled-row pattern. Tap a row or its bundle name to open details. Collect response remains visible and works independently, without horizontal scrolling."}}},
};

export const SchedulingOff = {
  render:() => <BundleExample scheduleAssessments={false} />,
  play:async ({canvasElement}) => {
    const canvas=within(canvasElement);
    await userEvent.click(canvas.getByRole('button',{name:'View details for General care review'}));
    const dialog=within(canvas.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('tab',{name:'Contacts',exact:true}));
    await userEvent.click(dialog.getByRole('tab',{name:'Contacts',exact:true}));
    await expect(dialog.getByRole('cell',{name:'Attended',exact:true})).toBeInTheDocument();
    await expect(dialog.queryByText('Planned follow-up')).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button',{name:'Close',exact:true}));
  },
};


export const CompactRecords = {
  render: () => <StandardTable label="Related contact example" responsive={false} density="compact">
    <thead><tr><th scope="col">Date</th><th scope="col">Contact</th><th scope="col">Status</th></tr></thead>
    <tbody><tr><td>12 Sep 2026</td><td>Follow-up contact</td><td>Attended</td></tr></tbody>
  </StandardTable>,
};

export const Comparison = {
  render: () => <StandardTable label="Outcome comparison example" responsive={false} variant="comparison">
    <thead><tr><th scope="col">Assessment date</th><th scope="col">K10+</th><th scope="col">K5</th></tr></thead>
    <tbody><tr><th scope="row">8 Sep 2026</th><td>27</td><td>18</td></tr></tbody>
  </StandardTable>,
};
