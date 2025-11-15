"use client"

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

interface S3Image {
  url: string
  filename: string
  size: number
  lastModified: string
  key: string
  category: string
  subcategory?: string  // japanese/korean/chinese or black-bars/white-bars/mosaic
  type: 'before' | 'after'
}

interface ImagePair {
  filename: string
  before?: S3Image
  after?: S3Image
}

interface ImageManagerProps {
  category: string
  categoryName: string
}

// Define subcategories for each category
const SUBCATEGORIES: Record<string, string[]> = {
  'comic-translation': ['japanese', 'korean', 'chinese'],
  'art-restoration': ['black-bars', 'white-bars', 'mosaic'],
  'mobile-layout': ['japanese', 'korean', 'chinese'],
}

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

export default function ImageManager({ category, categoryName }: ImageManagerProps) {
  const isVideo = category === 'video-subtitles'
  const [images, setImages] = useState<S3Image[]>([])
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState<'before' | 'after' | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [cacheKey, setCacheKey] = useState<number>(Date.now()) // For cache-busting
  const [viewerImage, setViewerImage] = useState<string | null>(null) // For image viewer
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)

  // Get subcategories for current category
  const subcategories = SUBCATEGORIES[category] || null

  // Set initial subcategory when category changes
  useEffect(() => {
    if (subcategories && subcategories.length > 0) {
      setSelectedSubcategory(subcategories[0])
    } else {
      setSelectedSubcategory(null)
    }
  }, [category])

  useEffect(() => {
    fetchImages()
  }, [category, selectedSubcategory])

  // Handle Escape key to close viewer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewerImage) {
        setViewerImage(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [viewerImage])

  useEffect(() => {
    // Group images into pairs by matching numbers
    // before/1.jpg -> after/1.jpg
    // before/2.jpg -> after/2.jpg
    
    const beforeImages = images.filter(img => img.type === 'before')
    const afterImages = images.filter(img => img.type === 'after')
    
    // Extract number from filename (e.g., "1.jpg" -> 1)
    const getImageNumber = (filename: string): number => {
      const match = filename.match(/^(\d+)\./)
      return match ? parseInt(match[1], 10) : -1
    }
    
    // Create a map of number -> images
    const beforeMap = new Map<number, S3Image>()
    const afterMap = new Map<number, S3Image>()
    
    beforeImages.forEach(img => {
      const num = getImageNumber(img.filename)
      if (num > 0) beforeMap.set(num, img)
    })
    
    afterImages.forEach(img => {
      const num = getImageNumber(img.filename)
      if (num > 0) afterMap.set(num, img)
    })
    
    // Get all unique numbers
    const allNumbers = new Set([...beforeMap.keys(), ...afterMap.keys()])
    
    // Create pairs
    const pairs: ImagePair[] = Array.from(allNumbers)
      .sort((a, b) => a - b)
      .map(num => ({
        filename: `${num}`,
        before: beforeMap.get(num),
        after: afterMap.get(num),
      }))
    
    setImagePairs(pairs)
  }, [images])

  const fetchImages = async () => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/admin/examples/list`, {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      
      // Filter images for current category and subcategory
      let categoryImages = data.images.filter((img: S3Image) => img.category === category)
      
      // Further filter by subcategory if one is selected
      if (selectedSubcategory) {
        categoryImages = categoryImages.filter((img: S3Image) => img.subcategory === selectedSubcategory)
      }
      
      setImages(categoryImages)
      setCacheKey(Date.now()) // Update cache key to bust browser cache
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File, imageType: 'before' | 'after') => {
    setUploading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)
      formData.append('image_type', imageType)
      
      // Add subcategory if one is selected
      if (selectedSubcategory) {
        formData.append('subcategory', selectedSubcategory)
      }

      const response = await fetch(`${apiUrl}/admin/examples/upload`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders()
      })

      if (response.ok) {
        await fetchImages()
        alert(`${isVideo ? 'Video' : 'Image'} uploaded successfully!`)
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.detail}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (img: S3Image) => {
    if (!confirm(`Delete ${img.filename}?`)) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      // Build the delete path based on whether subcategory exists
      // Path format: category/subcategory/type/filename or category/type/filename
      let deletePath: string
      if (img.subcategory) {
        deletePath = `${img.category}/${img.subcategory}/${img.type}/${img.filename}`
      } else {
        deletePath = `${img.category}/${img.type}/${img.filename}`
      }
      
      const response = await fetch(
        `${apiUrl}/admin/examples/delete/${deletePath}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      )

      if (response.ok) {
        await fetchImages()
        alert('Image deleted successfully!')
      } else {
        const error = await response.json()
        alert(`Delete failed: ${error.detail}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Delete failed')
    }
  }

  const handleDrag = (e: React.DragEvent, type?: 'before' | 'after') => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type || null)
    } else if (e.type === "dragleave") {
      setDragActive(null)
    }
  }

  const handleDrop = (e: React.DragEvent, imageType: 'before' | 'after') => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(null)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0], imageType)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, imageType: 'before' | 'after') => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0], imageType)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Image Viewer Modal */}
      {viewerImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setViewerImage(null)}
        >
          <button
            onClick={() => setViewerImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-background/90 hover:bg-background text-foreground transition-colors"
            title="Close (Esc)"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div 
            className="max-w-7xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={viewerImage} 
              alt="Full size preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Subcategory Tabs (if applicable) */}
      {subcategories && subcategories.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Subcategory</h3>
          <div className="flex flex-wrap gap-2">
            {subcategories.map((subcat) => (
              <button
                key={subcat}
                onClick={() => setSelectedSubcategory(subcat)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedSubcategory === subcat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground hover:border-primary/50'
                }`}
              >
                {subcat.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Upload New {isVideo ? 'Video' : 'Image'} Pair</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Before Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Before {isVideo ? 'Video' : 'Image'}</label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                dragActive === 'before' 
                  ? 'border-primary bg-primary/10 scale-[1.02]' 
                  : 'border-border hover:border-primary/50 hover:bg-accent/5'
              }`}
              onClick={() => beforeInputRef.current?.click()}
              onDragEnter={(e) => handleDrag(e, 'before')}
              onDragLeave={(e) => handleDrag(e)}
              onDragOver={(e) => handleDrag(e, 'before')}
              onDrop={(e) => handleDrop(e, 'before')}
            >
              <svg className="mx-auto h-10 w-10 text-muted-foreground mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium text-foreground">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">{isVideo ? 'MP4, WebM up to 50MB' : 'PNG, JPG up to 10MB'}</p>
            </div>
            <input
              ref={beforeInputRef}
              type="file"
              className="hidden"
              accept={isVideo ? 'video/*' : 'image/*'}
              onChange={(e) => handleFileInput(e, 'before')}
              disabled={uploading}
            />
          </div>

          {/* After Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">After {isVideo ? 'Video' : 'Image'}</label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                dragActive === 'after' 
                  ? 'border-primary bg-primary/10 scale-[1.02]' 
                  : 'border-border hover:border-primary/50 hover:bg-accent/5'
              }`}
              onClick={() => afterInputRef.current?.click()}
              onDragEnter={(e) => handleDrag(e, 'after')}
              onDragLeave={(e) => handleDrag(e)}
              onDragOver={(e) => handleDrag(e, 'after')}
              onDrop={(e) => handleDrop(e, 'after')}
            >
              <svg className="mx-auto h-10 w-10 text-muted-foreground mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium text-foreground">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">{isVideo ? 'MP4, WebM up to 50MB' : 'PNG, JPG up to 10MB'}</p>
            </div>
            <input
              ref={afterInputRef}
              type="file"
              className="hidden"
              accept={isVideo ? 'video/*' : 'image/*'}
              onChange={(e) => handleFileInput(e, 'after')}
              disabled={uploading}
            />
          </div>
        </div>
        <div className="mt-4 p-3 bg-accent/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground flex items-start">
            <svg className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>Automatic Numbering:</strong> Uploaded images are automatically numbered (1.jpg, 2.jpg, etc.). Before and after images with the same number are paired together (before/1.jpg ↔ after/1.jpg).
            </span>
          </p>
        </div>
      </div>

      {/* Image Pairs Grid */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            {isVideo ? 'Video' : 'Image'} Pairs ({imagePairs.length})
          </h2>
          <span className="text-sm text-muted-foreground">
            Showing pairs for <span className="font-medium text-foreground">{categoryName}</span>
          </span>
        </div>

        {imagePairs.length > 0 ? (
          <div className="space-y-6">
            {imagePairs.map((pair, index) => (
              <div key={`pair-${pair.filename}`} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mr-2">
                      {pair.filename}
                    </span>
                    Image Pair #{pair.filename}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {pair.before && pair.after ? (
                      <span className="inline-flex items-center text-green-600 dark:text-green-400">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-yellow-600 dark:text-yellow-400">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Incomplete
                      </span>
                    )}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Before Image */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Before</span>
                    </div>
                    {pair.before ? (
                      <div className="relative group">
                        <div 
                          className="aspect-video rounded-lg overflow-hidden bg-muted border border-border cursor-pointer hover:border-primary transition-colors"
                          onClick={() => !isVideo && setViewerImage(`${pair.before!.url}?v=${cacheKey}`)}
                        >
                          {isVideo ? (
                            <video
                              src={`${pair.before.url}?v=${cacheKey}`}
                              className="object-cover w-full h-full"
                              controls
                              loop
                              muted
                            />
                          ) : (
                            <>
                              <Image
                                src={`${pair.before.url}?v=${cacheKey}`}
                                alt={pair.before.filename}
                                width={400}
                                height={300}
                                className="object-cover w-full h-full"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <svg className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{pair.before.filename}</p>
                            <p className="text-xs text-muted-foreground">{(pair.before.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(pair.before!)
                            }}
                            className="ml-2 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors flex items-center relative z-10"
                            title="Delete before image"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="aspect-video rounded-lg bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-all"
                        onClick={() => beforeInputRef.current?.click()}
                      >
                        <svg className="h-8 w-8 text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-sm text-muted-foreground">Click to upload before image</p>
                      </div>
                    )}
                  </div>

                  {/* After Image */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">After</span>
                    </div>
                    {pair.after ? (
                      <div className="relative group">
                        <div 
                          className="aspect-video rounded-lg overflow-hidden bg-muted border border-border cursor-pointer hover:border-primary transition-colors"
                          onClick={() => !isVideo && setViewerImage(`${pair.after!.url}?v=${cacheKey}`)}
                        >
                          {isVideo ? (
                            <video
                              src={`${pair.after.url}?v=${cacheKey}`}
                              className="object-cover w-full h-full"
                              controls
                              loop
                              muted
                            />
                          ) : (
                            <>
                              <Image
                                src={`${pair.after.url}?v=${cacheKey}`}
                                alt={pair.after.filename}
                                width={400}
                                height={300}
                                className="object-cover w-full h-full"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <svg className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{pair.after.filename}</p>
                            <p className="text-xs text-muted-foreground">{(pair.after.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(pair.after!)
                            }}
                            className="ml-2 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors flex items-center relative z-10"
                            title="Delete after image"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="aspect-video rounded-lg bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-all"
                        onClick={() => afterInputRef.current?.click()}
                      >
                        <svg className="h-8 w-8 text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-sm text-muted-foreground">Click to upload after image</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-muted-foreground mb-2">No {isVideo ? 'video' : 'image'} pairs yet</p>
            <p className="text-sm text-muted-foreground">Upload your first before/after {isVideo ? 'videos' : 'images'} above to get started</p>
          </div>
        )}
      </div>

      {uploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 flex items-center space-x-4 shadow-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="text-foreground">Uploading...</p>
          </div>
        </div>
      )}
    </div>
  )
}
