export default function TabletAssistanceChoice({ assistance, onChange, headingLevel = "h4" }) {
  const Heading = headingLevel;

  return (
    <section className="questionnaire-confirmation-panel" aria-labelledby="tablet-assistance-heading">
      <Heading id="tablet-assistance-heading">Confirm tablet assistance</Heading>
      <p>How were these answers completed on the tablet?</p>
      <div className="collection-method-cards" role="radiogroup" aria-labelledby="tablet-assistance-heading">
        {[
          ["Independent", "Independent", "The person entered their answers without help"],
          ["Supported", "Assisted", "Someone helped the person complete their answers"],
        ].map(([value, label, description]) => (
          <label className={`collection-method-card ${assistance === value ? "selected" : ""}`} key={value}>
            <input type="radio" name="tabletAssistance" value={value} checked={assistance === value}
              onChange={() => onChange(value)} required={value === "Independent"} />
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>
        ))}
      </div>
    </section>
  );
}
