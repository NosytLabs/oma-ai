/**
 * /.well-known/antseed.json — AntSeed domain-ownership proof.
 *
 * AntSeed verifies a seller's domain two ways: a DNS TXT record
 * (`antseed-peer=<peerId>`) and this well-known file. Both must resolve
 * to the same peerId, and the proof must state the domain it covers.
 *
 * This is served from the app (like /.well-known/agent-card.json) rather
 * than from app/public: a static file in public/ is not served for this
 * path, which made the verifier report "Public data HTTP 404" even
 * though the proof was present in the repository.
 *
 * Proof shape (verified against @antseed/node domain-verification.js):
 *   type: "antseed-domain-verification"
 *   peerId: the 20-byte hex seller peer id
 *   domain: the domain this proof asserts ownership of
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

const PEER_ID = "7b35030f77793159e86933e678b4e502c8fd9509";
const DOMAIN = "www.oma-ai.com";

export function GET() {
	const proof = {
		type: "antseed-domain-verification",
		peerId: PEER_ID,
		domain: DOMAIN,
	};

	return NextResponse.json(proof, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
