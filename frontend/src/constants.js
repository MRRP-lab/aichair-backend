// keep BBOX in sync with BBOX in api/main.py: Western Washington University
// and the Sehome Hill Arboretum. the API rejects reports outside it
export const BBOX = { south: 48.724, west: -122.4935, north: 48.743, east: -122.474 };

// leaflet wants [[south, west], [north, east]]
export const BOUNDS = [
  [BBOX.south, BBOX.west],
  [BBOX.north, BBOX.east],
];

export const inBbox = (lat, lon) =>
  lat >= BBOX.south && lat <= BBOX.north && lon >= BBOX.west && lon <= BBOX.east;

// the five report types the API accepts, with a map color for each.
// subtypes come from the survey; they're stored in tags.subtype
export const REPORT_TYPES = [
  {
    name: "Obstacle",
    color: "#e5534b",
    subtypes: ["Pothole", "Roots", "Rocks", "Branches", "Bushes", "Other"],
  },
  { name: "Confuser", color: "#f0a830", subtypes: ["Trail Intersection", "Other"] },
  {
    name: "Point of Interest",
    color: "#2fbf9f",
    subtypes: ["Sign", "Seating", "Notable Permanent Feature", "Other"],
  },
  { name: "Seasonal", color: "#58a6e8", subtypes: [] },
  { name: "Other", color: "#a3aeb8", subtypes: [] },
];

export const typeInfo = (name) =>
  REPORT_TYPES.find((t) => t.name === name) || REPORT_TYPES[REPORT_TYPES.length - 1];

// choices for the trail attributes, matching the values in the survey data
export const WHY_NOT = ["Bumps", "Obstacle in Path", "Slope", "Other"];
export const GROUND_MATERIALS = ["paved (asphalt)", "gravel", "natural ground (dirt)", "other"];

// tags the details panel shows by name, in this order. anything else goes under "more details"
export const TAG_LABELS = {
  subtype: "subtype",
  wheelchair_accessible: "wheelchair accessible",
  why_not: "why not",
  ground_material: "ground material",
  other_material: "other material",
  trail_width_m: "trail width (m)",
  temporary: "temporary",
};

// API limit on description length
export const DESCRIPTION_MAX = 500;
