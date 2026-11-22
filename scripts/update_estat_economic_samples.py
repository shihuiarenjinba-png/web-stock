from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "estat_economic_samples.json"
OUTPUT_DIR = ROOT / "public" / "samples" / "economic"
PROVENANCE_PATH = OUTPUT_DIR / "provenance.json"
API_URL = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _month(label):
    text = str(label).strip()
    m = re.search(r"(\d{4})年\s*(\d{1,2})月", text)
    if m:
        return pd.Timestamp(int(m.group(1)), int(m.group(2)), 1) + pd.offsets.MonthEnd(0)
    return None


def _number(value):
    text = str(value).strip().replace(",", "")
    if text in {"", "-", "…", "...", "***", "NA", "N/A"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value if np.isfinite(value) else None


def fetch(app_id, stats_data_id):
    params = {
        "appId": app_id,
        "statsDataId": stats_data_id,
        "lang": "J",
        "metaGetFlg": "Y",
        "cntGetFlg": "N",
        "explanationGetFlg": "N",
    }
    request = Request(
        API_URL + "?" + urlencode(params),
        headers={"User-Agent": "demandscope-economic-sample-updater/1.0"},
    )
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize(payload):
    root = payload.get("GET_STATS_DATA", {})
    if int(root.get("RESULT", {}).get("STATUS", -1)) != 0:
        raise RuntimeError("e-Stat returned a nonzero status.")

    statistical = root.get("STATISTICAL_DATA", {})
    objects = _as_list(statistical.get("CLASS_INF", {}).get("CLASS_OBJ"))
    dims = []
    labels = {}
    for obj in objects:
        dim = str(obj.get("@id", "")).strip()
        if not dim:
            continue
        dims.append(dim)
        labels[dim] = {
            str(x.get("@code", "")).strip(): str(x.get("@name", "")).strip()
            for x in _as_list(obj.get("CLASS"))
        }

    rows = []
    for item in _as_list(statistical.get("DATA_INF", {}).get("VALUE")):
        date = _month(labels.get("time", {}).get(str(item.get("@time", "")).strip(), ""))
        value = _number(item.get("$"))
        if date is None or value is None:
            continue
        parts = []
        for dim in dims:
            if dim == "time":
                continue
            code = str(item.get("@" + dim, "")).strip()
            if code:
                label = labels.get(dim, {}).get(code, code)
                if label not in {"全国", "総数"}:
                    parts.append(label)
        rows.append({"Date": date, "Series": " / ".join(parts), "Value": value})

    if not rows:
        raise RuntimeError("No usable monthly values were returned.")
    frame = pd.DataFrame(rows).pivot_table(
        index="Date", columns="Series", values="Value", aggfunc="first"
    ).sort_index()
    return frame


def _source_column(frame, needle):
    matches = [str(c) for c in frame.columns if needle in str(c)]
    if len(matches) != 1:
        raise RuntimeError(f"Series selector {needle!r} matched {len(matches)} columns.")
    return matches[0]


def _transform(series, transform):
    s = pd.to_numeric(series, errors="coerce").astype(float)
    if transform == "identity":
        return s
    if transform == "pct_change_12":
        return s.pct_change(12, fill_method=None) * 100.0
    raise RuntimeError(f"Unsupported transform: {transform}")


def build_outputs(frame, config):
    months = int(config["history_months"])
    outputs = {}
    metadata = []

    for spec in config["variables"]:
        if spec.get("approved") is not True:
            continue
        source = _source_column(frame, spec["source_label_contains"])
        values = _transform(frame[source], spec["transform"]).replace([np.inf, -np.inf], np.nan).dropna()
        if len(values) < months:
            raise RuntimeError(f"{spec['id']}: fewer than {months} complete months.")
        values = values.tail(months)

        expected = pd.date_range(values.index.min(), values.index.max(), freq="ME")
        if not values.index.equals(expected):
            raise RuntimeError(f"{spec['id']}: monthly sequence contains a gap.")

        output = pd.DataFrame({
            "date": values.index.to_period("M").to_timestamp("MS").strftime("%Y-%m-%d"),
            spec["id"]: values.to_numpy(dtype=float),
        })
        outputs[spec["filename"]] = output
        metadata.append({
            **spec,
            "matched_source_series": source,
            "period_start": output["date"].iloc[0],
            "period_end": output["date"].iloc[-1],
            "rows": len(output),
        })

    if not outputs:
        raise RuntimeError("No approved DemandScope economic variables are configured.")
    return outputs, metadata


def main():
    app_id = os.environ.get("ESTAT_APP_ID", "").strip()
    if not app_id:
        raise RuntimeError("ESTAT_APP_ID is not configured.")

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    raw = normalize(fetch(app_id, str(config["stats_data_id"])))
    outputs, metadata = build_outputs(raw, config)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    serialized = {}
    for filename, frame in outputs.items():
        text = frame.to_csv(index=False)
        serialized[filename] = text

    provenance = {
        "dataset": config["source_name"],
        "publisher": config["publisher"],
        "statistics_code": config["statistics_code"],
        "stats_data_id": config["stats_data_id"],
        "source_page": config["source_page"],
        "terms_url": config["terms_url"],
        "history_months": config["history_months"],
        "date_convention": config["date_convention"],
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "variables": metadata,
        "usage_note": (
            "Monthly explanatory-variable samples for DemandScope. "
            "Research support does not imply significance for every product or customer dataset."
        ),
        "license_note": (
            "Source: e-Stat / Cabinet Office. Edited and transformed for this sample. "
            "Commercial use is permitted under e-Stat terms subject to source attribution "
            "and third-party-rights checks."
        ),
    }
    provenance_text = json.dumps(provenance, ensure_ascii=False, indent=2) + "\n"

    if any(app_id in text for text in serialized.values()) or app_id in provenance_text:
        raise RuntimeError("Secret leak guard triggered.")

    for filename, text in serialized.items():
        (OUTPUT_DIR / filename).write_text(text, encoding="utf-8")
    PROVENANCE_PATH.write_text(provenance_text, encoding="utf-8")

    print(f"Updated {len(outputs)} DemandScope economic sample files, {config['history_months']} months each.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
