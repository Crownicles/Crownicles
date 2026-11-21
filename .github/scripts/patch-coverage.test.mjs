import assert from "node:assert/strict";
import { test } from "node:test";
import {
	computePatchCoverage, formatReport, parseAddedLines, parseLcov, toRanges
} from "./patch-coverage.mjs";

const LCOV = `TN:
SF:src/core/Service.ts
DA:1,4
DA:2,0
DA:3,1
DA:5,0
end_of_record
SF:src/core/Other.ts
DA:10,2
end_of_record
`;

const DIFF = `diff --git a/Core/src/core/Service.ts b/Core/src/core/Service.ts
--- a/Core/src/core/Service.ts
+++ b/Core/src/core/Service.ts
@@ -1,0 +2,3 @@ export class Service {
+	first();
+	second();
+	// a comment
@@ -9 +5 @@ export class Service {
+	third();
diff --git a/Core/src/core/Removed.ts b/Core/src/core/Removed.ts
--- a/Core/src/core/Removed.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone();
-gone();
diff --git a/Core/src/core/Types.ts b/Core/src/core/Types.ts
--- a/Core/src/core/Types.ts
+++ b/Core/src/core/Types.ts
@@ -0,0 +1 @@
+export type Id = number;
`;

test("the hits of every measured line are read from the lcov report", () => {
	const coverage = parseLcov(LCOV);

	assert.deepEqual([...coverage.keys()], ["src/core/Service.ts", "src/core/Other.ts"]);
	assert.deepEqual([...coverage.get("src/core/Service.ts")], [[1, 4], [2, 0], [3, 1], [5, 0]]);
});

test("the added lines are read from the hunks, a deleted file adds none", () => {
	assert.deepEqual([...parseAddedLines(DIFF)], [
		["Core/src/core/Service.ts", [2, 3, 4, 5]],
		["Core/src/core/Types.ts", [1]]
	]);
});

test("only the added lines the coverage measures count, in the module of the file", () => {
	const result = computePatchCoverage(parseAddedLines(DIFF), new Map([["Core", parseLcov(LCOV)]]));

	assert.deepEqual(result.files, [{
		path: "Core/src/core/Service.ts", total: 3, uncovered: [2, 5]
	}]);
	assert.equal(result.covered, 1);
	assert.equal(result.total, 3);
	assert.equal(result.percent, 100 / 3);
});

test("a change without any measured line passes", () => {
	const result = computePatchCoverage(parseAddedLines(DIFF), new Map([["Lib", parseLcov(LCOV)]]));

	assert.equal(result.total, 0);
	assert.equal(result.percent, 100);
});

test("consecutive uncovered lines are reported as ranges", () => {
	assert.deepEqual(toRanges([7, 3, 4, 5, 9]), ["3-5", "7", "9"]);
});

test("the report tells whether the gate passes and lists the uncovered lines", () => {
	const result = computePatchCoverage(parseAddedLines(DIFF), new Map([["Core", parseLcov(LCOV)]]));

	const failing = formatReport(result, 70);
	assert.match(failing, /1\/3 measured lines covered \(33\.3 %\)\*\*: the gate fails/u);
	assert.match(failing, /\| Core\/src\/core\/Service\.ts \| 1\/3 \| 2, 5 \|/u);
	assert.match(failing, /skip-patch-coverage/u);
	assert.match(formatReport(result, 30), /the gate passes/u);
});
