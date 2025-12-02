import React from "react";
import SalesTool from "./SalesTool";

// Redirect/Alias for the old page name to prevent 404 loops for stale clients
export default function WhatnotSalesTool() {
  return <SalesTool />;
}