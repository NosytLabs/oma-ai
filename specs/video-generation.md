# Video Generation — Frontend UI

## API
- `POST /api/v1/videos/generations` (proxied to server port 3001)
  - Body: `{ model: string, prompt: string, duration?: string, aspect_ratio?: string, resolution?: string, image_url?: string }`
  - Response: `{ id: string, object: "video", status: "processing", queue_id: string }`
- `GET /api/v1/videos/retrieve?queue_id=<id>`
  - Response: `{ id: string, object: "video", status: "completed"|"processing", video_url?: string }`
- Video models: seedance-2-0-text-to-video, seedance-2-0-image-to-video, kling-v3-pro-text-to-video, kling-v3-pro-image-to-video, grok-imagine-text-to-video
- Auth: Bearer token

## UI Requirements
- Dedicated video generation page at `/video-generation`
- **Prompt input**: Large textarea with placeholder
- **Model selector**: Dropdown with all 5 video models, grouped by provider
- **Mode tabs**: Text-to-Video / Image-to-Video tabs (controls which params shown)
- **Image upload** (for image-to-video): Drag-and-drop zone or file picker, preview of uploaded image
- **Aspect ratio selector**: 16:9, 9:16, 1:1
- **Duration selector**: 5s, 10s (if supported)
- **Resolution selector**: HD, Full HD
- **Generate button**: CTA with loading state
- **Async polling**: After submission, show "Processing..." state with animated spinner. Poll GET retrieve every 3s until status="completed"
- **Video player**: HTML5 video element with controls when complete
- **Download button**: Download completed video
- **Error handling**: Toast on failure, timeout after 120s polling
- **Empty state**: Prompt to enter a prompt

## File Structure
- `app/src/app/video-generation/page.tsx` — Main page
