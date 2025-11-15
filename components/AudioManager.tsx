"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Play, Pause, Volume2 } from "lucide-react";

interface AudioFile {
  key: string;
  url: string;
  size: number;
  last_modified: string;
  speaker_mode: "single-speaker" | "multi-speaker";
  language: "english" | "hindi";
  filename: string;
}

interface AudioListResponse {
  audios: AudioFile[];
  total: number;
  cdn_base_url: string;
}

type AudioCategory = {
  speaker: "single-speaker" | "multi-speaker";
  language: "english" | "hindi";
  label: string;
};

const AUDIO_CATEGORIES: AudioCategory[] = [
  { speaker: "single-speaker", language: "english", label: "Single Speaker - English" },
  { speaker: "single-speaker", language: "hindi", label: "Single Speaker - Hindi" },
  { speaker: "multi-speaker", language: "english", label: "Multi Speaker - English" },
  { speaker: "multi-speaker", language: "hindi", label: "Multi Speaker - Hindi" },
];

export default function AudioManager() {
  const [audios, setAudios] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AudioCategory>(AUDIO_CATEGORIES[0]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchAudios();
  }, []);

  const fetchAudios = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/admin/examples/audio/list");
      const data: AudioListResponse = await res.json();
      setAudios(data.audios);
    } catch (error) {
      console.error("Failed to fetch audios:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAudioNumber = (filename: string): number => {
    if (!filename || typeof filename !== 'string') return 0;
    const match = filename.match(/(\d+)\./);
    return match ? parseInt(match[1]) : 0;
  };

  const getCategoryAudios = (category: AudioCategory) => {
    return audios
      .filter((a) => a.speaker_mode === category.speaker && a.language === category.language)
      .sort((a, b) => getAudioNumber(a.filename) - getAudioNumber(b.filename));
  };

  const handleFileSelect = async (category: AudioCategory, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("speaker_mode", category.speaker);
    formData.append("language", category.language);

    try {
      const res = await fetch("http://localhost:8000/admin/examples/audio/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchAudios();
        alert("Audio uploaded successfully!");
      } else {
        const error = await res.json();
        alert(`Upload failed: ${error.detail}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (audio: AudioFile) => {
    if (!confirm(`Delete ${audio.filename}?`)) return;

    try {
      const res = await fetch(
        `http://localhost:8000/admin/examples/audio/delete/${audio.speaker_mode}/${audio.language}/${audio.filename}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchAudios();
      } else {
        const error = await res.json();
        alert(`Delete failed: ${error.detail}`);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Delete failed");
    }
  };

  const togglePlay = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingAudio(url);
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingAudio(null);
  };

  const categoryAudios = getCategoryAudios(activeCategory);
  const maxNumber = Math.max(...categoryAudios.map(a => getAudioNumber(a.filename)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audio Story Examples</h2>
          <p className="text-muted-foreground mt-1">
            Manage audio examples for the Audio Story feature
          </p>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* Category Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-8">
          {AUDIO_CATEGORIES.map((category) => {
            const count = getCategoryAudios(category).length;
            const isActive = activeCategory.speaker === category.speaker && activeCategory.language === category.language;
            return (
              <button
                key={`${category.speaker}-${category.language}`}
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {category.label}
                <span className="ml-2 text-xs opacity-75">({count})</span>
              </button>
            );
          })}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Audio Grid */}
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: Math.max(maxNumber, 3) }, (_, i) => i + 1).map((number) => {
              const audio = categoryAudios.find((a) => getAudioNumber(a.filename) === number);
              const isPlaying = audio && playingAudio === audio.url;

              return (
                <div
                  key={number}
                  className="bg-card rounded-lg border border-border hover:border-primary/50 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                          {number}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">Audio Example {number}</p>
                          {audio && (
                            <p className="text-xs text-muted-foreground">
                              {(audio.size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {audio ? (
                          <>
                            <button
                              onClick={() => togglePlay(audio.url)}
                              className="p-2 rounded-lg bg-primary hover:bg-primary/90 transition-colors"
                              title={isPlaying ? "Pause" : "Play"}
                            >
                              {isPlaying ? (
                                <Pause className="w-5 h-5 text-primary-foreground" />
                              ) : (
                                <Play className="w-5 h-5 text-primary-foreground" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(audio)}
                              className="p-2 rounded-lg bg-destructive hover:bg-destructive/90 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5 text-white" />
                            </button>
                          </>
                        ) : (
                          <label className="p-2 rounded-lg bg-primary hover:bg-primary/90 transition-colors cursor-pointer">
                            <Upload className="w-5 h-5 text-primary-foreground" />
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              ref={(el) => {
                                fileInputRefs.current[`${activeCategory.speaker}-${activeCategory.language}-${number}`] = el;
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(activeCategory, file);
                              }}
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {audio ? (
                      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                          <p className="text-foreground text-sm font-medium">{audio.filename}</p>
                          <p className="text-muted-foreground text-xs">
                            {activeCategory.speaker} • {activeCategory.language}
                          </p>
                        </div>
                        {isPlaying && (
                          <div className="flex gap-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-1 h-4 bg-primary rounded-full animate-pulse"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <p className="text-muted-foreground text-sm">Click upload to add audio {number}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upload All Button */}
          <div className="bg-card rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
            <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-opacity">
              <Upload className="w-5 h-5" />
              <span>Upload New Audio</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(activeCategory, file);
                }}
                disabled={uploading}
              />
            </label>
            <p className="text-muted-foreground text-sm mt-2">
              Will be automatically numbered as {maxNumber + 1}
            </p>
          </div>
        </>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 text-center border border-border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-foreground">Uploading audio...</p>
          </div>
        </div>
      )}
    </div>
  );
}
