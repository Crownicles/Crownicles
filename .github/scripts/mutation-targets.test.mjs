import assert from "node:assert/strict";
import { test } from "node:test";
import { selectMutationTargets } from "./mutation-targets.mjs";

const MUTATE = [
	"src/core/missions/MissionsController.ts",
	"src/locks/**/*.ts",
	"src/types/HomeLevel.ts:144-181",
	"src/utils/**/*.ts"
];

test("only the mutated files a change touches are selected", () => {
	assert.deepEqual(selectMutationTargets(MUTATE, ["src/core/missions/MissionsController.ts", "src/core/report/ReportCityService.ts"]), [
		"src/core/missions/MissionsController.ts"
	]);
});

test("a glob is narrowed to the changed files it matches, at any depth", () => {
	assert.deepEqual(selectMutationTargets(MUTATE, ["src/locks/AsyncLock.ts", "src/locks/nested/Lock.ts", "src/types/Other.ts"]), [
		"src/locks/AsyncLock.ts",
		"src/locks/nested/Lock.ts"
	]);
});

test("a file mutated on a range keeps its range", () => {
	assert.deepEqual(selectMutationTargets(MUTATE, ["src/types/HomeLevel.ts"]), ["src/types/HomeLevel.ts:144-181"]);
});

test("a file excluded with ! is not selected, even when a glob matches it", () => {
	const mutate = [...MUTATE, "!src/locks/Pending.ts"];
	assert.deepEqual(selectMutationTargets(mutate, ["src/locks/Pending.ts", "src/locks/AsyncLock.ts"]), ["src/locks/AsyncLock.ts"]);
});

test("a change outside the mutated files selects nothing", () => {
	assert.deepEqual(selectMutationTargets(MUTATE, ["src/core/report/ReportCityService.ts"]), []);
	assert.deepEqual(selectMutationTargets(MUTATE, []), []);
});
