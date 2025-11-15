"use client"

import { useEffect, useState } from 'react'
import ImageManager from '@/components/ImageManager'
import AudioManager from '@/components/AudioManager'

interface Category {
  id: string
  name: string
  description: string
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/admin/examples/categories`)
      const data = await response.json()
      setCategories(data.categories)
      if (data.categories.length > 0) {
        setSelectedCategory(data.categories[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">ComicFusion Admin</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage S3 Examples</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <span className="h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                Backend Connected
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Tabs */}
        <div className="mb-6">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${selectedCategory === category.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Manager */}
        {selectedCategory === 'audio-story' ? (
          <AudioManager />
        ) : selectedCategory ? (
          <ImageManager 
            category={selectedCategory}
            categoryName={categories.find(c => c.id === selectedCategory)?.name || ''}
          />
        ) : null}
      </main>
    </div>
  )
}
