import * as http from "http";
import * as https from "https";

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 60000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 60000 });

// Setting global agents for connection pooling
Object.defineProperty(http, "globalAgent", {
  value: httpAgent,
  writable: true,
  configurable: true,
});
Object.defineProperty(https, "globalAgent", {
  value: httpsAgent,
  writable: true,
  configurable: true,
});

export function getAgent(isHttps: boolean): http.Agent {
  return isHttps ? httpsAgent : httpAgent;
}