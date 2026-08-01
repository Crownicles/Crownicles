/**
 * ESLint custom rule: no-unsaved-player-before-mission-update
 *
 * Forbids calling `MissionsController.update` / `MissionsController.updateMultiple`
 * while the `Player` instance passed as first argument still carries unsaved local
 * mutations.
 *
 * Rationale: both entry points re-read the player row under a lock and copy the
 * committed state back onto the caller instance. Any field mutated locally but not
 * yet persisted is therefore silently discarded. The mutation must either be saved
 * first, or — preferably — be routed through `applyOnLockedPlayer` so it happens
 * inside the same row lock as the mission progression.
 *
 * History: #4207 (mutation lost across the mission re-fetch), #4554.
 *
 * @example
 * // ✗ BAD
 * player.petId = null;
 * await MissionsController.update(player, response, { missionId: "depositPetInShelter" });
 *
 * // ✓ GOOD
 * await MissionsController.update(player, response, {
 *     missionId: "depositPetInShelter",
 *     applyOnLockedPlayer: lockedPlayer => {
 *         lockedPlayer.petId = null;
 *     }
 * });
 */

const MISSION_UPDATE_METHODS = new Set([
	"update",
	"updateMultiple"
]);

const FUNCTION_TYPES = new Set([
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression"
]);

function isMissionUpdateCall(node) {
	const callee = node.callee;
	return callee.type === "MemberExpression"
		&& !callee.computed
		&& callee.object.type === "Identifier"
		&& callee.object.name === "MissionsController"
		&& callee.property.type === "Identifier"
		&& MISSION_UPDATE_METHODS.has(callee.property.name);
}

function getEnclosingFunction(node) {
	let current = node.parent;
	while (current && !FUNCTION_TYPES.has(current.type)) {
		current = current.parent;
	}
	return current;
}

function forEachChildNode(node, visit) {
	for (const key of Object.keys(node)) {
		if (key === "parent") {
			continue;
		}
		const value = node[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item && typeof item.type === "string") {
					visit(item);
				}
			}
		}
		else if (value && typeof value.type === "string") {
			visit(value);
		}
	}
}

/**
 * Describe what the inspected node does to `playerText`, or `undefined` when it
 * does not touch it at all.
 */
function classifyEvent(node, playerText, playerMutators, sourceCode) {
	if (node.type === "AssignmentExpression" && sourceCode.getText(node.left).startsWith(`${playerText}.`)
		|| node.type === "UpdateExpression" && sourceCode.getText(node.argument).startsWith(`${playerText}.`)) {
		return "mutation";
	}
	if (node.type !== "CallExpression") {
		return undefined;
	}
	const calleeText = sourceCode.getText(node.callee);
	if (calleeText === "Object.assign" && node.arguments[0] && sourceCode.getText(node.arguments[0]) === playerText) {
		return "mutation";
	}
	if (calleeText === `${playerText}.save`) {
		return "save";
	}
	return calleeText.startsWith(`${playerText}.`) && playerMutators.has(calleeText.slice(playerText.length + 1))
		? "mutation"
		: undefined;
}

export default {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid passing a `Player` with unsaved local mutations to a mission update",
			category: "Possible Errors"
		},
		schema: [
			{
				type: "object",
				properties: {
					playerMutators: {
						type: "array",
						items: { type: "string" }
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			unsavedPlayer: "`{{player}}` was mutated by `{{mutation}}` without being saved: the mission update re-reads the locked row and would discard it. Move the mutation into `applyOnLockedPlayer`."
		}
	},

	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const playerMutators = new Set(context.options[0]?.playerMutators ?? []);

		return {
			CallExpression(node) {
				if (!isMissionUpdateCall(node) || !node.arguments[0]) {
					return;
				}
				const scope = getEnclosingFunction(node);
				if (!scope?.body) {
					return;
				}
				const playerText = sourceCode.getText(node.arguments[0]);
				const callStart = node.range[0];
				const events = [];

				function collect(candidate) {
					if (candidate.range[0] >= callStart || FUNCTION_TYPES.has(candidate.type)) {
						return;
					}
					const kind = classifyEvent(candidate, playerText, playerMutators, sourceCode);
					if (kind) {
						events.push({
							position: candidate.range[0],
							kind,
							node: candidate
						});
					}
					forEachChildNode(candidate, collect);
				}

				forEachChildNode(scope.body, collect);
				events.sort((left, right) => left.position - right.position);
				const lastEvent = events.at(-1);
				if (lastEvent?.kind === "mutation") {
					context.report({
						node,
						messageId: "unsavedPlayer",
						data: {
							player: playerText,
							mutation: sourceCode.getText(lastEvent.node)
						}
					});
				}
			}
		};
	}
};
