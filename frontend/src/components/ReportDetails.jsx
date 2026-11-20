import { TAG_LABELS, typeInfo } from "../constants.js";

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// turns tag keys like associated_segment_number into "associated segment number"
const labelOf = (key) => TAG_LABELS[key] || key.replaceAll("_", " ");

const formatValue = (value) =>
  typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);

function Fact({ label, children }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// the panel next to the map: the selected report, or a hint when nothing is selected
export default function ReportDetails({ report, onClose }) {
  if (!report) {
    return (
      <aside className="details empty">
        <h2>Report details</h2>
        <p className="muted">Click a dot on the map to see its report here.</p>
        <p className="muted">Click anywhere else on the map to start a new report below.</p>
      </aside>
    );
  }

  const tags = report.tags || {};
  const { color } = typeInfo(report.report_type);

  // the named attributes first, then everything else under "more details"
  const known = Object.keys(TAG_LABELS).filter((key) => key !== "subtype" && tags[key] != null);
  const extra = Object.keys(tags).filter((key) => !(key in TAG_LABELS));

  return (
    <aside className="details" aria-live="polite">
      <div className="details-header">
        <h2>
          <span className="dot" style={{ background: color }} />
          {report.report_type}
          {tags.subtype && <span className="muted"> · {tags.subtype}</span>}
        </h2>
        <button type="button" className="close" onClick={onClose} aria-label="close report details">
          ×
        </button>
      </div>

      <p className={report.description ? "details-description" : "details-description muted"}>
        {report.description || "no description"}
      </p>

      <dl className="facts">
        <Fact label="reported">{formatDate(report.created_at)}</Fact>
        {known.map((key) => (
          <Fact key={key} label={labelOf(key)}>
            {formatValue(tags[key])}
          </Fact>
        ))}
      </dl>

      <details>
        <summary>more details</summary>
        <dl className="facts">
          {extra.map((key) => (
            <Fact key={key} label={labelOf(key)}>
              {formatValue(tags[key])}
            </Fact>
          ))}
          <Fact label="location">
            {report.lat.toFixed(6)}, {report.lon.toFixed(6)}
          </Fact>
        </dl>
      </details>

      <div className="details-id muted">report #{report.id}</div>
    </aside>
  );
}
