"use client";

import { useEffect, useState } from "react";

interface CaptionStyle {
  id: string;
  name: string;
  isPreset: boolean;
}

export function CaptionStylePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (styleId: string) => void;
}) {
  const [styles, setStyles] = useState<CaptionStyle[]>([]);

  useEffect(() => {
    fetch("/api/caption-styles")
      .then((r) => r.json())
      .then((json) => setStyles(json.styles));
  }, []);

  return (
    <div className="flex gap-2 flex-wrap">
      {styles.map((style) => (
        <button
          key={style.id}
          type="button"
          onClick={() => onChange(style.id)}
          className={`border rounded px-3 py-1 text-sm ${
            value === style.id ? "bg-black text-white" : "bg-white"
          }`}
        >
          {style.name}
        </button>
      ))}
    </div>
  );
}
