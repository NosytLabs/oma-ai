import { Hono } from "hono";
import { randomBytes, timingSafeEqual, createHash as nodeCreateHash } from "node:crypto";
import { requireTeamRole } from "../middleware/rbac.js";
import { db } from "../db/client.js";
import { ssoConnections, teamMembers, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateSessionToken, getOrCreateUser } from "../auth/siwe.js";
import { config } from "../config.js";
import { getRedisClient } from "../lib/redis-client.js";
import { XMLParser } from "fast-xml-parser";

export const ssoRouter = new Hono<{ Variables: { user: { id: string }, teamRole?: string } }>();

const SUPPORTED_PROVIDERS = ["okta", "azure-ad", "google-workspace"] as const;

function base64Decode(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractSamlAttributes(xml: string): { email: string | null; domain: string | null; nameId: string | null; attributes: Record<string, string> } {
   const result: { email: string | null; domain: string | null; nameId: string | null; attributes: Record<string, string> } = {
     email: null,
     domain: null,
     nameId: null,
     attributes: {},
   };

   try {
      const xmlParser = new XMLParser({
        attributeNamePrefix: "",
        textNodeName: "#text",
        ignoreAttributes: false,
        removeNSPrefix: false,
        allowBooleanAttributes: false,
        parseTagValue: true,
        parseAttributeValue: true,
        trimValues: true,
        cdataPropName: false,
        stopNodes: ["parser-error"]
      });
      const parsed = xmlParser.parse(xml);

       // Extract attributes from Saml2Attribute or saml:Attribute
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       const extractAttributes = (obj: any): Record<string, string> => {
         const attrs: Record<string, string> = {};
         if (!obj) return attrs;
         
         // Handle both saml:Attribute and saml2:Attribute
         const attributes = obj["saml:Attribute"] || obj["saml2:Attribute"] || obj.Attribute || [];
         const attrArray = Array.isArray(attributes) ? attributes : [attributes];
         
         for (const attr of attrArray) {
           if (attr && attr["$"] && attr["$"]["Name"]) {
             const name = attr["$"]["Name"];
             const value = attr["saml:AttributeValue"] || attr["saml2:AttributeValue"] || attr["AttributeValue"] || "";
             attrs[name] = typeof value === "string" ? value : String(value);
           }
         }
         
         return attrs;
       };

     // Extract NameID
     const nameId = parsed["saml:NameID"] || parsed["saml2:NameID"] || parsed.NameID || null;
     result.nameId = typeof nameId === "string" ? nameId : null;

     // Extract attributes
     result.attributes = extractAttributes(parsed);

     // Extract email from attributes or NameID
     result.email = result.attributes.Email || result.attributes.EmailAddress || result.nameId || null;

     // Extract domain from email or attributes
     if (result.email && typeof result.email === "string") {
       const emailParts = result.email.split("@");
       if (emailParts.length === 2) {
         result.domain = emailParts[1];
       }
     } else if (result.attributes.Domain) {
       result.domain = result.attributes.Domain;
     }

   } catch (err) {
     // If XML parsing fails, fall back to regex-based extraction for backward compatibility
     console.warn("[SECURITY] XML parsing failed, falling back to regex extraction:", err);
     
     const emailMatch = xml.match(/<saml(?:2)?:Attribute\s+Name="[^"]*email[^"]*"\s*>[\s\S]*?<saml(?:2)?:AttributeValue[^>]*>([^<]+)<\/saml(?:2)?:AttributeValue>/i);
     const domainMatch = xml.match(/<saml(?:2)?:Attribute\s+Name="[^"]*domain[^"]*"\s*>[\s\S]*?<saml(?:2)?:AttributeValue[^>]*>([^<]+)<\/saml(?:2)?:AttributeValue>/i);
     const nameIdMatch = xml.match(/<saml(?:2)?:NameID[^>]*>([^<]+)<\/saml(?:2)?:NameID>/i);
     const emailAttrMatch = xml.match(/<(?:saml2:AttributeValue|saml:AttributeValue)[^>]*>([^<]+@[^<]+)<\/(?:saml2:AttributeValue|saml:AttributeValue)>/i);

     result.email = emailMatch?.[1] || nameIdMatch?.[1] || emailAttrMatch?.[1] || null;
     result.domain = domainMatch?.[1] || null;
     result.nameId = nameIdMatch?.[1] || null;
   }

   return result;
 }

async function validateSamlSignature(xml: string, certificate: string | null): Promise<boolean> {
  if (!certificate) {
    console.warn("[SECURITY] SAML signature validation skipped: no certificate configured for connection. Rejecting unvalidated response.");
    return false;
  }

  try {
    const signatureMatch = xml.match(/<ds:Signature[^>]*>[\s\S]*?<\/ds:Signature>/);
    if (!signatureMatch) {
      console.warn("[SECURITY] SAML response contains no XML signature. Rejecting unvalidated response.");
      return false;
    }

    const sigValueMatch = signatureMatch[0].match(/<ds:SignatureValue[^>]*>([^<]+)<\/ds:SignatureValue>/i);
    if (!sigValueMatch || !sigValueMatch[1]?.trim()) {
      console.warn("[SECURITY] SAML signature has no SignatureValue element. Rejecting.");
      return false;
    }

    const certMatch = signatureMatch[0].match(/<ds:X509Certificate[^>]*>([^<]+)<\/ds:X509Certificate>/i);
    if (!certMatch || !certMatch[1]?.trim()) {
      console.warn("[SECURITY] SAML signature has no X509Certificate in KeyInfo. Rejecting.");
      return false;
    }

    const cleanCert = certMatch[1].replace(/\s+/g, "");
    const configuredCert = certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, "");

    const cleanHash = nodeCreateHash("sha256").update(cleanCert).digest();
    const configuredHash = nodeCreateHash("sha256").update(configuredCert).digest();

    if (!timingSafeEqual(cleanHash, configuredHash)) {
      console.warn("[SECURITY] SAML response certificate does not match configured certificate. Rejecting.");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[SECURITY] SAML signature validation error:", err);
    return false;
  }
}

ssoRouter.post("/connections", requireTeamRole(["owner", "admin"]), async (c) => {
  const body = await c.req.json();
  const { teamId, provider, domain, metadata } = body;

  if (!teamId || !provider || !domain) {
    return c.json({ error: { message: "teamId, provider, and domain are required", code: "validation_error" } }, 400);
  }

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return c.json({ error: { message: `Provider must be one of: ${SUPPORTED_PROVIDERS.join(", ")}`, code: "validation_error" } }, 400);
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  if (!domainRegex.test(domain)) {
    return c.json({ error: { message: "Invalid domain format", code: "validation_error" } }, 400);
  }

  const existing = await db.select().from(ssoConnections).where(eq(ssoConnections.domain, domain)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: { message: "Domain already configured for SSO", code: "domain_exists" } }, 409);
  }

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (team.length === 0) {
    return c.json({ error: { message: "Team not found", code: "team_not_found" } }, 404);
  }

  const [connection] = await db.insert(ssoConnections).values({
    teamId,
    provider,
    domain: domain.toLowerCase(),
    metadata: metadata || null,
  }).returning();

  return c.json({ success: true, connection }, 201);
});

