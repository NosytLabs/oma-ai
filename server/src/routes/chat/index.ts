import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { chatCompletionsRouter } from "./chat-completions.js";
import { completionsRouter } from "./completions.js";
import { embeddingsRouter } from "./embeddings.js";
import { imagesRouter } from "./images.js";
import { audioRouter } from "./audio.js";
import { videoRouter } from "./video.js";

export const chatRoutes = new Hono<OmaEnv>();

chatRoutes.route("/", chatCompletionsRouter);
chatRoutes.route("/", completionsRouter);
chatRoutes.route("/", embeddingsRouter);
chatRoutes.route("/", imagesRouter);
chatRoutes.route("/", audioRouter);
chatRoutes.route("/", videoRouter);
