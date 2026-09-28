import StandardTable from './StandardTable';

/** Related records share the table shell; compact dialogs can wrap their values. */
export default function RelatedRecordsTable({ label, children, compact = false }) {
  return <StandardTable label={label} responsive={false} density="compact"
    className={`related-records-native-table${compact ? ' related-records-compact-table' : ''}`}
    scrollClassName="related-records-table-scroll">
    {children}
  </StandardTable>;
}
