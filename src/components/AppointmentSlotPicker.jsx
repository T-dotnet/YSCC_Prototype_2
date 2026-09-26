import { useState } from "react";
import { addDays, assessmentSlots, availableExternalSlots } from "../externalAppointmentSlots";
import { formatDate, TODAY } from "../model";

export default function AppointmentSlotPicker({ mode, dueDate, selectedSlot, onSelect, required = false, scrollTargetRef }) {
  const [range, setRange] = useState("7");
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(addDays(TODAY, 6));
  const [timeOfDay, setTimeOfDay] = useState("all");
  const [showEarlierDates, setShowEarlierDates] = useState(false);
  const assessment = mode === "assessment";
  const start = range === "custom" ? from : TODAY;
  const end = assessment ? dueDate : range === "custom" ? to : addDays(TODAY, Number(range) - 1);
  const slots = (assessment ? assessmentSlots(dueDate, TODAY) : availableExternalSlots(start, end))
    .filter((slot) => timeOfDay === "all" ||
      (timeOfDay === "morning" ? slot.time < "12:00" : slot.time >= "12:00"))
    .sort((a, b) => assessment
      ? b.date.localeCompare(a.date) || a.time.localeCompare(b.time)
      : a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const groups = slots.reduce((dates, slot) => {
    (dates[slot.date] ??= []).push(slot);
    return dates;
  }, {});
  const shownDates = assessment && !showEarlierDates
    ? Object.entries(groups).slice(0, 3)
    : Object.entries(groups);

  return <section ref={scrollTargetRef} className={`appointment-slot-picker${assessment ? " assessment-mode" : ""}`} aria-label="Available external contacts">
    <div className="appointment-slot-heading">
      <strong>Available contacts</strong>
      <small>{`Sample availability from an external scheduling system. YSSC records the link only${assessment && !required ? "; selection is optional" : ""}.`}</small>
    </div>
    {assessment ? <p className="appointment-slot-hint">Showing available sessions on or before {dueDate ? formatDate(dueDate) : "the due date"}, closest first.</p> : <>
      <fieldset className="appointment-slot-ranges">
        <legend>When?</legend>
        {[["7", "Next 7 days"], ["14", "Next 14 days"], ["custom", "Choose dates"]].map(([value, label]) =>
          <label key={value}><input type="radio" name="slotRange" checked={range === value} onChange={() => { setRange(value); onSelect(null); }} />{label}</label>)}
      </fieldset>
      {range === "custom" && <div className="appointment-slot-dates">
        <label>From <input type="date" value={from} min={TODAY} onChange={(event) => { setFrom(event.target.value); onSelect(null); }} /></label>
        <label>To <input type="date" value={to} min={from || TODAY} onChange={(event) => { setTo(event.target.value); onSelect(null); }} /></label>
      </div>}
      <label className="appointment-slot-filter">Time of day <select value={timeOfDay} onChange={(event) => { setTimeOfDay(event.target.value); onSelect(null); }}>
        <option value="all">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option>
      </select></label>
    </>}
    {selectedSlot && !slots.some((slot) => slot.id === selectedSlot.id) &&
      <p className="appointment-slot-hint">The previous selection is outside this range. Choose another slot.</p>}
    {selectedSlot && <p className="appointment-slot-selected">
      <strong>Selected:</strong> {formatDate(selectedSlot.date)} at {selectedSlot.time} · {selectedSlot.practitionerService}
      <button type="button" className="appointment-slot-clear" onClick={() => onSelect(null)}>Remove</button>
    </p>}
    {slots.length ? <div className="appointment-slot-results">
      {shownDates.map(([date, daySlots]) => <div className="appointment-slot-day" key={date}>
        <h4>{formatDate(date)}</h4>
        <div className="appointment-slot-times">{daySlots.map((slot) => <button type="button" key={slot.id}
          className={selectedSlot?.id === slot.id ? "selected" : ""}
          aria-pressed={selectedSlot?.id === slot.id}
          onClick={() => onSelect(slot)}>
          <strong>{slot.time}</strong><span>{slot.practitionerService} · {slot.deliveryMode} · {slot.durationMinutes} min</span>
        </button>)}</div>
      </div>)}
      {assessment && Object.keys(groups).length > 3 && <button type="button" className="appointment-slot-clear"
        onClick={() => setShowEarlierDates((value) => !value)}>
        {showEarlierDates ? "Show closest dates only" : "Show earlier available dates"}
      </button>}
    </div> : <p className="appointment-slot-empty">No available contacts in this range.</p>}
  </section>;
}
