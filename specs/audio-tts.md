# Audio / Text-to-Speech — Frontend UI

## API
- `POST /api/v1/audio/speech` (proxied to server port 3001)
- Body: `{ model: string, input: string, voice?: string, response_format?: string }`
- Response: Raw audio binary (audio/mpeg)
- Cost: ~1 credit per 1K tokens
- Auth: Bearer token

## UI Requirements
- Integrate into existing **Playground** chat page
- **Speak button**: Add a small speaker icon button to each assistant message
- **Voice selector**: Dropdown in settings sidebar to select voice
- **Audio player**: Inline HTML5 audio element that plays the TTS response
- Loading state while audio is being generated
- Error handling with toast

## File Changes
- `app/src/app/playground/page.tsx` — Add speak button and voice selector
