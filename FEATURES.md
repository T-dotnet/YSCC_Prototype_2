# Functional & Visual Feature Specification: YSCC Clinical Workspace

Welcome to the comprehensive feature catalog and architectural reference of the **YSCC Clinical Workspace**. This document outlines the application's capabilities, visual design principles, and clinical safety workflows. It serves as both an executive overview and a developer-facing functional deep dive.

---

## 📖 Part 1: Executive & Summary Overview

### 1.1 Mission & Context
The **YSCC Clinical Workspace** is a high-density, web-based clinical assistant designed for youth mental health and clinical care settings. Grounded in reducing "clinical coldness" without introducing visual clutter, the workspace facilitates tracking patient outcomes, managing intake and consent, scheduling appointments, auditing data quality, and rendering long-term progress indicators.

### 1.2 Design Language & Theme
The platform employs a tailored, high-contrast light theme built upon a mathematical scale:
- **The Palette**: Centered around a warm, glare-reducing canvas (`#fbfbf9`), complemented by deep forest green (`#1e3510`) accents for branding, and warm, high-contrast neutrals.
- **Typography Pairing**: **Outfit** for modern display headings and **Plus Jakarta Sans** for readable body content, utilizing a low-contrast **1.125 (Major Second)** typographic scale for maximum data density and readability.
- **Visual Rhythm**: Strict adherence to spacing margins (`Inner Radius = Outer Radius - Padding`) and a total elimination of nested cards, glowing gradients, or unnecessary animations, ensuring a calm, professional interface.

### 1.3 Architecture & Core Technology
- **Frontend Stack**: React (v18+) with TypeScript, Vite, and Tailwind CSS.
- **Data Visualization**: Recharts & D3 for high-performance responsive SVG rendering.
- **Persistence Layer**: Client-side storage and session buffering with transactional local store adapters.
- **Responsive Architecture**: Comprehensive mobile transformation engines that adapt dense desktop data tables into touch-friendly cards and grid clusters.

---

## 🔍 Part 2: Feature Deep Dive & Functional Directory

```
YSCC CLINICAL WORKSPACE
├── Worklist & Dashboard (Queue)
├── People Directory
├── Patient Record View (Chart)
│   ├── Overview (Timeline & Continuity)
│   ├── Assessment (Workflow & Questionnaires)
│   ├── Appointments & Events
│   └── Longitudinal Progress Report
├── Questionnaire In-App Player
├── Clinical Review Workflow
└── Data Quality & Integrity Engine
```

---

### 2.1 Worklist (My Work & Queue Dashboard)

The primary cockpit for clinicians, consolidating action-oriented task management and urgent alerts.

#### 2.1.1 Search, Filter & View Control
- **URL Parameter Synced Filters**: Preserves work context (searches and selections) in query parameters (`?q=...&filter=...&owner=...`). Navigating away and returning restores the exact workspace state.
- **Ownership Segmentation**: Segment work queues by "Me", "My Team", or "Unassigned".
- **Collection Point Tracking**: Filters upcoming assessments by timing milestones (e.g., *Starting point*, *6 weeks*, *12 weeks*, *Ending point*).
- **Responsive Presentation**:
  - *Desktop*: Multi-column dense layout for scanning client ID, assigned practitioner, status, and upcoming deadlines.
  - *Mobile/Tablet (<1024px)*: Automated transformation of the table into high-performance, spaced task cards.

#### 2.1.2 Unified Alerts & Critical Notifications
Aggregates and prioritizes multi-category system issues into a clean, action-oriented sidebar:
- **Data Quality Alerts**: Direct links to resolve critical missing fields or inconsistencies in client records.
- **Overdue Assessment Indicators**: Triggers notifications for questionnaire schedules that have slipped.
- **Overdue Appointment Attendance**: flags planned sessions where attendance outcome recording is overdue.

---

### 2.2 People Directory & Global Search

A central registry for searching and enrolling clients.

- **Fuzzy Search & Indexing**: Searches across name, unique IDs, and assigned primary contacts.
- **Enrolment Actions**: Triggers modal operations to admit new clients or assign clinical care pathways.
- **Adaptive Dense Grid**: Displays active status badges, care coordination details, and quick shortcuts to historical files.

