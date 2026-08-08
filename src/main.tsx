import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MachineGame } from "@/components/tim/MachineGame";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root container not found");

createRoot(root).render(
  <StrictMode>
    <main className="min-h-screen">
      <MachineGame />
    </main>
  </StrictMode>,
);
