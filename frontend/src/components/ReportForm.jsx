import { useState } from "react";
import { createReport } from "../api.js";
import { DESCRIPTION_MAX, GROUND_MATERIALS, REPORT_TYPES, WHY_NOT, typeInfo } from "../constants.js";

const EMPTY = {
  report_type: "",
  subtype: "",
  description: "",
  wheelchair_accessible: "",
  why_not: "",
  ground_material: "",
  other_material: "",
  trail_width_m: "",
  temporary: "",
};

// the form's fields -> the POST /reports body. everything that isn't a column
// goes in tags, using the same keys as the survey data so old and new reports match
function toPayload(draft, fields) {
  const tags = {};
  const optional = ["subtype", "wheelchair_accessible", "ground_material", "temporary"];
  for (const key of optional) if (fields[key]) tags[key] = fields[key];
  if (fields.wheelchair_accessible === "No" && fields.why_not) tags.why_not = fields.why_not;
  if (fields.ground_material === "other" && fields.other_material.trim())
    tags.other_material = fields.other_material.trim();
  if (fields.trail_width_m !== "") tags.trail_width_m = Number(fields.trail_width_m);

  return {
    lat: draft.lat,
    lon: draft.lon,
    report_type: fields.report_type,
    description: fields.description.trim() || null,
    tags,
  };
}

export default function ReportForm({ draft, onClearDraft, onCreated }) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const set = (key) => (event) => setFields((f) => ({ ...f, [key]: event.target.value }));
  const subtypes = fields.report_type ? typeInfo(fields.report_type).subtypes : [];

  function changeType(event) {
    // subtypes belong to one type, so reset it when the type changes
    setFields((f) => ({ ...f, report_type: event.target.value, subtype: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    if (!draft) {
      setError("click the map to choose where the barrier is");
      return;
    }
    setSaving(true);
    try {
      const report = await createReport(toPayload(draft, fields));
      onCreated(report);
      setFields(EMPTY);
      setSaved(report.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setFields(EMPTY);
    setError(null);
    setSaved(null);
    onClearDraft();
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <h2>New report</h2>
      <p className="muted">
        Click the map where the barrier is, then fill out what you can. Only the location and type
        are required.
      </p>

      <fieldset>
        <legend>Where</legend>
        <div className={`location ${draft ? "" : "empty"}`}>
          {draft
            ? `${draft.lat.toFixed(6)}, ${draft.lon.toFixed(6)}`
            : "no location yet, click the map above"}
        </div>
      </fieldset>

      <fieldset>
        <legend>What</legend>
        <div className="grid">
          <label>
            <span>
              Type <span className="required">*</span>
            </span>
            <select value={fields.report_type} onChange={changeType} required>
              <option value="">choose a type</option>
              {REPORT_TYPES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>

          <label>
            Subtype
            <select value={fields.subtype} onChange={set("subtype")} disabled={!subtypes.length}>
              <option value="">{subtypes.length ? "optional" : "none for this type"}</option>
              {subtypes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={fields.description}
            onChange={set("description")}
            placeholder="e.g. large root across the left half of the path"
          />
          <span className="hint">
            {fields.description.length}/{DESCRIPTION_MAX}
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Trail conditions</legend>
        <div className="grid">
          <label>
            Wheelchair accessible?
            <select value={fields.wheelchair_accessible} onChange={set("wheelchair_accessible")}>
              <option value="">not sure</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>

          {fields.wheelchair_accessible === "No" && (
            <label>
              Why not?
              <select value={fields.why_not} onChange={set("why_not")}>
                <option value="">optional</option>
                {WHY_NOT.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            Ground material
            <select value={fields.ground_material} onChange={set("ground_material")}>
              <option value="">not sure</option>
              {GROUND_MATERIALS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>

          {fields.ground_material === "other" && (
            <label>
              Other material
              <input value={fields.other_material} onChange={set("other_material")} maxLength={100} />
            </label>
          )}

          <label>
            Trail width (m)
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={fields.trail_width_m}
              onChange={set("trail_width_m")}
            />
          </label>

          <label>
            Temporary?
            <select value={fields.temporary} onChange={set("temporary")}>
              <option value="">not sure</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>
        </div>
      </fieldset>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="message success" role="status">
          saved as report #{saved}
        </p>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={reset}>
          Clear
        </button>
        <button type="submit" disabled={saving || !draft || !fields.report_type}>
          {saving ? "Saving…" : "Submit report"}
        </button>
      </div>
    </form>
  );
}
