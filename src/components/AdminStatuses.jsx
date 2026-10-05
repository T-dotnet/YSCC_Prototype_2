import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import StandardTable from './StandardTable';
import ListFilterBar from './ListFilterBar';
import { ActiveFilters } from './QueueControls';
import { Badge, Empty, Select } from './UI';
import { ASSESSMENT_BUNDLE_STATUS_LABELS } from '../assessmentBundleStatus';
import { APPOINTMENT_ATTENDANCE } from '../appointments';
import { EPISODE_DISPLAY_STATUSES } from '../batch1Registration.js';
import { QUALITY_STATUSES } from '../dataQuality';
import { mvpAssessmentMode } from '../mvpAssessmentPathway';
import TimelineExpandAll from './TimelineExpandAll';

const rows = [
  ...Object.entries(ASSESSMENT_BUNDLE_STATUS_LABELS).map(([key, status]) => ({
    item: 'Assessment Pack', status, sourceFile: 'assessmentBundleStatus.js',
    meaning: {
      'not-required': 'All measures were marked not required.',
      completed: 'All required measures are complete, including any required outcome.',
      overdue: 'A pending measure is past its due date.',
      'due-soon': 'A pending measure is due within seven days.',
      'in-progress': 'A response has started or some measures are complete.',
      'record-outcome': 'Responses are complete and the configured outcome still needs recording.',
      new: 'The system created the pack and collection has not started.',
      'not-started': 'A manually added pack has not started.',
    }[key],
  })),
  ...EPISODE_DISPLAY_STATUSES.map(status => ({ item: 'Care episode', status, meaning: {
    Profiling: 'The Client profile is being collected.',
    Assessment: 'Profiling is complete and the initial assessment is underway.',
    'Ongoing review': 'The initial assessment and required outcome have been recorded.',
    'Not proceed': 'The assessment outcome records that care will not proceed.',
    Discharged: 'The care episode was closed with a discharged disposition.',
    Paused: 'The care episode is temporarily paused.',
    Closed: 'The care episode is closed without a discharged disposition.',
    Completed: 'Closure measures and care experience feedback are complete.',
  }[status], sourceFile: 'batch1Registration.js' })),
  ...[
    ...APPOINTMENT_ATTENDANCE.map(status => [status, {
      Planned: 'The contact is scheduled and attendance has not been recorded.',
      Attended: 'The contact took place.',
      Cancelled: 'The planned contact was cancelled.',
      'Did not attend': 'The person did not attend the planned contact.',
    }[status]]),
    ['Today', 'The planned contact is due today and attendance has not been recorded.'],
    ['Overdue', 'A planned contact date has passed without an attendance outcome.'],
  ].map(([status, meaning]) => ({ item: 'Contact', status, meaning, sourceFile: 'appointments.js' })),
  ...[
    ['Needs planning', 'A collection is assigned without a due date.'],
    ['Scheduled', 'The collection has a future due date.'],
    ['Due today', 'The collection is due today.'],
    ['Overdue', 'The collection is past due and has not been submitted.'],
    ['Ready for review', 'A submitted response needs clinical review.'],
    ['Reviewed', 'Clinical review has been recorded.'],
    ['Completed', 'The response is complete and needs no further review.'],
    ['Paused', 'The collection is paused with its care episode.'],
    ['Cancelled', 'The collection was cancelled.'],
  ].map(([status, meaning]) => ({ item: 'Measure collection', status, meaning, sourceFile: 'model.js' })),
  ...QUALITY_STATUSES.map(status => ({ item: 'Data quality issue', status, sourceFile: 'dataQuality.js', meaning: {
    Open: 'The issue needs investigation.',
    'In Progress': 'Someone is working on the issue.',
    'Awaiting Information': 'More information is needed to resolve it.',
    Resolved: 'The underlying issue has been corrected.',
    Closed: 'The issue workflow is closed.',
  }[status] })),
];
const groups = [...new Set(rows.map(row => row.item))].map(item => ({
  item, rows: rows.filter(row => row.item === item),
}));

export default function AdminStatuses({ settings }) {
  const groupsRef = useRef(null);
  const [query, setQuery] = useState('');
  const [item, setItem] = useState('All items');
  const availableGroups = mvpAssessmentMode(settings) ? groups.filter(group => group.item !== 'Measure collection') : groups;
  const search = query.trim().toLowerCase();
  const visible = availableGroups.filter(group => item === 'All items' || group.item === item).map(group => ({
    ...group,
    visibleRows: !search || group.item.toLowerCase().includes(search) ? group.rows :
      group.rows.filter(row => `${row.status} ${row.meaning} ${row.sourceFile}`.toLowerCase().includes(search)),
  })).filter(group => group.visibleRows.length);
  const clearFilters = () => { setQuery(''); setItem('All items'); };

  return <div className="stack administration-statuses">
    <div className="section-toolbar administration-section-heading">
      <div>
        <h2>Statuses</h2>
        <p>Reference for the statuses shown across records and work queues. Source files define or derive these labels; they do not store client records.</p>
      </div>
    </div>
    <ListFilterBar id="admin-status-filters" label="Item type" className="administration-filter-bar"
      hideTabs query={query} onQueryChange={setQuery} placeholder="Search items, statuses or files"
      shown={visible.length} total={availableGroups.length} noun="item types" onClear={clearFilters}
      resultAction={<TimelineExpandAll containerRef={groupsRef} containerId="administration-status-groups"
        itemCount={visible.length} detailsSelector="details.administration-status-group" />}
      activeAdvancedCount={Number(item !== 'All items')}
      activeFilters={[
        ...(query ? [{ id: 'search', label: `Search: ${query}`, onRemove: () => setQuery('') }] : []),
        ...(item !== 'All items' ? [{ id: 'item', label: `Item: ${item}`, onRemove: () => setItem('All items') }] : []),
      ]}
      advanced={<Select label="Item type" value={item} onChange={event => setItem(event.target.value)}>
        <option value="All items">All items</option>
        {availableGroups.map(group => <option key={group.item} value={group.item}>{group.item}</option>)}
      </Select>} />
    <ActiveFilters items={[
      ...(query ? [{ id: 'search', label: `Search: ${query}`, onRemove: () => setQuery('') }] : []),
      ...(item !== 'All items' ? [{ id: 'item', label: `Item: ${item}`, onRemove: () => setItem('All items') }] : []),
    ]} onClear={clearFilters} />
    {visible.length ? <div id="administration-status-groups" ref={groupsRef} className="administration-status-groups">
      {visible.map(group => <details key={`${group.item}-${item}-${query}`} className="collection-details-accordion administration-status-group"
        open={Boolean(search) || item !== 'All items' ? true : undefined}>
        <summary>
          <span>{group.item}</span>
          <small className="muted">{group.visibleRows.length} of {group.rows.length} statuses</small>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="collection-details-accordion-body">
          <StandardTable label={`${group.item} statuses`} responsive={false}>
            <thead><tr><th scope="col">Status</th><th scope="col">Meaning and source file</th></tr></thead>
            <tbody>{group.visibleRows.map(row => <tr key={row.status}>
              <td><Badge>{row.status}</Badge></td>
              <td>{row.meaning}<small className="administration-status-source">Source file: <code>{row.sourceFile}</code></small></td>
            </tr>)}</tbody>
          </StandardTable>
        </div>
      </details>)}
    </div> : <Empty title="No item types match these filters">Try another search or item type.</Empty>}
  </div>;
}
