export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

let memoryAccessToken: string | null = null;
export const setAccessToken = (token: string | null) => { memoryAccessToken = token; };
export const getAccessToken = () => memoryAccessToken;

let refreshPromise: Promise<string | null> | null = null;

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", 
  };

  const accessToken = getAccessToken();
  
  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }

  let response = await fetch(`${API_URL}${endpoint}`, config);

  // If 401, we should attempt to refresh. 
  // We exclude the /auth/refresh and /auth/login endpoints from triggering a refresh loop.
  if (response.status === 401 && !endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            setAccessToken(data.accessToken);
            return data.accessToken;
          } else {
            setAccessToken(null);
            return null;
          }
        } catch (error) {
          setAccessToken(null);
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const newAccessToken = await refreshPromise;

    if (newAccessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };
      response = await fetch(`${API_URL}${endpoint}`, config);
    }
  }

  return response;
}