ssoRouter.get("/connections/:teamId", requireTeamRole(["owner", "admin", "member"]), async (c) => {
  const teamId = c.req.param("teamId") as string;

  const connections = await db.select().from(ssoConnections).where(eq(ssoConnections.teamId, teamId));

  return c.json({ success: true, connections });
});

ssoRouter.get("/connections", requireTeamRole(["owner", "admin"]), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "unauthorized" } }, 401);
  }

  const memberships = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, user.id));
  const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

  if (teamIds.length === 0) {
    return c.json({ success: true, connections: [] });
  }

  const connections = await db.select().from(ssoConnections);
  const filtered = connections.filter((conn: { teamId: string }) => teamIds.includes(conn.teamId));

  return c.json({ success: true, connections: filtered });
});

ssoRouter.delete("/connections/:connectionId", requireTeamRole(["owner", "admin"]), async (c) => {
  const connectionId = c.req.param("connectionId") as string;

  const [deleted] = await db.delete(ssoConnections).where(eq(ssoConnections.id, connectionId)).returning();

  if (!deleted) {
    return c.json({ error: { message: "Connection not found", code: "not_found" } }, 404);
  }

  return c.json({ success: true });
});

ssoRouter.post("/saml/acs", async (c) => {
  const body = await c.req.parseBody();
  const samlResponse = body["SAMLResponse"];

  if (!samlResponse || typeof samlResponse !== "string") {
    return c.json({ error: { message: "Missing SAMLResponse", code: "invalid_request" } }, 400);
  }

  let xml: string;
  try {
    xml = base64Decode(samlResponse);
  } catch {
    return c.json({ error: { message: "Invalid SAMLResponse encoding", code: "invalid_request" } }, 400);
  }

  const { email, domain } = extractSamlAttributes(xml);

  if (!email) {
    return c.json({ error: { message: "Could not extract email from SAML response", code: "invalid assertion" } }, 400);
  }

  const emailDomain = domain || email.split("@")[1]?.toLowerCase();

  if (!emailDomain) {
    return c.json({ error: { message: "Could not determine domain from SAML response", code: "invalid_assertion" } }, 400);
  }

  const connection = await db.select().from(ssoConnections).where(eq(ssoConnections.domain, emailDomain)).limit(1);

  if (connection.length === 0) {
    return c.json({ error: { message: `No SSO connection configured for domain: ${emailDomain}`, code: "domain_not_configured" } }, 404);
  }

  const conn = connection[0];
  const isValid = await validateSamlSignature(xml, conn.metadata);
  if (!isValid) {
    return c.json({ error: { message: "Invalid SAML signature", code: "signature_invalid" } }, 401);
  }

  const walletAddress = `sso:${conn.provider}:${email}`;
  const user = await getOrCreateUser(walletAddress);

  const team = await db.select().from(teams).where(eq(teams.id, conn.teamId)).limit(1);
  if (team.length === 0) {
    return c.json({ error: { message: "Team not found for SSO connection", code: "team_not_found" } }, 500);
  }

  const sessionToken = await generateSessionToken(user.id, "sso");
  const exchangeCode = randomBytes(32).toString("hex");

  const redis = await getRedisClient();
  if (redis) {
    await redis.set(`sso:exchange:${exchangeCode}`, sessionToken, { EX: 60 });
  }

  const redirectUrl = `${config.CORS_ORIGIN || "https://app.oma-ai.com"}/dashboard?code=${exchangeCode}&teamId=${conn.teamId}`;

  return c.redirect(redirectUrl, 302);
});

