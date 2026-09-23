import { useMemo } from "react";
import { globalChangeLogEntries } from "../activity";
import { ChangeLog } from "../components/ActivityTimeline";
import { PageHeading } from "../components/UI";
import { useStore } from "../store";

export default function GlobalChangeLog({ navigate }) {
  const { state } = useStore();
  const entries = useMemo(() => globalChangeLogEntries(state), [state]);

  return (
    <div className="stack">
      <PageHeading
        title="Change log"
        subtitle="Field-level changes across people and care periods. Open a change to see its before and after values."
      />
      <ChangeLog entries={entries} navigate={navigate} />
    </div>
  );
}
