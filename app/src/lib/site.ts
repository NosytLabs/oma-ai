const SITE_URL =
	(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") ||
	"https://www.oma-ai.com";

export default SITE_URL;
