"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Play, Pause, Volume2, Save, ChevronDown } from "lucide-react";

interface AudioFile {
  key: string;
  url: string;
  size: number;
  last_modified: string;
  speaker_mode: "single-speaker" | "multi-speaker";
  language: string;
  filename: string;
  example_number: number;
  text?: string;
  voice_name?: string;
  narrator_voice?: string;
  male_voice?: string;
  female_voice?: string;
}

interface Voice {
  id: string;
  name: string;
  type: "male" | "female";
  description?: string;
  emoji?: string;
}

interface AudioListResponse {
  audios: AudioFile[];
  total: number;
  cdn_base_url: string;
}

type SpeakerMode = "single-speaker" | "multi-speaker";
type Language = "english" | "hindi" | "spanish" | "french" | "portuguese" | "russian" | "tamil";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "portuguese", label: "Portuguese" },
  { value: "russian", label: "Russian" },
  { value: "tamil", label: "Tamil" },
];

const SPEAKER_MODES: { value: SpeakerMode; label: string }[] = [
  { value: "single-speaker", label: "Single Speaker" },
  { value: "multi-speaker", label: "Multi Speaker" },
];

// Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  const savedCreds = sessionStorage.getItem('admin_auth')
  if (!savedCreds) return {}
  
  try {
    const { username, password } = JSON.parse(savedCreds)
    return {
      'Authorization': 'Basic ' + btoa(`${username}:${password}`)
    }
  } catch (e) {
    return {}
  }
}

