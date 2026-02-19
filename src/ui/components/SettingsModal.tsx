import { useEffect } from "react";
import "./SettingsModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  onChangeLanguage?: (lang: string) => void;
};

export function SettingsModal({ isOpen, onClose, language = "en", onChangeLanguage }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mm-modal-backdrop" onMouseDown={onClose}>
      <div className="mm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="mm-row">
          <div>Language</div>
          <select
            value={language}
            onChange={(e) => onChangeLanguage?.(e.target.value)}
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </div>

        <div className="mm-row" style={{ justifyContent: "flex-end" }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
