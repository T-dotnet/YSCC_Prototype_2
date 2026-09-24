import { useMemo } from "react";
import { globalChangeLogEntries } from "../activity";
import { ChangeLog } from "../components/ActivityTimeline";
import { PageHeading, Panel } from "../components/UI";
import { useStore } from "../store";

export default function GlobalChangeLog({ navigate }) {
  const { state } = useStore();
  const entries = useMemo(() => globalChangeLogEntries(state), [state]);

  return (
    <>
      <PageHeading
        title="Change log"
        subtitle="Field-level changes across people and care periods. Open a change to see its before and after values."
      />
      <Panel
        className="global-change-log-panel"
        title="Changes at Northside Centre"
        action={<span className="muted">{entries.length} changes</span>}
      >
        <ChangeLog entries={entries} navigate={navigate} />
      </Panel>
    </>
  );
}
