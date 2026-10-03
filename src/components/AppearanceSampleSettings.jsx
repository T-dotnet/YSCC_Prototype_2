import { ArrowRight, FileCheck2, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { UI_COLOR_SETUPS, uiColorSetup } from '../uiColorSetups';
import { ActionGroup, Panel, Button, RadioInput } from './UI';

export default function AppearanceSampleSettings({navigate,openModal}) {
  const {state,commit}=useStore();
  const selectedUiSetup=uiColorSetup(state.settings?.uiColorSetup);
  return (
      <div className="stack">
      <Panel title="Appearance" className="admin-panel appearance-panel">
        <p className="appearance-intro">Choose a UI color setup. Your choice applies immediately and is saved in this browser.</p>
        <fieldset className="appearance-options">
          <legend className="sr-only">UI color setup</legend>
          {UI_COLOR_SETUPS.map((setup) => (
            <label className="appearance-option" key={setup.id}>
              <span className="appearance-option-heading">
                <RadioInput
                  name="ui-color-setup"
                  value={setup.id}
                  checked={selectedUiSetup === setup.id}
                  onChange={() => commit({ type: "SET_UI_COLOR_SETUP", setup: setup.id })}
                />
                <strong>{setup.name}</strong>
                {selectedUiSetup === setup.id && <small>Selected</small>}
              </span>
              <span className="appearance-option-swatches" aria-hidden="true">
                {setup.swatches.map((token) => (
                  <i key={token} style={{ backgroundColor: `var(${token})` }} />
                ))}
              </span>
              <span className="appearance-option-description">{setup.description}</span>
            </label>
          ))}
        </fieldset>
      </Panel>
      <Panel title="Sample data" className="admin-panel">
        <div className="admin-row">
          <span className="admin-icon">
            <FileCheck2 size={24} />
          </span>
          <div>
            <h3>Supplied CSV sample</h3>
            <p>Review one imported client and its recorded evidence, separate from editable people.</p>
          </div>
          <Button onClick={() => navigate("/administration/sample/YSCC01-C0001")}>
            Open read-only preview
            <ArrowRight size={17} />
          </Button>
        </div>
      </Panel>
      <div className="reset-panel">
        <div>
          <h3>Start fresh with sample data</h3>
          <p>Reset the intake examples or restore the full sample workspace.</p>
        </div>
        <ActionGroup className="button-row">
          <Button onClick={() => openModal({ type: "reset-intake-examples" })}>
            <RotateCcw size={17} />
            Reset River and Samira
          </Button>
          <Button onClick={() => openModal({ type: "reset" })}>
            <RotateCcw size={17} />
            Reset sample workspace
          </Button>
        </ActionGroup>
      </div>
      </div>
  );
}
