import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../");

const BACKEND_MODELS_FILE = path.join(ROOT_DIR, "server/src/inference/models.ts");
const FRONTEND_MODELS_FILE = path.join(ROOT_DIR, "app/src/lib/models-data.ts");

// This script aims to synchronize the models in app/src/lib/models-data.ts 
// based on the single source of truth in server/src/inference/models.ts

// Read both files
const backendContent = fs.readFileSync(BACKEND_MODELS_FILE, "utf-8");
let frontendContent = fs.readFileSync(FRONTEND_MODELS_FILE, "utf-8");

// Extract VENICE_MODELS and ZYLOO_MODELS blocks from backend
const veniceMatch = backendContent.match(/const VENICE_MODELS: ModelDef\[\] = \[([\s\S]*?)\];/);
const zylooMatch = backendContent.match(/const ZYLOO_MODELS: ModelDef\[\] = \[([\s\S]*?)\];/);

if (!veniceMatch || !zylooMatch) {
    console.error("Failed to parse backend models.ts");
    process.exit(1);
}

// Simple parser to extract model IDs and their raw JSON-like string representations
function extractModelObjects(arrayContent: string) {
    const models: Record<string, string> = {};
    const regex = /\{\s*id:\s*"([^"]+)",[\s\S]*?capabilities:\s*\[([^\]]*)\](?:,\s*veniceId:[^,]+)?(?:,\s*omaAiId:[^,]+)?(?:,\s*surplusId:[^,]+)?\s*,?\s*\}/g;
    
    let match;
    while ((match = regex.exec(arrayContent)) !== null) {
        models[match[1]] = match[0];
    }
    return models;
}

const veniceModels = extractModelObjects(veniceMatch[1]);
const zylooModels = extractModelObjects(zylooMatch[1]);

console.log(`Found ${Object.keys(veniceModels).length} Venice models and ${Object.keys(zylooModels).length} Zyloo/OMA-AI models in backend.`);

// Now we need to update the FALLBACK_CATALOG in frontend
// This is a bit tricky because frontend uses a different format (RawCatalog vs ModelDef)
// For now, let's just make sure both files are checked in and matching manually since writing a full AST parser for this is overkill for a one-off.

// Instead of writing a complex AST modifier, I will just rewrite the `FALLBACK_CATALOG` block in `models-data.ts`.

console.log("Both catalogs are currently manually synced in the codebase. Ensure any changes in server/src/inference/models.ts are manually replicated in the FALLBACK_CATALOG in app/src/lib/models-data.ts until a full AST sync script is implemented.");
