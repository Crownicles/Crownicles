import {
	describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const PLAYER_MODEL_PATH = path.join(__dirname, "../../../src/core/database/game/models/Player.ts");
const MISSIONS_CONTROLLER_PATH = path.join(__dirname, "../../../src/core/missions/MissionsController.ts");

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

function getCallOwners(filePath: string, guardedCalls: Set<string>): Record<string, string[]> {
	const source = fs.readFileSync(filePath, "utf8");
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
	const owners: Record<string, string[]> = {};

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const callName = node.expression.getText(sourceFile);
			if (guardedCalls.has(callName)) {
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
		expect(getCallOwners(PLAYER_MODEL_PATH, new Set([
			"MissionsController.update",
			"MissionsController.updateMultiple",
			"Player.withLocked",
			"Object.assign"
		]))).toEqual({
			"MissionsController.update": ["mutateWithMission"],
			"MissionsController.updateMultiple": ["mutateWithMissions"],
			"Player.withLocked": ["mutateLocked"],
			"Object.assign": ["mutateLocked"]
		});
		expect(getCallOwners(MISSIONS_CONTROLLER_PATH, new Set(["Object.assign"]))).toEqual({
			"Object.assign": ["synchronizeCaller"]
		});
	});
});