// src/utils/getAccessToken.js

import { flowTokenRequest } from "../authConfig";

export async function getAccessToken(instance, accounts) {
  if (!accounts || accounts.length === 0) {
    console.warn("getAccessToken: no accounts found");
    return null;
  }

  const request = {
    ...flowTokenRequest,
    account: accounts[0],
  };

  try {
    // First try silent — works if user already consented this session
    const response = await instance.acquireTokenSilent(request);
    console.log("Token acquired silently");
    return response.accessToken;
  } catch (silentError) {
    console.warn("Silent token failed:", silentError.errorCode);

    // If silent fails due to consent needed — use popup
    // Popup is better than redirect here because we don't want
    // to lose the current page state
    try {
      const response = await instance.acquireTokenPopup(request);
      console.log("Token acquired via popup");
      return response.accessToken;
    } catch (popupError) {
      console.error("Popup token failed:", popupError.errorCode, popupError.message);
      return null;
    }
  }
}