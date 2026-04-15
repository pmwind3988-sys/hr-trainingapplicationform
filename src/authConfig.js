const BASE_URL = window.location.origin;

export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}`,
    redirectUri: BASE_URL,                     // ← was: `${BASE_URL}/approve`
    postLogoutRedirectUri: BASE_URL,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Used for initial login — User.Read only
// .default scopes must be acquired separately after login
export const loginRequest = {
  scopes: ["User.Read"],
  redirectUri: BASE_URL,                       // ← was: `${BASE_URL}/approve`
};

// Used separately to get a token for Power Automate calls
export const flowTokenRequest = {
  scopes: ["https://service.flow.microsoft.com/.default"],
};