import { useEffect, useRef, useState } from "react";
import { Button, ValidatedForm } from "./UI";
import TabletAssistanceChoice from "./TabletAssistanceChoice";

export default function TabletAssistanceConfirmation({ error, onBack, onConfirm }) {
  const [assistance, setAssistance] = useState("");
  const headingRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <ValidatedForm onSubmit={(event) => { event.preventDefault(); onConfirm({ assistance }); }}>
      <section className="questionnaire-appointment-confirmation" aria-labelledby="tablet-completion-heading">
        <h1 id="tablet-completion-heading" tabIndex={-1} ref={headingRef}>Complete assessment</h1>
        <p>The answers are ready. Confirm whether the person completed them independently or with assistance before saving the response.</p>
        <TabletAssistanceChoice assistance={assistance} onChange={setAssistance} headingLevel="h2" />
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="question-controls">
          <Button type="button" onClick={onBack}>Back to answer review</Button>
          <Button type="submit" variant="primary">Complete assessment</Button>
        </div>
      </section>
    </ValidatedForm>
  );
}
