import {
	describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const PLAYER_MODEL_PATH = path.join(__dirname, "../../../src/core/database/game/models/Player.ts");

const GUARDED_CALLS = new Set([
	"MissionsController.update",
	"MissionsController.updateMultiple",
	"Player.withLocked",
	"Object.assign"
]);

function getContainingMethodName(node: ts.Node): string | undefined {
	let current: ts.Node | undefined = node.parent;
	while (current) {
		if (ts.isMethodDeclaration(current)) {
			return current.name.getText();
		}
		current = current.parent;
	}
	return undefined;
}

function getGuardedCallOwners(source: string): Record<string, string[]> {
	const sourceFile = ts.createSourceFile(PLAYER_MODEL_PATH, source, ts.ScriptTarget.Latest, true);
	const owners: Record<string, string[]> = {};

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const callName = node.expression.getText(sourceFile);
			if (GUARDED_CALLS.has(callName)) {
				const methodName = getContainingMethodName(node);
				owners[callName] = [...owners[callName] ?? [], methodName ?? "<outside method>"];
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return owners;
}

describe("Player mutation contract", () => {
	it("centralizes mission reloads and caller synchronization", () => {
		const source = fs.readFileSync(PLAYER_MODEL_PATH, "utf8");

		expect(getGuardedCallOwners(source)).toEqual({
			"MissionsController.update": ["mutateWithMission"],
			"Object.assign": ["mutateWithMission", "mutateWithMissions", "mutateLocked"],
			"MissionsController.updateMultiple": ["mutateWithMissions"],
			"Player.withLocked": ["mutateLocked"]
		});
	});
});