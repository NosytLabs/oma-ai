# Image Generation — Frontend UI

## API
- `POST /api/v1/images/generations` (proxied to server port 3001)
- Body: `{ model: string, prompt: string, n?: number (1-4), size?: string }`
- Response: `{ data: [{ url: string }] }`
- Credit cost: 5 credits per image (flat rate)
- Auth: Bearer token (`oma_sk_...`)

## UI Requirements
- Dedicated image generation page at `/image-generation`
- Clean, centered layout matching existing app design language
- **Prompt input**: Large textarea with placeholder text
- **Model selector**: Dropdown showing available image models (SDXL default)
- **Size selector**: Options for square (1024x1024), portrait (1024x1536), landscape (1536x1024)
- **Image count**: 1-4 selector
- **Generate button**: Prominent CTA button with loading spinner during generation
- **Result gallery**: Grid of generated images with download buttons
- **Error state**: Toast notification on failure
- **Empty state**: Prompt user to enter a prompt

## File Structure
- `app/src/app/image-generation/page.tsx` — Main page
