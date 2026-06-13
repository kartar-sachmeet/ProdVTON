import { useState } from "react";
import "./App.css";
import { LiveTryOn } from "./components/LiveTryOn";
import { PhotoTryOn } from "./components/PhotoTryOn";

type View = "photo" | "live";

export default function App() {
  const [view, setView] = useState<View>("photo");

  return (
    <main className="app">
      <h1>ProdVton — Virtual Try-On</h1>

      <nav className="nav">
        <button
          type="button"
          className={view === "photo" ? "active" : ""}
          onClick={() => setView("photo")}
        >
          Photo
        </button>
        <button
          type="button"
          className={view === "live" ? "active" : ""}
          onClick={() => setView("live")}
        >
          Live camera
        </button>
      </nav>

      {view === "photo" ? <PhotoTryOn /> : <LiveTryOn />}
    </main>
  );
}
