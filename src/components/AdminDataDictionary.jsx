import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { INSTRUMENTS } from "../instruments";
import extractFields from "../epExtractCodebook.json";
import StandardTable from "./StandardTable";
import ListFilterBar from "./ListFilterBar";
import { ActiveFilters } from "./QueueControls";
import { QueueCell, QueueRow } from "./QueueRow";
import InstrumentPreview from "./InstrumentPreview";
import { ActionGroup, Badge, Button, EditAction, Field, Modal, ModalFooter, Panel, Select } from "./UI";

const PAGE_SIZE = 40;
const OVERRIDES_KEY = "yscc-data-dictionary-overrides-v1";
const ADDED_QUESTIONS_KEY = "yscc-data-dictionary-questions-v1";
const EXTRACT_TYPES = ["Coded response", "Date", "Number", "Text", "Derived", "Other format"];
const DERIVED_FIELD_NAMES = {
  age_at_episode_commencement: "Age at episode commencement",
  episode_program_stream: "Episode program stream",
  discharge_date: "Discharge date",
  age_at_oos: "Age at occasion of service",
};
const PROFILE_FIELDS = {
  clientGender: "client_gender",
  clientPostcode: "client_postcode",
  clientAtsiStatus: "client_atsi_status",
  clientLanguageHome: "client_language_home",
  clientSexuality: "client_sexuality",
  clientCountryOfBirth: "client_country_of_birth",
  clientEthnicity: "client_ethnicity",
  clientEducationLevel: "client_education_level",
  referralDate: "referral_date",
  source: "referral_source",
  commencementDate: "commencement_date",
  commencementDateUhr: "commencement_date_uhr",
  commencementDateFep: "commencement_date_fep",
  registeredCentreName: "centre",
  registeredCentreState: "centre_state",
  registeredCentrePostcode: "centre_postcode",
};

const extractByKey = new Map(extractFields.map(field => [`${field.batch}:${field.variable}`, field]));

export const dataDictionaryRows = INSTRUMENTS.flatMap(instrument => instrument.questions.map((question, index) => {
  const batch = instrument.codebookBatch || (instrument.clientProfileSection ? 1 : null);
  const variable = question.codebookVariable || (instrument.clientProfileSection ? PROFILE_FIELDS[question.id] : null);
  const field = batch && variable ? extractByKey.get(`${batch}:${variable}`) : null;
  return {
    key: `${instrument.version}:${question.id}:${index}`,
    question,
    instrument,
    field,
  };
}));

const linkedFields = new Set(dataDictionaryRows.filter(row => row.field).map(row => `${row.field.batch}:${row.field.variable}`));
const unlinkedDerivedFields = extractFields
  .filter(field => field.derived && !linkedFields.has(`${field.batch}:${field.variable}`))
  .filter((field, index, fields) => fields.findIndex(candidate =>
    candidate.variable === field.variable && candidate.dataItem === field.dataItem && candidate.format === field.format) === index);

function fieldType(field) {
  if (!field) return "Not mapped";
  if (EXTRACT_TYPES.includes(field.extractType)) return field.extractType;
  if (field.derived) return "Derived";
  if (/^date\b/i.test(field.format)) return "Date";
  if (/^(integer|decimal|number|numeric)\b/i.test(field.format)) return "Number";
  if (/(?:^|\n)[^\n]+\s*=\s*\d+/.test(field.format)) return "Coded response";
  return "Other format";
}

function readOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, field]) =>
      field && typeof field === "object" &&
      ["variable", "dataItem", "sourceQuestion", "format", "extractType"]
        .every(key => typeof field[key] === "string")));
  } catch {
    return {};
  }
}

function readAddedQuestions() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADDED_QUESTIONS_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(entry => entry && typeof entry === "object" &&
      ["key", "title", "id", "instrumentVersion", "sourceQuestion", "variable", "dataItem", "extractType", "format"]
        .every(key => typeof entry[key] === "string") &&
      INSTRUMENTS.some(instrument => instrument.version === entry.instrumentVersion));
  } catch {
    return [];
  }
}

