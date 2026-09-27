"""Build a single, read-only preview from the supplied Stage 2 CSV sample.

Usage: python3 scripts/build-yscc-sample-preview.py SAMPLE_DIRECTORY OUTPUT_JSON
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path


CLIENT_KEY = "YSCC01-C0001"
FILES = (
    "organisations",
    "practitioners",
    "clients",
    "care-journeys",
    "episodes-of-care",
    "care-events",
    "measure-items",
    "measure-scores",
)


def read_rows(directory, name):
    with (directory / f"{name}.csv").open(newline="", encoding="utf-8-sig") as source:
        return list(csv.DictReader(source))


def one(rows, label):
    if len(rows) != 1:
        raise ValueError(f"Expected one {label}; found {len(rows)}")
    return rows[0]


def date_key(value):
    return datetime.strptime(value, "%d%m%Y")


def build(directory):
    rows = {name: read_rows(directory, name) for name in FILES}
    client = one([row for row in rows["clients"] if row["client_key"] == CLIENT_KEY], "client")
    journeys = [row for row in rows["care-journeys"] if row["client_key"] == CLIENT_KEY]
    journey_keys = {row["care_journey_key"] for row in journeys}
    episodes = [row for row in rows["episodes-of-care"] if row["client_key"] == CLIENT_KEY]
    episode_keys = {row["episode_key"] for row in episodes}
    if not episodes or any(row["care_journey_key"] not in journey_keys for row in episodes):
        raise ValueError("Client episodes must resolve to their care journey")
    if any(row["previous_episode_key"] and row["previous_episode_key"] not in episode_keys for row in episodes):
        raise ValueError("A previous episode is missing from the selected client")

    events = [row for row in rows["care-events"] if row["episode_key"] in episode_keys]
    event_keys = {row["care_event_key"] for row in events}
    items = [row for row in rows["measure-items"] if row["care_event_key"] in event_keys]
    scores = [row for row in rows["measure-scores"] if row["care_event_key"] in event_keys]
    practitioners = sorted({row["practitioner_key"] for row in events if row["practitioner_key"]})
    practitioner_rows = [row for row in rows["practitioners"] if row["practitioner_key"] in practitioners]
    if len(practitioner_rows) != len(practitioners):
        raise ValueError("A practitioner key on a selected event is unresolved")
    relevant_paths = {client["organisation_path"]}
    relevant_paths.update(row["organisation_path"] for row in events)
    relevant_paths.update(path.rsplit(":", 1)[0] for path in list(relevant_paths) if ":" in path)
    organisations = [row for row in rows["organisations"] if row["organisation_path"] in relevant_paths]

    grouped_events = []
    for event in sorted(events, key=lambda row: (date_key(row["care_event_date"]), row["care_event_key"])):
        key = event["care_event_key"]
        grouped_events.append({
            **event,
            "measureItems": [row for row in items if row["care_event_key"] == key],
            "measureScores": [row for row in scores if row["care_event_key"] == key],
        })
    return {
        "source": "Supplied synthetic Stage 2 CSV sample",
        "readOnly": True,
        "client": client,
        "organisations": organisations,
        "practitioners": practitioner_rows,
        "journeys": sorted(journeys, key=lambda row: date_key(row["journey_start_date"])),
        "episodes": sorted(episodes, key=lambda row: (date_key(row["episode_start_date"]), row["episode_key"])),
        "events": grouped_events,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    result = build(Path(sys.argv[1]))
    destination = Path(sys.argv[2])
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {result['client']['client_key']}: {len(result['episodes'])} episodes, "
          f"{len(result['events'])} events to {destination}")
