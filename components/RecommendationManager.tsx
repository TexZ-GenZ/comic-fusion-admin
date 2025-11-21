"use client"

import { useState, useEffect } from 'react'
import { Search, Plus, Trash2, Edit2, Save, X, ExternalLink } from 'lucide-react'

interface RecommendationManagerProps {
  credentials: { username: string; password: string }
}

interface CuratedItem {
  id: string
  source_id: string
  source_type: string
  title: string
  description: string
  coverImage: string
  targetUrl: string
  medium: string
  tags: string[]
  genres: string[]
  isActive: boolean
  priority: number
}

interface SearchResult {
  id: string
  source: string
  title: string
  description: string
  coverImage: string
  tags: string[]
  targetUrl: string
  rating?: number
  views?: number
  status?: string
}

export default function RecommendationManager({ credentials }: RecommendationManagerProps) {
  const [items, setItems] = useState<CuratedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSource, setSearchSource] = useState('mangadex')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [editingItem, setEditingItem] = useState<CuratedItem | SearchResult | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const authHeader = 'Basic ' + btoa(credentials.username + ':' + credentials.password)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/admin/curation/items`, {
        headers: { 'Authorization': authHeader }
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Failed to fetch items", error)
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async (query: string, source: string, pageNum: number = 1) => {
    setSearching(true)
    try {
      const res = await fetch(`${apiUrl}/admin/curation/search?query=${encodeURIComponent(query)}&source=${source}&page=${pageNum}`, {
        headers: { 'Authorization': authHeader }
      })
      if (res.ok) {
        const data = await res.json()
        if (pageNum === 1) {
          setSearchResults(data.results)
        } else {
          setSearchResults(prev => [...prev, ...data.results])
        }
        setHasMore(data.hasMore)
        setPage(pageNum)
      }
    } catch (error) {
      console.error("Search failed", error)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    fetchItems()
    performSearch('', 'mangadex', 1)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(searchQuery, searchSource, 1)
  }

  const loadMore = () => {
    performSearch(searchQuery, searchSource, page + 1)
  }

  const handleSelectResult = (result: SearchResult) => {
    setEditingItem({
      ...result,
      source_id: result.id,
      source_type: result.source,
      isActive: true,
      priority: 0,
      medium: result.source === 'mangadex' ? 'manga' : 'novel',
      genres: []
    } as any) // Type casting for simplicity
    setIsNew(true)
  }

  const handleEditItem = (item: CuratedItem) => {
    setEditingItem(item)
    setIsNew(false)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recommendation?")) return

    try {
      const res = await fetch(`${apiUrl}/admin/curation/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader }
      })
      if (res.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error("Delete failed", error)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    try {
      const endpoint = isNew ? `${apiUrl}/admin/curation/items` : `${apiUrl}/admin/curation/items/${(editingItem as CuratedItem).id}`
      const method = isNew ? 'POST' : 'PUT'
      
      const body = {
        ...editingItem,
        // Ensure arrays
        tags: Array.isArray(editingItem.tags) ? editingItem.tags : [],
        genres: Array.isArray((editingItem as any).genres) ? (editingItem as any).genres : []
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setEditingItem(null)
        setSearchResults([])
        setSearchQuery('')
        fetchItems()
      } else {
        alert("Failed to save item")
      }
    } catch (error) {
      console.error("Save failed", error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Curated Recommendations</h2>
        <button 
          onClick={() => { setSearchResults([]); setEditingItem(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add New
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Search for Comics</h3>
        <form onSubmit={handleSearch} className="flex gap-4 mb-6">
          <select 
            value={searchSource}
            onChange={(e) => {
              const newSource = e.target.value
              setSearchSource(newSource)
              if (!searchQuery) performSearch('', newSource)
            }}
            className="border rounded px-3 py-2"
          >
            <option value="mangadex">MangaDex</option>
            <option value="anilist">AniList</option>
          </select>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title..."
            className="flex-1 border rounded px-3 py-2"
          />
          <button 
            type="submit" 
            disabled={searching}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {searchResults.map((result) => (
                <div key={result.id} className="border rounded p-4 flex gap-4 hover:shadow-md transition-shadow">
                  <img src={result.coverImage} alt={result.title} className="w-24 h-36 object-cover rounded shadow-sm" />
                  <div className="flex-1 flex flex-col">
                    <h4 className="font-bold line-clamp-2 mb-1" title={result.title}>{result.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="uppercase px-1.5 py-0.5 bg-gray-100 rounded">{result.source}</span>
                      {result.rating && <span>★ {result.rating}%</span>}
                      {result.status && <span className="capitalize">• {result.status}</span>}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-3 mb-auto">{result.description}</p>
                    <div className="mt-3 flex justify-between items-center">
                      <div className="flex gap-1 flex-wrap">
                        {result.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">{tag}</span>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleSelectResult(result)}
                        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button 
                  onClick={loadMore}
                  disabled={searching}
                  className="px-6 py-2 border border-gray-300 rounded-full hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                >
                  {searching ? 'Loading...' : 'Load More Results'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{isNew ? 'Add Recommendation' : 'Edit Recommendation'}</h3>
                <button onClick={() => setEditingItem(null)}><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex gap-6">
                  <img src={editingItem.coverImage} alt="Cover" className="w-32 h-48 object-cover rounded shadow" />
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Title</label>
                      <input 
                        type="text" 
                        value={editingItem.title}
                        onChange={(e) => setEditingItem({...editingItem, title: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Medium</label>
                      <select 
                        value={(editingItem as CuratedItem).medium || 'manga'}
                        onChange={(e) => setEditingItem({...editingItem, medium: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="manga">Manga</option>
                        <option value="manhwa">Manhwa</option>
                        <option value="manhua">Manhua</option>
                        <option value="novel">Novel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Target URL (Deeplink)</label>
                      <div className="flex gap-2">
                        <input 
                          type="url" 
                          value={editingItem.targetUrl}
                          onChange={(e) => setEditingItem({...editingItem, targetUrl: e.target.value})}
                          className="w-full border rounded px-3 py-2"
                          required
                        />
                        <a href={editingItem.targetUrl} target="_blank" rel="noreferrer" className="p-2 border rounded hover:bg-gray-50">
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea 
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                    className="w-full border rounded px-3 py-2 h-32"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority (Higher shows first)</label>
                    <input 
                      type="number" 
                      value={(editingItem as CuratedItem).priority || 0}
                      onChange={(e) => setEditingItem({...editingItem, priority: parseInt(e.target.value)})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={(editingItem as CuratedItem).isActive !== false}
                        onChange={(e) => setEditingItem({...editingItem, isActive: e.target.checked})}
                        className="w-5 h-5"
                      />
                      <span className="font-medium">Active</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    value={editingItem.tags?.join(', ') || ''}
                    onChange={(e) => setEditingItem({...editingItem, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button 
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Recommendation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* List Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cover</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <img src={item.coverImage} alt="" className="h-12 w-8 object-cover rounded" />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{item.targetUrl}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {item.source_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.priority}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEditItem(item)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-900">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No curated recommendations yet. Use the search above to add some.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
