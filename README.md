# ComicFusion Admin Panel

Admin panel for managing S3 example images displayed on the main ComicFusion website.

## Features

- 📁 **View S3 Images** - Browse all example images organized by category
- ⬆️ **Upload Images** - Drag & drop or click to upload new images
- 🗑️ **Delete Images** - Remove images from S3
- 🏷️ **Category Management** - Manage images for Comic Translation, Art Restoration, Mobile Layout, Video Subtitles
- 🔄 **Real-time Updates** - Changes reflect immediately on the main website

## Quick Start

```bash
cd admin-panel
npm install
npm run dev
```

Open http://localhost:3001

## Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

- GET /admin/examples/categories
- GET /admin/examples/list
- POST /admin/examples/upload
- DELETE /admin/examples/delete/{category}/{type}/{filename}
