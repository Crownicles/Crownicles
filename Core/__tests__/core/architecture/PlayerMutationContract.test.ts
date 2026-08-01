import {
	describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const PLAYER_MODEL_PATH = path.join(__dirname, "../../../src/core/database/game/models/Player.ts");
const MISSIONS_CONTROLLER_PATH = path.join(__dirname, "../../../src/core/missions/MissionsController.ts");
const SOURCE_ROOT = path.join(__dirname, "../../../src");

type MutationEvent = {
	position: number;
	kind: "mutation" | "save";
	description: string;
};

function listTypeScriptFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true })
		.flatMap(entry => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return listTypeScriptFiles(entryPath);
			}
			return entry.name.endsWith(".ts") ? [entryPath] : [];
		});
}

function isThisFieldMutation(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	if (ts.isBinaryExpression(node)) {
		return ts.isAssignmentOperator(node.operatorToken.kind)
			&& node.left.getText(sourceFile).startsWith("this.");
	}
	return (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
		&& [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
		&& node.operand.getText(sourceFile).startsWith("this.");
}

function getSynchronousPlayerMutators(): Set<string> {
	const source = fs.readFileSync(PLAYER_MODEL_PATH, "utf8");
	const sourceFile = ts.createSourceFile(PLAYER_MODEL_PATH, source, ts.ScriptTarget.Latest, true);
	const methods = sourceFile.statements
		.filter(ts.isClassDeclaration)
		.flatMap(declaration => declaration.members.filter(ts.isMethodDeclaration))
		.filter(method => method.body && !method.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword));
	const mutators = new Set(methods
		.filter(method => {
			let mutates = false;
			function visit(node: ts.Node): void {
				mutates = mutates || isThisFieldMutation(node, sourceFile);
				if (!mutates) {
					ts.forEachChild(node, visit);
				}
			}
			visit(method.body!);
			return mutates;
		})
		.map(method => method.name.getText(sourceFile)));

	let foundWrapper = true;
	while (foundWrapper) {
		foundWrapper = false;
		for (const method of methods) {
			const methodName = method.name.getText(sourceFile);
			if (mutators.has(methodName)) {
				continue;
			}
			function visit(node: ts.Node): void {
				if (ts.isCallExpression(node)) {
					const calledMethod = node.expression.getText(sourceFile).match(/^this\.([A-Za-z0-9_]+)$/)?.[1];
					if (calledMethod && mutators.has(calledMethod)) {
						mutators.add(methodName);
						foundWrapper = true;
					}
				}
				if (!mutators.has(methodName)) {
					ts.forEachChild(node, visit);
				}
			}
			visit(method.body!);
		}
	}
	return mutators;
}

function findPendingPlayerChangesBeforeMissionUpdate(
	filePath: string,
	playerMutators: Set<string>,
	sourceOverride?: string
): string[] {
	const source = sourceOverride ?? fs.readFileSync(filePath, "utf8");
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
	const offenders: string[] = [];

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && /^MissionsController\.(update|updateMultiple)$/.test(node.expression.getText(sourceFile))) {
			const playerExpression = node.arguments[0]?.getText(sourceFile);
			let scope: ts.Node | undefined = node.parent;
			while (scope && !ts.isFunctionLike(scope)) {
				scope = scope.parent;
			}
			if (playerExpression && scope && ts.isFunctionLike(scope) && scope.body) {
				const events: MutationEvent[] = [];
				function scanBeforeUpdate(candidate: ts.Node): void {
					if (candidate === node || candidate.getStart(sourceFile) >= node.getStart(sourceFile)
						|| ts.isFunctionLike(candidate) && candidate !== scope) {
						return;
					}
					if (ts.isBinaryExpression(candidate)
						&& ts.isAssignmentOperator(candidate.operatorToken.kind)
						&& candidate.left.getText(sourceFile).startsWith(`${playerExpression}.`)) {
						events.push({
							position: candidate.getStart(sourceFile),
							kind: "mutation",
							description: candidate.getText(sourceFile)
						});
					}
					if (ts.isCallExpression(candidate)) {
						const calledExpression = candidate.expression.getText(sourceFile);
						if (calledExpression === "Object.assign" && candidate.arguments[0]?.getText(sourceFile) === playerExpression) {
							events.push({
								position: candidate.getStart(sourceFile),
								kind: "mutation",
								description: candidate.getText(sourceFile)
							});
						}
						if (calledExpression === `${playerExpression}.save`) {
							events.push({
								position: candidate.getStart(sourceFile), kind: "save", description: calledExpression
							});
						}
						const calledMethod = calledExpression.startsWith(`${playerExpression}.`)
							? calledExpression.slice(playerExpression.length + 1)
							: undefined;
						if (calledMethod && playerMutators.has(calledMethod)) {
							events.push({
								position: candidate.getStart(sourceFile),
								kind: "mutation",
								description: candidate.getText(sourceFile)
							});
						}
					}
					ts.forEachChild(candidate, scanBeforeUpdate);
				}
				scanBeforeUpdate(scope.body);
				events.sort((left, right) => left.position - right.position);
				const lastEvent = events.at(-1);
				if (lastEvent?.kind === "mutation") {
					const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
					offenders.push(`${path.relative(SOURCE_ROOT, filePath)}:${line} (${lastEvent.description})`);
				}
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return offenders;
}

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

	it("persists local Player mutations before direct mission updates", () => {
		const playerMutators = getSynchronousPlayerMutators();
		const offenders = listTypeScriptFiles(SOURCE_ROOT)
			.flatMap(filePath => findPendingPlayerChangesBeforeMissionUpdate(filePath, playerMutators));

		expect(offenders).toEqual([]);
	});

	it("detects a local Player mutation before a direct mission update", () => {
		const unsafeSource = `async function unsafeUpdate(player: Player): Promise<void> {
	player.petId = null;
	await MissionsController.update(player, [], { missionId: "depositPetInShelter" });
}`;

		expect(findPendingPlayerChangesBeforeMissionUpdate(
			path.join(SOURCE_ROOT, "unsafe.ts"),
			new Set(),
			unsafeSource
		)).toEqual(["unsafe.ts:3 (player.petId = null)"]);
	});
});
