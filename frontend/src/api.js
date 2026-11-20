// small wrappers around the API. paths are relative, so they go to whatever
// served the page: nginx in docker, or the vite dev server's proxy

// FastAPI's 422s list each problem as { loc, msg }; turn them into one readable line
function errorMessage(body, status) {
  if (Array.isArray(body?.detail)) {
    return body.detail
      .map((d) => `${d.loc?.filter((p) => p !== "body").join(".") || "request"}: ${d.msg}`)
      .join("; ");
  }
  if (typeof body?.detail === "string") return body.detail;
  return `request failed (${status})`;
}

async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return body;
}

export const listReports = () => request("/reports");

export const createReport = (report) =>
  request("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

export async function checkHealth() {
  try {
    return (await fetch("/health")).ok;
  } catch {
    return false;
  }
}
