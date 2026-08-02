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
 * History: #4207 (mutation lost across the mission re-fetch), #4554, #4621.
 *
 * The `playerMutators` option lists the `Player` methods that leave the instance
 * dirty. It cannot be derived here (the offending call sites live in other files),
 * so the rule also lints the model itself and reports any such method missing from
 * the list: the option can never silently go stale.
 *
 * A method counts as dirtying unless it also clears the change tracking — by
 * persisting the instance (`this.save()`, `this.update()`), by reloading it, or by
 * explicitly resetting the flag (`this.changed("field", false)`, used when the value
 * was already written out of band through a bulk update). `async` methods are
 * included: `markActive` was async, wrote its field through `Player.update(...)` and
 * still left the instance dirty, which crashed every in-city command (#4621).
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

// `this.<name>()` calls that leave the instance with no pending change of its own.
const CHANGE_CLEARING_METHODS = new Set([
	"save",
	"update",
	"reload"
]);

// Expression each kind of write node targets, so a write can be recognized without branching on its type.
const WRITE_TARGETS = {
	AssignmentExpression: node => node.left,
	UpdateExpression: node => node.argument
};

function getChildNodes(node) {
	return Object.entries(node)
		.filter(([key]) => key !== "parent")
		.flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
		.filter(value => value && typeof value.type === "string");
}

function isMissionUpdateCall(node) {
	const callee = node.callee;
	return callee.type === "MemberExpression"
		&& callee.object.type === "Identifier"
		&& callee.object.name === "MissionsController"
		&& MISSION_UPDATE_METHODS.has(callee.property.name);
}

function getEnclosingFunction(node) {
	let current = node.parent;
	while (current && !FUNCTION_TYPES.has(current.type)) {
		current = current.parent;
	}
	return current;
}

function isPlayerFieldWrite(node, player, sourceCode) {
	const written = WRITE_TARGETS[node.type]?.(node);
	return Boolean(written) && sourceCode.getText(written).startsWith(`${player.text}.`);
}

function isObjectAssignOnPlayer(node, player, sourceCode) {
	return sourceCode.getText(node.callee) === "Object.assign"
		&& node.arguments.length > 0
		&& sourceCode.getText(node.arguments[0]) === player.text;
}

/**
 * Describe what a call does to the player, or `undefined` when it leaves it untouched.
 */
function classifyCall(node, player, sourceCode) {
	if (isObjectAssignOnPlayer(node, player, sourceCode)) {
		return "mutation";
	}
	const calleeText = sourceCode.getText(node.callee);
	if (!calleeText.startsWith(`${player.text}.`)) {
		return undefined;
	}
	const method = calleeText.slice(player.text.length + 1);
	if (method === "save") {
		return "save";
	}
	return player.mutators.has(method) ? "mutation" : undefined;
}

function classifyEvent(node, player, sourceCode) {
	if (isPlayerFieldWrite(node, player, sourceCode)) {
		return "mutation";
	}
	return node.type === "CallExpression" ? classifyCall(node, player, sourceCode) : undefined;
}

/**
 * Last thing that happened to the player in the enclosing function before `limit`,
 * ignoring nested functions since those may run later.
 */
function getLastPlayerEvent(scopeBody, player, sourceCode, limit) {
	const events = [];
	const collect = node => {
		if (node.range[0] >= limit || FUNCTION_TYPES.has(node.type)) {
			return;
		}
		const kind = classifyEvent(node, player, sourceCode);
		if (kind) {
			events.push({
				position: node.range[0],
				kind,
				node
			});
		}
		getChildNodes(node).forEach(collect);
	};
	getChildNodes(scopeBody).forEach(collect);
	return events.sort((left, right) => left.position - right.position).at(-1);
}

function isThisMember(node) {
	return node.type === "MemberExpression" && node.object.type === "ThisExpression";
}

function isThisMutation(node) {
	const written = WRITE_TARGETS[node.type]?.(node);
	return Boolean(written) && isThisMember(written);
}

function getCalledOwnMethodName(node) {
	return node.type === "CallExpression" && isThisMember(node.callee) && node.callee.property.type === "Identifier"
		? node.callee.property.name
		: undefined;
}

/**
 * `this.changed("field", false)`: the value is already persisted, the instance is
 * deliberately kept clean.
 */
function isChangeFlagReset(node, calleeName) {
	return calleeName === "changed"
		&& node.arguments.length === 2
		&& node.arguments[1].type === "Literal"
		&& node.arguments[1].value === false;
}

function scanMethodBody(body) {
	const callees = new Set();
	let mutatesThis = false;
	let clearsChanges = false;
	const inspect = node => {
		mutatesThis = mutatesThis || isThisMutation(node);
		const calleeName = getCalledOwnMethodName(node);
		if (calleeName) {
			callees.add(calleeName);
			clearsChanges = clearsChanges || CHANGE_CLEARING_METHODS.has(calleeName) || isChangeFlagReset(node, calleeName);
		}
		getChildNodes(node).forEach(inspect);
	};
	inspect(body);
	return {
		mutatesThis, clearsChanges, callees
	};
}

/**
 * Names of the methods that leave `this` dirty, either directly or by calling
 * another such method.
 */
function getUnsavedMutators(classBody) {
	const scans = new Map(classBody.body
		.filter(member => member.type === "MethodDefinition" && member.value.body)
		.map(member => [member.key.name, scanMethodBody(member.value.body)]));
	const mutators = new Set([...scans]
		.filter(([, scan]) => scan.mutatesThis && !scan.clearsChanges)
		.map(([name]) => name));

	let grew = true;
	while (grew) {
		grew = false;
		for (const [name, scan] of scans) {
			if (!mutators.has(name) && !scan.clearsChanges && [...scan.callees].some(callee => mutators.has(callee))) {
				mutators.add(name);
				grew = true;
			}
		}
	}
	return mutators;
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
					},
					playerModelFile: { type: "string" }
				},
				additionalProperties: false
			}
		],
		messages: {
			unsavedPlayer: "`{{player}}` was mutated by `{{mutation}}` without being saved: the mission update re-reads the locked row and would discard it. Move the mutation into `applyOnLockedPlayer`.",
			unlistedMutator: "`{{method}}` leaves the player instance dirty but is missing from the `playerMutators` option of `crownicles/no-unsaved-player-before-mission-update`, so calling it before a mission update would silently lose the change — or throw `UnsavedPlayerChangesError`. Add it to the rule options, or persist the change (`this.save()`) / clear the flag (`this.changed(\"field\", false)`) inside the method."
		}
	},

	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const playerMutators = new Set(context.options[0]?.playerMutators ?? []);
		const playerModelFile = context.options[0]?.playerModelFile;
		const isPlayerModel = Boolean(playerModelFile) && context.filename.replaceAll("\\", "/")
			.endsWith(playerModelFile);

		return {
			ClassBody(node) {
				if (!isPlayerModel) {
					return;
				}
				for (const name of getUnsavedMutators(node)) {
					if (!playerMutators.has(name)) {
						context.report({
							node: node.body.find(member => member.key?.name === name).key,
							messageId: "unlistedMutator",
							data: { method: name }
						});
					}
				}
			},

			CallExpression(node) {
				const scope = isMissionUpdateCall(node) && node.arguments[0] ? getEnclosingFunction(node) : undefined;
				if (!scope?.body) {
					return;
				}
				const player = {
					text: sourceCode.getText(node.arguments[0]),
					mutators: playerMutators
				};
				const lastEvent = getLastPlayerEvent(scope.body, player, sourceCode, node.range[0]);
				if (lastEvent?.kind === "mutation") {
					context.report({
						node,
						messageId: "unsavedPlayer",
						data: {
							player: player.text,
							mutation: sourceCode.getText(lastEvent.node)
						}
					});
				}
			}
		};
	}
};
