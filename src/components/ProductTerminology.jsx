import { TERMINOLOGY } from "../terminology.js";
import { Panel } from "./UI";

export default function ProductTerminology() {
  return (
    <section id="product-terminology" aria-label="Product terminology">
      <Panel title="Product terminology">
        <div className="panel-body">
          <p>Use these terms throughout the workspace. {TERMINOLOGY.collectionMethod.label} describes instrument answers, {TERMINOLOGY.contactMethod.label} describes a service contact, and {TERMINOLOGY.deliveryMethod.label} describes a consent request.</p>
          <dl className="metadata product-terminology-list">
            {Object.entries(TERMINOLOGY).map(([key, term]) => (
              <div key={key}>
                <dt>{term.label}</dt>
                <dd>
                  {term.definition}
                  {term.options && <p>{term.options.map(([, label]) => label).join(" · ")}</p>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>
    </section>
  );
}
