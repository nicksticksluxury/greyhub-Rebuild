import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function SalesTool() {
  const [status, setStatus] = useState("Initializing...");
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    setStatus("Checking auth...");
    base44.auth.isAuthenticated()
      .then(isAuth => {
        setAuth(isAuth);
        setStatus(isAuth ? "Authenticated" : "Not Authenticated");
      })
      .catch(err => {
        setStatus("Auth check failed: " + err.message);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Sales Tool Debug</h1>
      <div className="p-4 bg-slate-800 rounded border border-slate-700">
        <p><strong>Status:</strong> {status}</p>
        <p><strong>Auth:</strong> {auth === null ? "Unknown" : (auth ? "Yes" : "No")}</p>
        <p><strong>URL:</strong> {window.location.href}</p>
      </div>
      
      {auth === false && (
         <button 
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="mt-4 px-4 py-2 bg-amber-500 text-black rounded font-bold"
         >
            Log In
         </button>
      )}
    </div>
  );
}