export default function AudioManager() {
  const [audios, setAudios] = useState<AudioFile[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerMode>("single-speaker");
  const [activeLanguage, setActiveLanguage] = useState<Language>("english");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] = useState<Record<number, Partial<AudioFile>>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchAudios();
  }, []);

  useEffect(() => {
    fetchVoices(activeLanguage);
  }, [activeLanguage]);

  const fetchAudios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/examples/audio/list`, {
        headers: getAuthHeaders()
      });
      const data: AudioListResponse = await res.json();
      console.log("Fetched audios:", data.audios);
      setAudios(data.audios);
    } catch (error) {
      console.error("Failed to fetch audios:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoices = async (language: Language) => {
    try {
      const res = await fetch(`${apiUrl}/admin/examples/audio/voices/${language}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setVoices(data.voices || []);
    } catch (error) {
      console.error("Failed to fetch voices:", error);
      setVoices([]);
    }
  };

  const getCategoryAudios = () => {
    return audios
      .filter((a) => a.speaker_mode === activeSpeaker && a.language === activeLanguage)
      .sort((a, b) => a.example_number - b.example_number);
  };

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("speaker_mode", activeSpeaker);
    formData.append("language", activeLanguage);

    try {
      const res = await fetch(`${apiUrl}/admin/examples/audio/upload`, {
        method: "POST",
        body: formData,
        headers: getAuthHeaders()
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
        `${apiUrl}/admin/examples/audio/delete/${audio.speaker_mode}/${audio.language}/${audio.filename}`,
        {
          method: "DELETE",
          headers: getAuthHeaders()
        }
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

  const handleSaveMetadata = async (audio: AudioFile, exampleNumber: number) => {
    const metadata = editingMetadata[exampleNumber];
    if (!metadata) return;

    setSaving(exampleNumber);
    try {
      const res = await fetch(`${apiUrl}/admin/examples/audio/metadata`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          speaker_mode: activeSpeaker,
          language: activeLanguage,
          example_number: exampleNumber,
          text: metadata.text ?? audio.text,
          voice_name: activeSpeaker === "single-speaker" ? (metadata.voice_name ?? audio.voice_name) : undefined,
          narrator_voice: activeSpeaker === "multi-speaker" ? (metadata.narrator_voice ?? audio.narrator_voice) : undefined,
          male_voice: activeSpeaker === "multi-speaker" ? (metadata.male_voice ?? audio.male_voice) : undefined,
          female_voice: activeSpeaker === "multi-speaker" ? (metadata.female_voice ?? audio.female_voice) : undefined,
        }),
      });

      if (res.ok) {
        await fetchAudios();
        setEditingMetadata((prev) => {
          const next = { ...prev };
          delete next[exampleNumber];
          return next;
        });
        alert("Metadata saved!");
      } else {
        const error = await res.json();
        alert(`Save failed: ${error.detail}`);
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Save failed");
    } finally {
      setSaving(null);
    }
  };

  const updateLocalMetadata = (exampleNumber: number, field: string, value: string) => {
    setEditingMetadata((prev) => ({
      ...prev,
      [exampleNumber]: {
        ...prev[exampleNumber],
        [field]: value,
      },
    }));
  };

  const togglePlay = async (url: string) => {
    console.log("Attempting to play URL:", url);
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        // Add cache-busting timestamp to ensure fresh audio
        const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        console.log("Cache-busted URL:", cacheBustedUrl);
        audioRef.current.src = cacheBustedUrl;
        audioRef.current.load(); // Force reload the audio
        try {
          await audioRef.current.play();
          setPlayingAudio(url);
        } catch (error) {
          console.error("Failed to play audio:", error);
          console.error("Tried URL:", cacheBustedUrl);
          alert(`Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}\n\nURL: ${url}`);
        }
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingAudio(null);
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    console.error("Audio error:", audio.error?.message, "Code:", audio.error?.code);
    setPlayingAudio(null);
    alert(`Audio playback error: ${audio.error?.message || 'Could not load audio file'}`);
  };

  const categoryAudios = getCategoryAudios();
  const maxNumber = Math.max(...categoryAudios.map(a => a.example_number), 0);

  // Get voices by type
  const maleVoices = voices.filter(v => v.type === "male");
  const femaleVoices = voices.filter(v => v.type === "female");
  const allVoices = voices; // For narrator (can be any voice)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audio Story Examples</h2>
          <p className="text-muted-foreground mt-1">
            Manage audio examples with text and voice selections
          </p>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} onError={handleAudioError} />

      {/* Speaker Mode Tabs */}
      <div className="flex gap-2 mb-4">
        {SPEAKER_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setActiveSpeaker(mode.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeSpeaker === mode.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Language Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {LANGUAGES.map((lang) => {
            const count = audios.filter(
              (a) => a.speaker_mode === activeSpeaker && a.language === lang.value
            ).length;
            return (
              <button
                key={lang.value}
                onClick={() => setActiveLanguage(lang.value)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeLanguage === lang.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {lang.label}
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
          <div className="grid grid-cols-1 gap-6">
            {Array.from({ length: Math.max(maxNumber, 3) }, (_, i) => i + 1).map((number) => {
              const audio = categoryAudios.find((a) => a.example_number === number);
              const isPlaying = audio && playingAudio === audio.url;
              const localMetadata = editingMetadata[number] || {};
              const hasChanges = Object.keys(localMetadata).length > 0;

              return (
                <div
                  key={number}
                  className="bg-card rounded-lg border border-border hover:border-primary/50 transition-all"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
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
                            {hasChanges && (
                              <button
                                onClick={() => handleSaveMetadata(audio, number)}
                                disabled={saving === number}
                                className="p-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                                title="Save Changes"
                              >
                                <Save className="w-5 h-5 text-white" />
                              </button>
                            )}
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
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                              }}
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {audio ? (
                      <div className="space-y-4">
                        {/* Audio Player */}
                        <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-3">
                          <Volume2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground text-sm font-medium truncate">{audio.filename}</p>
                            <p className="text-muted-foreground text-xs">
                              {activeSpeaker === "single-speaker" ? "Single" : "Multi"} Speaker • {activeLanguage}
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

                        {/* Text Input */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Example Text
                          </label>
                          <textarea
                            value={localMetadata.text ?? audio.text ?? ""}
                            onChange={(e) => updateLocalMetadata(number, "text", e.target.value)}
                            placeholder="Enter the text content for this audio example..."
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-y"
                          />
                        </div>

                        {/* Voice Selection */}
                        {activeSpeaker === "single-speaker" ? (
                          /* Single Speaker - One voice dropdown */
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Voice
                            </label>
                            <div className="relative">
                              <select
                                value={localMetadata.voice_name ?? audio.voice_name ?? ""}
                                onChange={(e) => updateLocalMetadata(number, "voice_name", e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                              >
                                <option value="">Select a voice...</option>
                                {allVoices.map((voice) => (
                                  <option key={voice.id} value={voice.name}>
                                    {voice.emoji || (voice.type === "male" ? "👨" : "👩")} {voice.name} - {voice.description}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>
                        ) : (
                          /* Multi Speaker - Three voice dropdowns */
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                🎭 Narrator Voice
                              </label>
                              <div className="relative">
                                <select
                                  value={localMetadata.narrator_voice ?? audio.narrator_voice ?? ""}
                                  onChange={(e) => updateLocalMetadata(number, "narrator_voice", e.target.value)}
                                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  <option value="">Select narrator...</option>
                                  {allVoices.map((voice) => (
                                    <option key={voice.id} value={voice.name}>
                                      {voice.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                👨 Male Voice
                              </label>
                              <div className="relative">
                                <select
                                  value={localMetadata.male_voice ?? audio.male_voice ?? ""}
                                  onChange={(e) => updateLocalMetadata(number, "male_voice", e.target.value)}
                                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  <option value="">Select male voice...</option>
                                  {maleVoices.map((voice) => (
                                    <option key={voice.id} value={voice.name}>
                                      {voice.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                👩 Female Voice
                              </label>
                              <div className="relative">
                                <select
                                  value={localMetadata.female_voice ?? audio.female_voice ?? ""}
                                  onChange={(e) => updateLocalMetadata(number, "female_voice", e.target.value)}
                                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  <option value="">Select female voice...</option>
                                  {femaleVoices.map((voice) => (
                                    <option key={voice.id} value={voice.name}>
                                      {voice.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>
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
                  if (file) handleFileSelect(file);
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
