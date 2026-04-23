import { buildApiUrl } from "./api";

describe("api url builder", () => {
  it("joins a public base url with an api path", () => {
    expect(buildApiUrl("https://api.example.com/", "/api/forms/import")).toBe(
      "https://api.example.com/api/forms/import",
    );
  });

  it("throws when no api base url is configured", () => {
    expect(() => buildApiUrl("", "/api/forms/import")).toThrow("VITE_API_BASE_URL");
  });
});
