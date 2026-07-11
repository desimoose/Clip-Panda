"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEpisodePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.append("title", title);
    if (sourceUrl) form.append("sourceUrl", sourceUrl);
    if (file) form.append("file", file);

    const response = await fetch("/api/episodes", { method: "POST", body: form });
    setSubmitting(false);

    if (!response.ok) {
      const json = await response.json();
      setError(json.error ?? "Something went wrong");
      return;
    }

    const json = await response.json();
    router.push(`/episodes/${json.episodeId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Import an episode</h1>
      <input
        className="w-full border rounded p-2"
        placeholder="Episode title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="w-full border rounded p-2"
        placeholder="YouTube or direct video URL (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />
      <input
        type="file"
        accept="video/*,audio/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting || (!file && !sourceUrl)}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Importing..." : "Import"}
      </button>
    </form>
  );
}
