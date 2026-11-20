import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BOUNDS, inBbox, typeInfo } from "../constants.js";

// clicking the map (not a dot) picks the location for a new report
function ClickToPick({ onPick }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      if (inBbox(lat, lng)) onPick({ lat, lon: lng });
    },
  });
  return null;
}

// keeps the view inside the box: the furthest you can zoom out is about where the
// box's sides meet the map's sides. recalculated when the map changes size,
// since a narrower window needs a different zoom to fill it
function LockToBox() {
  const map = useMap();
  useEffect(() => {
    function update() {
      // true = the lowest zoom where the whole view still fits inside the box.
      // whole zoom levels only: in-between ones scale the tiles and leave thin gaps between them
      const minZoom = map.getBoundsZoom(BOUNDS, true);
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
    }
    update();
    map.on("resize", update);
    return () => map.off("resize", update);
  }, [map]);
  return null;
}

export default function ReportMap({ reports, draft, onPick, selectedId, onSelect }) {
  return (
    <MapContainer
      className="map"
      bounds={BOUNDS}
      maxBounds={BOUNDS}
      maxBoundsViscosity={1.0} // a hard stop at the edge of the box
      maxZoom={19}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <LockToBox />
      <ClickToPick onPick={onPick} />

      {reports.map((report) => {
        const selected = report.id === selectedId;
        return (
          <CircleMarker
            key={report.id}
            center={[report.lat, report.lon]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color: selected ? "#0e1412" : "#fff",
              weight: selected ? 3 : 2,
              fillColor: typeInfo(report.report_type).color,
              fillOpacity: 0.9,
            }}
            // don't let a dot click also pick a new location
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onSelect(report.id) }}
          />
        );
      })}

      {draft && (
        <CircleMarker
          center={[draft.lat, draft.lon]}
          radius={9}
          interactive={false}
          pathOptions={{ color: "#0e1412", weight: 3, dashArray: "4 3", fillColor: "#8fd3b0", fillOpacity: 0.8 }}
        />
      )}
    </MapContainer>
  );
}