function QuestionDraftEditor({ entry, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    title: entry?.title || "",
    id: entry?.id || "",
    instrumentVersion: entry?.instrumentVersion || "",
    sourceQuestion: entry?.sourceQuestion || "",
    variable: entry?.variable || "",
    dataItem: entry?.dataItem || "",
    extractType: entry?.extractType || "Coded response",
    format: entry?.format || "",
  }));
  const [error, setError] = useState("");
  const change = (name, value) => { setDraft(current => ({ ...current, [name]: value })); setError(""); };
  const submit = event => {
    event.preventDefault();
    const saveError = onSave(draft, entry?.key);
    if (saveError) setError(saveError);
  };
  return <Modal title={entry ? "Edit draft question" : "Add question"} subtitle="Data dictionary" onClose={onClose} wide className="data-dictionary-editor">
    <form onSubmit={submit}>
      <div className="form-body data-dictionary-editor-body">
        <p className="muted">This draft appears in the data dictionary and is linked to a measure. It does not change the published questionnaire.</p>
        <div className="form-grid">
          <Field label="Question"><input value={draft.title} onChange={event => change("title", event.target.value)} required /></Field>
          <Field label="Question ID"><input value={draft.id} onChange={event => change("id", event.target.value)} required /></Field>
          <Field label="Measure">
            <select value={draft.instrumentVersion} onChange={event => change("instrumentVersion", event.target.value)} required>
              <option value="">Select a measure</option>
              {INSTRUMENTS.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name} · {instrument.version}</option>)}
            </select>
          </Field>
          <Field label="hAPI question"><textarea value={draft.sourceQuestion} onChange={event => change("sourceQuestion", event.target.value)} rows={3} /></Field>
          <Field label="Variable name for extract"><input value={draft.variable} onChange={event => change("variable", event.target.value)} /></Field>
          <Field label="Data item"><input value={draft.dataItem} onChange={event => change("dataItem", event.target.value)} /></Field>
          <Field label="Extract type">
            <select value={draft.extractType} onChange={event => change("extractType", event.target.value)}>
              {EXTRACT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Format and/or coding of response in extract">
            <textarea value={draft.format} onChange={event => change("format", event.target.value)} rows={6} />
          </Field>
        </div>
      </div>
      <ModalFooter>
        {error && <p className="field-error form-save-error" role="alert">{error}</p>}
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">{entry ? "Save changes" : "Add question"}</Button>
      </ModalFooter>
    </form>
  </Modal>;
}

