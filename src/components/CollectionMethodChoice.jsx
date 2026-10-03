import { LABELS, COLLECTION_METHOD_OPTIONS, collectionMethodLabel } from "../terminology.js";
import { currentStaff } from "../model";
import { useStore } from "../store";
import { RadioCard } from "./UI";

export default function CollectionMethodChoice({ method, onChange, headingLevel = "h4" }) {
  const { state } = useStore();
  const Heading = headingLevel;
  const selectable = !method || ["Clinic tablet", "Clinician entry"].includes(method);

  return (
    <section className="questionnaire-confirmation-panel collection-method-choice" aria-labelledby="collection-method-heading">
      <Heading id="collection-method-heading">Confirm {LABELS.collectionMethod.toLowerCase()}</Heading>
      <p>{selectable ? "Select how these answers were completed." : `These answers were collected through ${collectionMethodLabel(method)}.`}</p>
      {selectable && <div className="collection-method-cards" role="radiogroup" aria-labelledby="collection-method-heading">
        {COLLECTION_METHOD_OPTIONS.filter(([value]) => value !== "SMS link").map(([value]) => (
          <RadioCard className="collection-method-card" selected={method === value} key={value}
            name="completionMethod" value={value} checked={method === value}
            onChange={() => onChange(value)}
            disabled={value === "Clinician entry" && currentStaff(state)?.role !== "Clinician"} required>
            <span><strong>{collectionMethodLabel(value)}</strong><small>{value === "Clinician entry" ? "Answers entered by the clinician" : "Answers entered on a clinic device"}</small></span>
          </RadioCard>
        ))}
      </div>}
    </section>
  );
}
