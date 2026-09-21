import CareTimelineEntryForm from "./CareTimelineEntryForm";

export default function ClinicalRecordForm(props) {
  return <CareTimelineEntryForm {...props} initialType="outcome" />;
}
