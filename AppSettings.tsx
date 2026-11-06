// src/components/AppSettings.tsx
import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui";
import { Icon } from "./icons";
import { getStorageInfo, requestPersist, type StorageInfo } from "../storage";
import { importProjectFile } from "../files";
import { describeError, formatBytes } from "../project";

export function AppSettings({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadInfo = () => {
    getStorageInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  };
  useEffect(loadInfo, []);

  const ratio = info && info.quota > 0 ? info.usage / info.quota : 0;

  const persist = async () => {
    const ok = await requestPersist();
    setMessage(
      ok
        ? { text: "Veriler kalıcı olarak korunacak." }
        : { text: "Tarayıcı kalıcı depolamaya izin vermedi. Önemli projeleri yedekle.", error: true },
    );
    loadInfo();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importProjectFile(file);
      setMessage({ text: "Proje içe aktarıldı." });
      onImported();
    } catch (e) {
      setMessage({ text: describeError(e), error: true });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Sheet title="Ayarlar" onClose={onClose}>
      <div className="stack-lg">
        <div className="field">
          <div className="label">Depolama</div>
          {info ? (
            <>
              <div className="meter" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.max(1, ratio * 100))}%` }} />
              </div>
              <p className="hint">
                {formatBytes(info.usage)} kullanılıyor, toplam {formatBytes(info.quota)} alan var.
              </p>
              {ratio > 0.8 && (
                <p className="hint danger">Depolama dolmak üzere. Kullanılmayan projeleri silmeyi düşün.</p>
              )}
              {!info.persisted && (
                <button className="btn btn-secondary" onClick={persist}>
                  Verileri kalıcı yap
                </button>
              )}
            </>
          ) : (
            <p className="hint">Bu tarayıcı depolama bilgisini paylaşmıyor.</p>
          )}
        </div>

        <div className="field">
          <div className="label">Proje dosyası</div>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={20} /> Proje içe aktar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        {message && <p className={`hint ${message.error ? "danger" : ""}`}>{message.text}</p>}
        <p className="hint">Nashi Studio 0.1</p>
      </div>
    </Sheet>
  );
}
