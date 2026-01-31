"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Upload, Trash2, Play, Pause, Plus, X, GripVertical, Check, Pencil } from "lucide-react"

interface Voice {
  id: string
  name: string
  description: string
  type: "male" | "female"
  language: string
  emoji?: string
  sample_key?: string
  preview_url?: string
  is_active: boolean
  priority: number
}

interface VoiceListResponse {
  voices: Voice[]
  total: number
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ta", name: "Tamil" },
]

const VOICE_TYPES = [
  { value: "male", label: "Male", emoji: "👨" },
  { value: "female", label: "Female", emoji: "👩" },
]

function getAuthHeaders(): Record<string, string> {
  const savedCreds = sessionStorage.getItem("admin_auth")
  if (!savedCreds) return {}
  try {
    const { username, password } = JSON.parse(savedCreds)
    return { Authorization: "Basic " + btoa(`${username}:${password}`) }
  } catch {
    return {}
  }
}

export default function VoiceManager() {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en")
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingVoice, setEditingVoice] = useState<Voice | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchVoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/admin/examples/voices?language=${selectedLanguage}`, {
        headers: getAuthHeaders(),
      })
      const data: VoiceListResponse = await res.json()
      // Sort by priority
      const sorted = [...data.voices].sort((a, b) => a.priority - b.priority)
      setVoices(sorted)
    } catch (error) {
      console.error("Failed to fetch voices:", error)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, selectedLanguage])

  useEffect(() => {
    fetchVoices()
  }, [fetchVoices])

  const togglePlay = (voice: Voice) => {
    if (!voice.preview_url) return
    if (playingVoice === voice.id) {
      audioRef.current?.pause()
      setPlayingVoice(null)
    } else {
      if (audioRef.current) {
        audioRef.current.src = voice.preview_url
        audioRef.current.play()
        setPlayingVoice(voice.id)
      }
    }
  }

  const handleAudioEnded = () => setPlayingVoice(null)

  const handleDelete = async (voice: Voice) => {
    if (!confirm(`Delete voice "${voice.name}"? This will also delete the audio file.`)) return
    try {
      const res = await fetch(`${apiUrl}/admin/examples/voices/${voice.language}/${voice.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        fetchVoices()
      } else {
        const error = await res.json()
        alert(`Delete failed: ${error.detail}`)
      }
    } catch (error) {
      console.error("Delete failed:", error)
    }
  }

  const handleToggleActive = async (voice: Voice) => {
    try {
      await fetch(`${apiUrl}/admin/examples/voices/${voice.language}/${voice.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !voice.is_active }),
      })
      fetchVoices()
    } catch (error) {
      console.error("Toggle active failed:", error)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const persistVoiceOrder = async (orderedVoices: Voice[]) => {
    try {
      await Promise.all(
        orderedVoices.map((voice, index) =>
          fetch(`${apiUrl}/admin/examples/voices/${voice.language}/${voice.id}`, {
            method: "PUT",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ priority: index }),
          }),
        ),
      )
      fetchVoices()
    } catch (error) {
      console.error("Failed to persist voice order:", error)
    }
  }

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newVoices = [...voices]
    const [draggedVoice] = newVoices.splice(draggedIndex, 1)
    newVoices.splice(index, 0, draggedVoice)

    const reordered = newVoices.map((voice, idx) => ({
      ...voice,
      priority: idx,
    }))

    setVoices(reordered)
    void persistVoiceOrder(reordered)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleVoiceCreated = () => {
    setShowCreateModal(false)
    fetchVoices()
  }

  const handleVoiceUpdated = () => {
    setEditingVoice(null)
    fetchVoices()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">{voices.length} voices</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Voice
          </button>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* Voice list */}
      {loading ? (
        <div className="text-center py-8">Loading voices...</div>
      ) : voices.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium">No voices for {LANGUAGES.find(l => l.code === selectedLanguage)?.name}</p>
          <p className="text-sm mt-2">Click &quot;Add Voice&quot; to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">Drag to reorder. Priority is set automatically based on position.</p>
          {voices.map((voice, index) => (
            <div
              key={`${voice.language}-${voice.id}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`p-4 border rounded-lg flex items-center gap-4 transition-all cursor-move ${
                voice.is_active ? "bg-white dark:bg-gray-800" : "bg-gray-100 dark:bg-gray-900 opacity-60"
              } ${dragOverIndex === index ? "border-blue-500 border-2" : "border-gray-200"} ${
                draggedIndex === index ? "opacity-50" : ""
              }`}
            >
              {/* Drag handle */}
              <div className="text-gray-400 cursor-grab active:cursor-grabbing">
                <GripVertical size={20} />
              </div>

              {/* Position number */}
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </div>

              {/* Play button */}
              <button
                onClick={() => togglePlay(voice)}
                disabled={!voice.preview_url}
                className={`p-2 rounded-full flex-shrink-0 ${
                  voice.preview_url
                    ? "bg-blue-100 hover:bg-blue-200 text-blue-600"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {playingVoice === voice.id ? <Pause size={18} /> : <Play size={18} />}
              </button>

              {/* Voice info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{voice.emoji || "🎙️"}</span>
                  <span className="font-medium">{voice.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {voice.id}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    voice.type === "male" ? "bg-blue-100 text-blue-700" :
                    "bg-pink-100 text-pink-700"
                  }`}>
                    {voice.type}
                  </span>
                  {!voice.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{voice.description}</p>
                {!voice.sample_key && (
                  <p className="text-xs text-orange-500 mt-1">⚠️ No audio uploaded</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingVoice(voice)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => handleToggleActive(voice)}
                  className={`p-2 rounded transition-colors ${
                    voice.is_active
                      ? "text-green-600 hover:bg-green-50"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                  title={voice.is_active ? "Active - click to deactivate" : "Inactive - click to activate"}
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => handleDelete(voice)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateVoiceModal
          language={selectedLanguage}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleVoiceCreated}
          apiUrl={apiUrl}
          nextPriority={voices.length}
        />
      )}

      {editingVoice && (
        <EditVoiceModal
          voice={editingVoice}
          onClose={() => setEditingVoice(null)}
          onUpdated={handleVoiceUpdated}
          apiUrl={apiUrl}
        />
      )}
    </div>
  )
}

function CreateVoiceModal({
  language,
  onClose,
  onCreated,
  apiUrl,
  nextPriority,
}: {
  language: string
  onClose: () => void
  onCreated: () => void
  apiUrl: string
  nextPriority: number
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"male" | "female">("male")
  const [id, setId] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-generate ID from name (live suggestion)
  const suggestedId = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50)

  useEffect(() => {
    setId((current) => (current ? current : suggestedId))
  }, [suggestedId])

  // Auto-select emoji based on type
  const emoji = VOICE_TYPES.find(t => t.value === type)?.emoji || "🎙️"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!description.trim()) {
      setError("Description is required")
      return
    }
    if (!id.trim()) {
      setError("Invalid name - cannot generate ID")
      return
    }

    setSaving(true)
    try {
      // Step 1: Create voice
      const createRes = await fetch(`${apiUrl}/admin/examples/voices`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          name: name.trim(),
          description: description.trim(),
          type,
          language,
          emoji,
          is_active: isActive,
          priority: nextPriority,
        }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json()
        throw new Error(errData.detail || "Failed to create voice")
      }

      // Step 2: Upload audio if provided
      if (audioFile) {
        const formData = new FormData()
        formData.append("file", audioFile)

        const uploadRes = await fetch(
          `${apiUrl}/admin/examples/voices/${language}/${id.trim()}/upload`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
          }
        )

        if (!uploadRes.ok) {
          const errData = await uploadRes.json()
          console.error("Audio upload failed:", errData)
          // Voice created but audio failed - still consider it success
          alert("Voice created but audio upload failed. You can upload audio later.")
        }
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create voice")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">
              Add Voice - {LANGUAGES.find(l => l.code === language)?.name}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Sarah"
                required
              />
            </div>

            {/* ID */}
            <div>
              <label className="block text-sm font-medium mb-1">ID *</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={suggestedId || "e.g., sarah"}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Suggested: {suggestedId || "(enter a name to generate)"}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Warm and friendly narrator"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <div className="flex gap-2">
                {VOICE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as typeof type)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                      type === t.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span className="text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Upload */}
            <div>
              <label className="block text-sm font-medium mb-1">Audio Preview (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              
              {!audioFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Upload audio file
                </button>
              ) : (
                <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900 space-y-3">
                  {/* File info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Play size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{audioFile.name}</p>
                        <p className="text-xs text-gray-500">{(audioFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null)
                        // Reset the file input so the same file can be selected again
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Audio preview player */}
                  <audio
                    controls
                    src={URL.createObjectURL(audioFile)}
                    className="w-full h-10"
                    style={{ borderRadius: "8px" }}
                  />
                  
                  {/* Change file button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Upload size={14} />
                    Change file
                  </button>
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm">
                Active (visible to users)
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Voice
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function EditVoiceModal({
  voice,
  onClose,
  onUpdated,
  apiUrl,
}: {
  voice: Voice
  onClose: () => void
  onUpdated: () => void
  apiUrl: string
}) {
  const [id, setId] = useState(voice.id)
  const [name, setName] = useState(voice.name)
  const [description, setDescription] = useState(voice.description)
  const [type, setType] = useState<"male" | "female">(voice.type)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isActive, setIsActive] = useState(voice.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const emoji = VOICE_TYPES.find(t => t.value === type)?.emoji || voice.emoji || "🎙️"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!id.trim()) {
      setError("ID is required")
      return
    }
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!description.trim()) {
      setError("Description is required")
      return
    }

    setSaving(true)
    try {
      const updateRes = await fetch(`${apiUrl}/admin/examples/voices/${voice.language}/${voice.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          name: name.trim(),
          description: description.trim(),
          type,
          emoji,
          is_active: isActive,
        }),
      })

      if (!updateRes.ok) {
        const errData = await updateRes.json()
        throw new Error(errData.detail || "Failed to update voice")
      }

      if (audioFile) {
        const formData = new FormData()
        formData.append("file", audioFile)

        const uploadRes = await fetch(
          `${apiUrl}/admin/examples/voices/${voice.language}/${id.trim()}/upload`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
          },
        )

        if (!uploadRes.ok) {
          const errData = await uploadRes.json()
          console.error("Audio upload failed:", errData)
          alert("Voice updated but audio upload failed. You can retry the upload.")
        }
      }

      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update voice")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">
              Edit Voice - {LANGUAGES.find(l => l.code === voice.language)?.name}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">ID *</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Changing ID updates the record and upload path.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Sarah"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Warm and friendly narrator"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <div className="flex gap-2">
                {VOICE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as typeof type)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                      type === t.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span className="text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Audio Preview (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              {!audioFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Upload new audio file
                </button>
              ) : (
                <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Play size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{audioFile.name}</p>
                        <p className="text-xs text-gray-500">{(audioFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <audio
                    controls
                    src={URL.createObjectURL(audioFile)}
                    className="w-full h-10"
                    style={{ borderRadius: "8px" }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Upload size={14} />
                    Change file
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="edit_is_active" className="text-sm">
                Active (visible to users)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
