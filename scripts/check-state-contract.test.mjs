import test from "node:test";
import assert from "node:assert/strict";
import { checkStateContract, extractConstMap, valuesOf, missingFrom } from "./check-state-contract.mjs";

test("client and server agree on the usage status vocabulary", () => {
	const { problems, serverValues, appValues } = checkStateContract();
	assert.deepEqual(problems, [], `state contract problems:\n${problems.join("\n")}`);
	assert.ok(serverValues.length > 0);
	assert.deepEqual(serverValues, appValues);
});

test("extractConstMap reads a const object of string values", () => {
	const source = `export const THING = {\n\tA: "a",\n\tB: "b",\n} as const;`;
	assert.deepEqual(extractConstMap(source, "THING"), [
		["A", "a"],
		["B", "b"],
	]);
});

test("valuesOf de-duplicates and sorts", () => {
	assert.deepEqual(valuesOf([["A", "b"], ["B", "b"], ["C", "a"]]), ["a", "b"]);
});

test("missingFrom reports the values absent from the other side", () => {
	assert.deepEqual(missingFrom(["a", "b"], ["a"]), ["b"]);
	assert.deepEqual(missingFrom(["a"], ["a", "b"]), []);
});
