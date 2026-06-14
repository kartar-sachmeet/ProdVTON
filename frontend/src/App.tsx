import { useState } from "react";
import "./App.css";
import { LiveTryOn } from "./components/LiveTryOn";
import { PhotoTryOn } from "./components/PhotoTryOn";
import { Eyewear3DTryOn } from "./eyewear/Eyewear3DTryOn";
import { JewelleryTryOn } from "./jewellery/JewelleryTryOn";
import { MakeupTryOn } from "./makeup/MakeupTryOn";

type View = "photo" | "live" | "makeup" | "eyewear" | "jewellery";

const TABS: { id: View; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "live", label: "Live camera" },
  { id: "makeup", label: "Makeup" },
  { id: "eyewear", label: "Eyewear" },
  { id: "jewellery", label: "Jewellery" },
];

export default function App() {
  const [view, setView] = useState<View>("photo");

  return (
    <main className="app">
      <h1>ProdVton — Virtual Try-On</h1>

      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={view === t.id ? "active" : ""}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {view === "photo" && <PhotoTryOn />}
      {view === "live" && <LiveTryOn />}
      {view === "makeup" && <MakeupTryOn />}
      {view === "eyewear" && <Eyewear3DTryOn />}
      {view === "jewellery" && <JewelleryTryOn />}
    </main>
  );
}
