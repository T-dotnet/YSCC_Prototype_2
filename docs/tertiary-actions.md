# Tertiary actions

Use the Assessment tab’s Edit treatment for low-emphasis actions: muted 14px regular text, transparent background, no border, 16px icons, a subtle hover surface, and a visible keyboard focus outline. Touch targets are at least 40px on desktop and 44px on phones.

- Edit: `EditAction`, with a leading pencil and a visible action label. Use a specific label when the surrounding record does not establish what is edited.
- More info: `TextLink` with a leading Info icon. Keep the label visible on phones.
- Navigation to details, history, contacts, or source records: `TextLink`, with a trailing arrow and a visible destination label.
- Other contextual actions: `TertiaryAction`; use text alone when an icon adds no information. Expand/collapse-all keeps its icon and label.
- Icon-only controls: familiar utilities such as close, clear search, individual disclosure chevrons, pagination arrows, and overflow menus. Provide an accessible name and tooltip identifying the control. Keep Edit and standalone More info labels visible. Bundle details uses read-only assessment and contact tables without row actions.

Primary and secondary workflow actions keep their existing hierarchy. Shared legacy tertiary selectors in styles.css use the same visual treatment during migration.
