import { currentStaff } from "../model";
import { useStore } from "../store";

export default function CollectionMethodChoice({ method, onChange, headingLevel = "h4" }) {
  const { state } = useStore();
  const Heading = headingLevel;
  const selectable = ["Clinic tablet", "Clinician entry"].includes(method);

  return (
    <section className="questionnaire-confirmation-panel" aria-labelledby="collection-method-heading">
      <Heading id="collection-method-heading">Confirm collection method</Heading>
      <p>{selectable ? "Select how these answers were completed." : `These answers were collected through ${method}.`}</p>
      {selectable && <div className="collection-method-cards" role="radiogroup" aria-labelledby="collection-method-heading">
        {[
          ["Clinic tablet", "Tablet", "Answers entered on a clinic device"],
          ["Clinician entry", "Clinician", "Answers entered by the clinician"],
        ].map(([value, label, description]) => (
          <label className={`collection-method-card ${method === value ? "selected" : ""}`} key={value}>
            <input type="radio" name="completionMethod" value={value} checked={method === value}
              onChange={() => onChange(value)}
              disabled={value === "Clinician entry" && currentStaff(state)?.role !== "Clinician"} required />
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>
        ))}
      </div>}
    </section>
  );
}
