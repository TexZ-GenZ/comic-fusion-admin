"use client"

import { useEffect, useState } from 'react'
import ImageManager from '@/components/ImageManager'
import AudioManager from '@/components/AudioManager'
import LoginPage from '@/components/LoginPage'

interface Category {
  id: string
  name: string
  description: string
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string>('')
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)

  useEffect(() => {
    // Check if already authenticated (credentials in sessionStorage)
    const savedCreds = sessionStorage.getItem('admin_auth')
    if (savedCreds) {
      try {
        const parsed = JSON.parse(savedCreds)
        setCredentials(parsed)
        setIsAuthenticated(true)
      } catch (e) {
        sessionStorage.removeItem('admin_auth')
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAuthenticated && credentials) {
      fetchCategories()
    }
  }, [isAuthenticated, credentials])

  const handleLogin = async (username: string, password: string) => {
    setAuthError('')
    setLoading(true)
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      // Test authentication by calling the categories endpoint
      const authHeader = 'Basic ' + btoa(`${username}:${password}`)
      const response = await fetch(`${apiUrl}/admin/examples/categories`, {
        headers: {
          'Authorization': authHeader
        }
      })
      
      if (response.status === 401) {
        setAuthError('Invalid username or password')
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        setAuthError('Authentication failed')
        setLoading(false)
        return
      }

      // Save credentials
      const creds = { username, password }
      setCredentials(creds)
      sessionStorage.setItem('admin_auth', JSON.stringify(creds))
      setIsAuthenticated(true)
    } catch (error) {
      console.error('Login error:', error)
      setAuthError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCredentials(null)
    sessionStorage.removeItem('admin_auth')
    setCategories([])
    setSelectedCategory('')
  }

  const fetchCategories = async () => {
    if (!credentials || !isAuthenticated) {
      console.log('Skipping fetchCategories: not authenticated')
      return
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const authHeader = 'Basic ' + btoa(`${credentials.username}:${credentials.password}`)
      
      const response = await fetch(`${apiUrl}/admin/examples/categories`, {
        headers: {
          'Authorization': authHeader
        }
      })
      
      if (response.status === 401) {
        handleLogout()
        return
      }
      
      const data = await response.json()
      setCategories(data.categories || [])
      if (data.categories && data.categories.length > 0) {
        setSelectedCategory(data.categories[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      setCategories([])
    }
  }

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} error={authError} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">ComicFusion Admin</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage S3 Examples</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Logged in as <span className="font-medium text-foreground">{credentials?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-border"
              >
                Logout
              </button>
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
        {categories && categories.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading categories...</p>
          </div>
        )}
      </main>
    </div>
  )
}
