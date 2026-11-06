// src/App.tsx
import { useState } from "react";
import { Home } from "./components/Home";
import { Editor } from "./components/Editor";

export function App() {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId ? (
    <Editor key={openId} projectId={openId} onClose={() => setOpenId(null)} />
  ) : (
    <Home onOpen={setOpenId} />
  );
}
