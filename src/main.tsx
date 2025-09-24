// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";

// 👇 important: load your global styles (Tailwind, etc)
import "./index.css";

import { RouterProvider } from "react-router-dom";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