function DataDictionaryEditor({ row, edited, onClose, onSave, onRestore }) {
  const [draft, setDraft] = useState(() => ({
    variable: row.field?.variable || "",
    dataItem: row.field?.dataItem || "",
    sourceQuestion: row.field?.sourceQuestion || "",
    format: row.field?.format || "",
    extractType: fieldType(row.field) === "Not mapped" ? "Coded response" : fieldType(row.field),
  }));
  const [error, setError] = useState("");
  const change = (name, value) => { setDraft(current => ({ ...current, [name]: value })); setError(""); };
  const submit = event => {
    event.preventDefault();
    if (!draft.variable.trim() || !draft.dataItem.trim()) {
      setError("Enter a variable name and data item before saving.");
      return;
    }
    const saveError = onSave(row, draft);
    if (saveError) setError(saveError);
  };
  return <Modal title="Edit data dictionary entry" subtitle={row.instrument?.version || "Derived extract field"} onClose={onClose} wide className="data-dictionary-editor">
    <form onSubmit={submit}>
      <div className="form-body data-dictionary-editor-body">
        {row.question ? <>
          <p><strong>Question:</strong> {row.question.title}</p>
          <p><strong>Measure:</strong> {row.instrument.name}</p>
        </> : <p><strong>Derived field:</strong> {row.originalField.variable} · No measure question</p>}
        <p className="muted">Edit this extract entry. Changes are saved in this browser.</p>
        <div className="form-grid">
          <Field label="Variable name for extract">
            <input value={draft.variable} onChange={event => change("variable", event.target.value)} required />
          </Field>
          <Field label="Data item">
            <input value={draft.dataItem} onChange={event => change("dataItem", event.target.value)} required />
          </Field>
          <Field label="hAPI question">
            <textarea value={draft.sourceQuestion} onChange={event => change("sourceQuestion", event.target.value)} rows={3} />
          </Field>
          <Field label="Extract type">
            <select value={draft.extractType} onChange={event => change("extractType", event.target.value)}>
              {EXTRACT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Format and/or coding of response in extract">
            <textarea value={draft.format} onChange={event => change("format", event.target.value)} rows={6} />
          </Field>
        </div>
      </div>
      <ModalFooter>
        {error && <p className="field-error form-save-error" role="alert">{error}</p>}
        {edited && <Button type="button" variant="secondary" onClick={() => { const restoreError = onRestore(row.key); if (restoreError) setError(restoreError); }}>
          Restore original
        </Button>}
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">Save changes</Button>
      </ModalFooter>
    </form>
  </Modal>;
}

function Coding({ value }) {
  if (!value) return <span className="muted">Not mapped to EP extract</span>;
  if (value.length < 110) return <span className="data-dictionary-coding">{value}</span>;
  return <details className="data-dictionary-coding-detail">
    <summary>{value.split("\n")[0].slice(0, 82)}… View full coding</summary>
    <div className="data-dictionary-coding">{value}</div>
  </details>;
}

function HapiQuestion({ value }) {
  if (!value) return <span className="muted">—</span>;
  if (value.length < 110) return <span className="data-dictionary-coding">{value}</span>;
  return <details className="data-dictionary-coding-detail">
    <summary>{value.split("\n")[0].slice(0, 82)}… View full question</summary>
    <div className="data-dictionary-coding">{value}</div>
  </details>;
}

export default function AdminDataDictionary() {
  const [query, setQuery] = useState("");
  const [instrumentVersion, setInstrumentVersion] = useState("");
  const [mapping, setMapping] = useState("all");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [addedQuestions, setAddedQuestions] = useState(readAddedQuestions);
  const [overrides, setOverrides] = useState(readOverrides);
  const [savedMessage, setSavedMessage] = useState("");

  const rows = useMemo(() => dataDictionaryRows.map(row => ({
    ...row,
    field: overrides[row.key] ? { ...row.field, ...overrides[row.key] } : row.field,
  })), [overrides]);
  const derivedRows = useMemo(() => unlinkedDerivedFields.map(field => {
    const key = `derived:${field.batch}:${field.variable}`;
    return {
      key,
      originalField: field,
      field: overrides[key] ? { ...field, ...overrides[key] } : field,
    };
  }), [overrides]);
  const addedRows = useMemo(() => addedQuestions.map(entry => ({
    key: entry.key,
    customEntry: entry,
    question: { id: entry.id, title: entry.title },
    instrument: INSTRUMENTS.find(instrument => instrument.version === entry.instrumentVersion),
    field: entry.variable ? {
      variable: entry.variable,
      dataItem: entry.dataItem,
      sourceQuestion: entry.sourceQuestion,
      extractType: entry.extractType,
      format: entry.format,
      derived: entry.extractType === "Derived",
    } : null,
  })), [addedQuestions]);
  const allRows = useMemo(() => [...derivedRows, ...addedRows, ...rows], [derivedRows, addedRows, rows]);

  const persist = next => {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
      setOverrides(next);
      return "";
    } catch {
      return "Could not save in this browser. Free browser storage and try again.";
    }
  };
  const save = (row, draft) => {
    const result = persist({ ...overrides, [row.key]: {
      variable: draft.variable.trim(),
      dataItem: draft.dataItem.trim(),
      sourceQuestion: draft.sourceQuestion.trim(),
      format: draft.format.trim(),
      extractType: draft.extractType,
      derived: draft.extractType === "Derived",
    } });
    if (!result) { setEditing(null); setSavedMessage(`Saved extract details for ${row.question?.title || row.originalField.variable}.`); }
    return result;
  };
  const restore = key => {
    const next = { ...overrides };
    delete next[key];
    const result = persist(next);
    if (!result) { setEditing(null); setSavedMessage("Original extract details restored."); }
    return result;
  };
  const saveQuestion = (draft, key) => {
    const title = draft.title.trim();
    const id = draft.id.trim();
    const variable = draft.variable.trim();
    const dataItem = draft.dataItem.trim();
    if (!title || !id || !draft.instrumentVersion) return "Enter a question, question ID, and measure.";
    if (Boolean(variable) !== Boolean(dataItem)) return "Enter both a variable name and data item, or leave both blank.";
    if (dataDictionaryRows.some(row => row.instrument.version === draft.instrumentVersion && row.question.id === id) ||
      addedQuestions.some(entry => entry.key !== key && entry.instrumentVersion === draft.instrumentVersion && entry.id === id))
      return "This question ID is already used in the selected measure.";
    const nextEntry = {
      key: key || `draft:${crypto.randomUUID()}`,
      title,
      id,
      instrumentVersion: draft.instrumentVersion,
      sourceQuestion: draft.sourceQuestion.trim(),
      variable,
      dataItem,
      extractType: draft.extractType,
      format: draft.format.trim(),
    };
    const next = key
      ? addedQuestions.map(entry => entry.key === key ? nextEntry : entry)
      : [nextEntry, ...addedQuestions];
    try {
      localStorage.setItem(ADDED_QUESTIONS_KEY, JSON.stringify(next));
      setAddedQuestions(next);
      setAddingQuestion(false);
      setEditing(null);
      setSavedMessage(`${key ? "Updated" : "Added"} draft question ${title}.`);
      setQuery(id);
      setInstrumentVersion(draft.instrumentVersion);
      setMapping("all");
      setPage(1);
      return "";
    } catch {
      return "Could not save in this browser. Free browser storage and try again.";
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return allRows.filter(({ question, instrument, field, originalField, customEntry }) => {
      if (instrumentVersion && instrument?.version !== instrumentVersion) return false;
      if (mapping === "mapped" && !field) return false;
      if (mapping === "unmapped" && field) return false;
      if (mapping === "derived" && !field?.derived) return false;
      if (!term) return true;
      return [question?.title, question?.id, instrument?.name, instrument?.version,
        field?.dataItem, field?.variable, field?.sourceQuestion, field?.format,
        customEntry?.sourceQuestion, originalField?.variable]
        .some(value => String(value || "").toLocaleLowerCase().includes(term));
    });
  }, [allRows, query, instrumentVersion, mapping]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const mappedCount = [...rows, ...addedRows].filter(row => row.field).length;
  const calculatedCount = allRows.filter(row => row.field?.derived).length;
  const update = (setter, value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(""); setInstrumentVersion(""); setMapping("all"); setPage(1); };
  const mappingItems = [
    { value: "all", label: "All entries", count: allRows.length },
    { value: "mapped", label: "Linked to extract", count: allRows.filter(row => row.field).length },
    { value: "unmapped", label: "Not mapped", count: allRows.filter(row => !row.field).length },
    { value: "derived", label: "Derived", count: calculatedCount },
  ];
  const activeFilters = [
    ...(query ? [{ id: "search", label: `Search: ${query}`, onRemove: () => update(setQuery, "") }] : []),
    ...(instrumentVersion ? [{ id: "instrument", label: `Measure: ${INSTRUMENTS.find(instrument => instrument.version === instrumentVersion)?.name || instrumentVersion}`, onRemove: () => update(setInstrumentVersion, "") }] : []),
    ...(mapping !== "all" ? [{ id: "mapping", label: `Mapping: ${mappingItems.find(item => item.value === mapping)?.label}`, onRemove: () => update(setMapping, "all") }] : []),
  ];

  return <>
    <div className="stack administration-data-dictionary">
      <div className="section-toolbar administration-section-heading">
        <div>
          <h2>Data dictionary</h2>
          <p>Measure questions and calculated fields from the headspace EP 2025 data extract codebook.</p>
        </div>
        <ActionGroup className="button-row">
          <Button type="button" variant="primary" onClick={() => { setSavedMessage(""); setAddingQuestion(true); }}>
            <Plus size={18} aria-hidden="true" /> Add question
          </Button>
        </ActionGroup>
      </div>
      <Panel className="admin-panel">
        <p className="data-dictionary-summary">{rows.length + addedRows.length} questions across {INSTRUMENTS.length} measures · {mappedCount} linked to extract fields · {calculatedCount} calculated or derived fields</p>
        {savedMessage && <p className="form-save-success" role="status">{savedMessage}</p>}
        <ListFilterBar
          id="data-dictionary-mapping"
          label="Extract mapping"
          panelId="data-dictionary-results"
          className="data-dictionary-filter-bar"
          items={mappingItems}
          value={mapping}
          onChange={value => update(setMapping, value)}
          query={query}
          onQueryChange={value => update(setQuery, value)}
          placeholder="Search questions or extract fields"
          shown={filtered.length}
          total={allRows.length}
          noun={filtered.length === 1 ? "entry" : "entries"}
          activeAdvancedCount={Number(Boolean(instrumentVersion))}
          onClear={clearFilters}
          advanced={<Select label="Measure" value={instrumentVersion} onChange={event => update(setInstrumentVersion, event.target.value)}>
              <option value="">All measures</option>
              {INSTRUMENTS.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name} · {instrument.version}</option>)}
            </Select>}
        />
        <div id="data-dictionary-results" role="tabpanel" aria-labelledby={`data-dictionary-mapping-tab-${mappingItems.findIndex(item => item.value === mapping)}`}>
        <ActiveFilters items={activeFilters} onClear={clearFilters} />
        <p className="data-dictionary-table-hint">Scroll horizontally for the full extract coding.</p>
        <StandardTable label="Data dictionary questions" className="data-dictionary-table" responsive={false}>
          <thead><tr>
            <th scope="col">Item</th>
            <th scope="col">hAPI question</th>
            <th scope="col">Measure</th>
            <th scope="col">Variable name for extract</th>
            <th scope="col">Data item</th>
            <th scope="col">Extract type</th>
            <th scope="col">Format and/or coding of response in extract</th>
          </tr></thead>
          <tbody>
            {visible.map((row) => <QueueRow key={row.key}>
              <QueueCell label="Item" slot="subject" verbatim>
                <div className="data-dictionary-question-cell">
                  {row.question ? <><strong>{row.question.title}</strong><small>ID: {row.question.id}</small>{row.customEntry && <small>Draft dictionary question</small>}</>
                    : <><strong>{DERIVED_FIELD_NAMES[row.originalField.variable] || row.originalField.variable.replaceAll("_", " ")}</strong><small>ID: {row.originalField.variable}</small></>}
                  <EditAction aria-label={row.customEntry ? `Edit draft question ${row.question.title}` : row.question
                    ? `Edit data dictionary entry for ${row.question.title} in ${row.instrument.name}`
                    : `Edit derived extract field ${row.field.variable}`}
                    onClick={() => { setSavedMessage(""); setEditing(row); }}>Edit</EditAction>
                </div>
              </QueueCell>
              <QueueCell label="hAPI question" slot="summary" verbatim><HapiQuestion value={row.field?.sourceQuestion || row.customEntry?.sourceQuestion} /></QueueCell>
              <QueueCell label="Measure" slot="owner" verbatim>
                {row.customEntry ? <><strong>{row.instrument.name}</strong><small>{row.instrument.version} · Draft association</small></>
                : row.instrument ? <>
                  <button type="button" className="name-link" onClick={() => setPreview(row.instrument)} aria-label={`Preview ${row.instrument.name}`}>
                    {row.instrument.name}
                  </button>
                  <small>{row.instrument.version}</small>
                </> : <span className="muted">No measure question</span>}
              </QueueCell>
              <QueueCell label="Variable name for extract" slot="metric"><code>{row.field?.variable || "—"}</code></QueueCell>
              <QueueCell label="Data item" slot="summary">{row.field?.dataItem || "—"}</QueueCell>
              <QueueCell label="Extract type" slot="state"><Badge tone={row.field?.derived ? "amber" : "neutral"}>{fieldType(row.field)}</Badge></QueueCell>
              <QueueCell label="Format and/or coding of response in extract" slot="summary" verbatim><Coding value={row.field?.format} /></QueueCell>
            </QueueRow>)}
          </tbody>
        </StandardTable>
        {filtered.length === 0 && <p className="data-dictionary-empty">No questions or derived extract fields match these filters.</p>}
        {filtered.length > PAGE_SIZE && <div className="data-dictionary-pagination">
          <span>Page {currentPage} of {pageCount}</span>
          <Button type="button" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <Button type="button" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>}
        </div>
      </Panel>
    </div>
    {preview && <Modal title="Measure preview" subtitle={preview.version} className="questionnaire-preview-modal" closeLabel="Close preview" onClose={() => setPreview(null)}>
      <InstrumentPreview key={preview.version} instrument={preview} respondent={preview.respondents[0]} onBack={() => setPreview(null)} />
    </Modal>}
    {addingQuestion && <QuestionDraftEditor onClose={() => setAddingQuestion(false)} onSave={saveQuestion} />}
    {editing?.customEntry && <QuestionDraftEditor key={editing.key} entry={editing.customEntry} onClose={() => setEditing(null)} onSave={saveQuestion} />}
    {editing && !editing.customEntry && <DataDictionaryEditor key={editing.key} row={editing} edited={Boolean(overrides[editing.key])}
      onClose={() => setEditing(null)} onSave={save} onRestore={restore} />}
  </>;
}
