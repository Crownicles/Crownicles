import assert from "node:assert/strict";
import { test } from "node:test";
import { fileMutationScores, filesUnderFloor } from "./test-reports-summary.mjs";

const mutants = statuses => statuses.map(status => ({ status }));

const REPORT = {
	files: {
		"src/Strong.ts": { mutants: mutants(["Killed", "Killed", "Timeout", "Survived", "CompileError"]) },
		"src/Weak.ts": { mutants: mutants(["Killed", "Survived", "NoCoverage"]) },
		"src/Static.ts": { mutants: mutants(["Ignored"]) }
	}
};

test("a file scores its detected mutants, killed or timed out, among its valid ones", () => {
	assert.deepEqual(fileMutationScores(REPORT), [
		{
			file: "src/Strong.ts", score: 75, killed: 2, timeout: 1, survived: 1, noCoverage: 0
		},
		{
			file: "src/Weak.ts", score: 100 / 3, killed: 1, timeout: 0, survived: 1, noCoverage: 1
		},
		{
			file: "src/Static.ts", score: null, killed: 0, timeout: 0, survived: 0, noCoverage: 0
		}
	]);
});

test("only the files under the floor fail it, a file without valid mutant never does", () => {
	assert.deepEqual(filesUnderFloor(fileMutationScores(REPORT), 75).map(({ file }) => file), ["src/Weak.ts"]);
	assert.deepEqual(filesUnderFloor(fileMutationScores(REPORT), 30), []);
});
