import CareTimelineEntryForm from "./CareTimelineEntryForm";

export default function CareEventForm(props) {
  return <CareTimelineEntryForm {...props} initialType="care-transition" />;
}
