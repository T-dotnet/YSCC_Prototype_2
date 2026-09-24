# Form validation guidelines

Use this pattern for every form in the YSCC prototype, including modal forms. Validation should tell staff what prevented the action, where to fix it, and whether anything was saved.

## On a failed action

1. Keep entered values. Do not save or advance the workflow.
2. Show a red error summary immediately above or below the action buttons. State that the action was not completed, give the number of items to check, and list each field with a short corrective message.
3. Move keyboard focus to the summary after custom validation fails. Make each listed item a button or link that focuses its field. Native required-field validation may focus the first invalid control instead.
4. Mark each invalid control with a red border and `aria-invalid="true"`. Show a specific hint next to it. Connect that hint with `aria-describedby` so assistive technology reads it with the control.
5. Keep the summary and field hints in sync as values change. Clear them when the problems are resolved; do not clear unrelated errors just because one field changed.
6. A success message may appear only after persistence succeeds. A toast alone is insufficient for a failed save.

## Component usage

- Wrap forms in `ValidatedForm`. It handles native required-field styling and lists each invalid field in a summary after the form actions when the browser blocks submission. Its summary links focus the matching fields.
- Use `Field` for inputs, selects, textareas, and staff pickers. Pass `error` for a specific field message and `hint` for normal guidance. `Field` links these messages to direct controls.
- For custom or cross-field checks, render `FormErrorSummary` beside the form actions. Supply `{ id, label, message }` for each invalid control. Each `id` must match a focusable control in the form.
- For checkboxes or custom controls outside `Field`, set `aria-invalid`, give the error hint an ID, and connect it through `aria-describedby`.
- Use an action-specific message, such as “Choose an intake outcome,” instead of a generic “Invalid value.” Do not rely on color alone.

## Intake example

“Save draft” preserves partial intake details. “Save intake” first validates and stores the required checks. Once those checks are saved, the same primary action validates the outcome and completion details. An empty outcome must show a red Outcome field, its hint, and a summary beside the buttons; it must not silently save the checks again. “Record outcome” appears when an outcome has been selected.

## Review checklist

- Try the primary action with an empty required field and with an invalid value.
- Confirm the summary is visible beside the action, receives focus, and its items focus the matching controls.
- Confirm red borders and specific hints appear on every invalid field, including selects and checkboxes.
- Correct one field and confirm other errors remain. Complete the form and confirm the summary clears.
- Check keyboard and screen-reader labels, plus narrow and wide layouts.
- Verify draft saves remain possible without completing the validation action.