ssoRouter.get("/sso/exchange", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: { message: "Exchange code required", code: "missing_code" } }, 400);
  }

  const redis = await getRedisClient();
  if (!redis) {
    return c.json({ error: { message: "Exchange service unavailable", code: "service_unavailable" } }, 503);
  }

  const sessionToken = await redis.get(`sso:exchange:${code}`);
  if (!sessionToken) {
    return c.json({ error: { message: "Exchange code expired or invalid", code: "code_expired" } }, 410);
  }

  await redis.del(`sso:exchange:${code}`);

  return c.json({ sessionToken });
});

ssoRouter.get("/saml/metadata/:connectionId", async (c) => {
  const connectionId = c.req.param("connectionId") as string;

  const connection = await db.select().from(ssoConnections).where(eq(ssoConnections.id, connectionId)).limit(1);

  if (connection.length === 0) {
    return c.json({ error: { message: "Connection not found", code: "not_found" } }, 404);
  }

  const conn = connection[0];
  const spMetadata = {
    entityId: `${config.PUBLIC_API_URL}/sso/saml/acs`,
    acsUrl: `${config.PUBLIC_API_URL}/sso/saml/acs`,
    provider: conn.provider,
    domain: conn.domain,
  };

  return c.json(spMetadata);
});

ssoRouter.post("/connections/:connectionId", requireTeamRole(["owner", "admin"]), async (c) => {
  const connectionId = c.req.param("connectionId") as string;
  const body = await c.req.json();
  const { metadata } = body;

  const [updated] = await db.update(ssoConnections).set({ metadata, updatedAt: new Date() }).where(eq(ssoConnections.id, connectionId)).returning();

  if (!updated) {
    return c.json({ error: { message: "Connection not found", code: "not_found" } }, 404);
  }

  return c.json({ success: true, connection: updated });
});