---

### 2.3 Comprehensive Patient Chart (Person Detail)

The clinical home page for an individual client, divided into high-fidelity functional sections.

#### 2.3.1 Client Status Header
A persistent context header rendering:
- Unique client ID, age, and date of birth.
- **Record Completeness Metric**: An inline indicator mapping the completeness of essential clinical descriptors.
- **Active Episode Status**: Badge showing current service phase (e.g., *Active*, *Discharged*).

#### 2.3.2 Section Tabs Directory

##### Tab A: Overview
- **Clinical Coordinator & Care Circle**: Details active practitioners and roles in the care loop.
- **Continuity Details**: Documents transition notes, care step progression, and follow-up guidance.
- **Next Step Navigator**: Displays current task milestone with actionable buttons to record progress.

##### Tab B: Assessment & Questionnaires
- **Interactive Checklist**: Displays scheduled questionnaires (e.g., *K10*, *Everyday Life Check-in*).
- **Initiate/Assess Actions**: Initiates live clinician-guided questionnaires or triggers relative respondent invitations.
- **Draft Recovery Indicators**: Flags if there is an unsubmitted draft form buffered in the user's browser.

##### Tab C: Appointments Manager
- **Status Audits**: Track scheduled, completed, cancelled, or unattended appointments.
- **In-App Booking Forms**: Allows clinicians to log new planned contacts, set practitioners, and associate services.
- **Overdue Flags**: Marks previous sessions awaiting final outcome declarations.

##### Tab D: Timeline & Care Events
- **Linear Chronicle**: Collated timeline of clinical updates, letters, phone calls, and case reviews.
- **Structured Categories**: Filter events by "Clinical Notes", "Correspondence", "In-Take Assessments", and "Operational Updates".

##### Tab E: Consent & Respondents
- **Consent Logs**: Tracks client and parent/guardian approvals for data collection and clinical sharing.
- **Respondent Relations**: Configures active external contacts (e.g., mother, caregiver) authorized to complete child/youth assessments.

---

### 2.4 In-App Questionnaire Player

A high-fidelity player designed to minimize friction during data entry.

- **Dynamic Version Swapping**: Adapts on-the-fly to different instrument versions (e.g., baseline vs. follow-up).
- **Draft Autoclear & Recovery**: Prevents data loss. Buffers active input state per clinician and collection in localized state. Discarding prompts user confirmation, while submission safely flushes buffer.
- **Dual Validation Layer**: Visual feedback for required questions, preventing incomplete submission.

---

### 2.5 Clinical Review Workspace

A dedicated view for clinicians to audit submitted answers, log assessments, and outline care decisions.

- **Aesthetic Score Grids**: Organizes answers by clinical domain (e.g., *Mood*, *Social and safety support*).
- **Historic Version Comparison**: Compares current response values directly with earlier starting points side-by-side.
- **Signaling Indicators**: Marks changed, improved, or declined metrics using colored accessibility indicators.
- **Observations and Actions Note**: Includes a text area with validation checklists to log formal clinical assessments.

---

### 2.6 Longitudinal Outcome Trajectory Report

Provides data-backed trend metrics through dynamic interactive visualization.

- **Likert Scale Trajectory Chart**:
  - Plots assessment outcomes across sequential milestones (0–18 months).
  - **Dynamic Name Injection**: Replaces all generic labels in trends and legends with actual, authored questionnaire names (e.g., *"Life and care check-in · 12 weeks"*).
  - **Selective Comparison Lines**: Users can overlay previous assessment trends or hide comparison lines entirely for uncluttered focus.
- **Interactive Domain Visualizers**:
  - Color-coded bar charts detailing raw score changes for individual questions.
  - Interactive grid outlining comparative text-based answers.

---

### 2.7 Clinical Data Quality Safeguards

An integrated rule engine that constantly monitors database records for errors:
- **Completeness Auditing**: Flags missing DOBs, unassigned clinical coordinators, or missing care pathways.
- **Timing Contradictions**: Detects and alerts if events are recorded outside the active care period.
- **Direct Action Links**: Connects each data quality alert directly to the correct workflow tab, enabling swift rectification of administrative errors.
