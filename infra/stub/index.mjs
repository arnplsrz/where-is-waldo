export const handler = async (event) => {
  const healthy = event.rawPath === "/api/health";
  return {
    statusCode: healthy ? 200 : 404,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(healthy ? { status: "ok" } : { error: "Not found" }),
  };
};
