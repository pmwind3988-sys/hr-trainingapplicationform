import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import { registerDynamicMatrix } from "./utils/DynamicMatrix";

const msalInstance = new PublicClientApplication(msalConfig);
registerDynamicMatrix();

window.__msalInstance = msalInstance;

function renderApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
}

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise()
    .then((response) => {
      if (response && response.account) {
        msalInstance.setActiveAccount(response.account);
      } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      }
      renderApp();
    })
    .catch((error) => {
      console.error("MSAL redirect error:", error);
      renderApp();
    });
}).catch((error) => {
  console.error("MSAL init error:", error);
  renderApp();
});