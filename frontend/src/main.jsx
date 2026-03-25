import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "../styles/styles.css";

// React 애플리케이션 진입점이다.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
