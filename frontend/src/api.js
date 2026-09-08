function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;

  if (typeof window !== "undefined") {
    const pageHost = window.location.hostname;
    const pageIsLoopback = pageHost === "localhost" || pageHost === "127.0.0.1";
    const configuredIsLoopback =
      typeof configured === "string" &&
      /^(https?:\/\/)(localhost|127\.0\.0\.1)([:/]|$)/i.test(configured);

    if (!pageIsLoopback && (!configured || configuredIsLoopback)) {
      return `${window.location.protocol}//${pageHost}:3001`;
    }
  }

  return configured || "http://127.0.0.1:3001";
}

export const API_BASE_URL = resolveApiBaseUrl();

