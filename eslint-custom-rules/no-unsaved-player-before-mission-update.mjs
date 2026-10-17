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
 * The same applies to every `Player` method that re-syncs the instance from a
 * freshly locked row (`addMoney`, `addHealth`, … through `mutateLocked`): #4817,
 * #4829. They are listed in the `playerReloaders` option, derived and checked on
 * the model exactly like `playerMutators`.
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

const LOOP_TYPES = new Set([
	"DoWhileStatement",
	"ForInStatement",
	"ForOfStatement",
	"ForStatement",
	"WhileStatement"
]);

// Statements after which control never reaches the next statement of the same block.
const JUMP_TYPES = new Set([
	"BreakStatement",
	"ContinueStatement",
	"ReturnStatement",
	"ThrowStatement"
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

function getCalledReloaderReceiver(callee, reloaders) {
	return callee.type === "MemberExpression" && reloaders.has(callee.property.name) ? callee.object : undefined;
}

function isNonPlayerReceiver(receiver, { isPlayerModel, nonPlayerReceiver }) {
	if (receiver.type === "ThisExpression") {
		return !isPlayerModel;
	}
	return Boolean(nonPlayerReceiver?.test(receiver.name ?? receiver.property?.name ?? ""));
}

/**
 * Player whose instance the call re-syncs from a freshly locked row, if any. Without
 * type information, reloader names shared with other models (`Guild.addExperience`)
 * are told apart by the receiver: `this` only inside the model, and no receiver
 * matching `nonPlayerReceiver`.
 */
function getReloadedPlayerNode(node, options) {
	if (isMissionUpdateCall(node)) {
		return node.arguments[0];
	}
	const receiver = getCalledReloaderReceiver(node.callee, options.reloaders);
	return receiver && !isNonPlayerReceiver(receiver, options) ? receiver : undefined;
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
	if (player.mutators.has(method)) {
		return "mutation";
	}
	return method === "save" || player.reloaders.has(method) ? "save" : undefined;
}

function classifyEvent(node, player, sourceCode) {
	if (isPlayerFieldWrite(node, player, sourceCode)) {
		return "mutation";
	}
	return node.type === "CallExpression" ? classifyCall(node, player, sourceCode) : undefined;
}

function getAncestors(node) {
	const ancestors = [];
	for (let current = node; current; current = current.parent) {
		ancestors.unshift(current);
	}
	return ancestors;
}

// A loop around two exclusive branches can still run both, one per iteration.
function isInsideLoop(ancestors) {
	const scopeStart = ancestors.findLastIndex(node => FUNCTION_TYPES.has(node.type));
	return ancestors.slice(scopeStart + 1).some(node => LOOP_TYPES.has(node.type));
}

function endsWithJump(statements) {
	const last = statements.at(-1);
	return last?.type === "BlockStatement" ? endsWithJump(last.body) : JUMP_TYPES.has(last?.type);
}

// Whether control cannot fall through from `leftCase` down to `rightCase`.
function areSeparatedByJump(cases, leftCase, rightCase) {
	return cases.slice(cases.indexOf(leftCase), cases.indexOf(rightCase))
		.some(clause => endsWithJump(clause.consequent));
}

/**
 * Whether `left` (before `right` in the source) and `right` sit in two branches that
 * never both run: the two sides of an `if` / ternary, or two `case` clauses with no
 * fall-through between them, none of them inside a loop.
 */
function areInExclusiveBranches(left, right) {
	const leftAncestors = getAncestors(left);
	const rightAncestors = getAncestors(right);
	let depth = 0;
	while (leftAncestors[depth + 1] && leftAncestors[depth + 1] === rightAncestors[depth + 1]) {
		depth++;
	}
	const common = leftAncestors[depth];
	const leftBranch = leftAncestors[depth + 1];
	const rightBranch = rightAncestors[depth + 1];
	if (isInsideLoop(leftAncestors.slice(0, depth + 1))) {
		return false;
	}
	if (common.type === "SwitchStatement") {
		return leftBranch !== common.discriminant && areSeparatedByJump(common.cases, leftBranch, rightBranch);
	}
	return (common.type === "IfStatement" || common.type === "ConditionalExpression")
		&& leftBranch !== common.test
		&& rightBranch !== common.test;
}

/**
 * Last thing that happened to the player in the enclosing function before `call`,
 * ignoring nested functions since those may run later, and branches exclusive with it.
 */
function getLastPlayerEvent(scopeBody, player, sourceCode, call) {
	const limit = call.range[0];
	const events = [];
	const collect = node => {
		if (node.range[0] >= limit || FUNCTION_TYPES.has(node.type)) {
			return;
		}
		const kind = classifyEvent(node, player, sourceCode);
		if (kind && !areInExclusiveBranches(node, call)) {
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

/**
 * `Object.assign(this, …)` or a mission update on `this`: the instance is overwritten
 * with the state of another, freshly locked one.
 */
function isThisResync(node) {
	if (node.type !== "CallExpression" || node.arguments[0]?.type !== "ThisExpression") {
		return false;
	}
	const callee = node.callee;
	const isObjectAssign = callee.type === "MemberExpression"
		&& callee.object.type === "Identifier"
		&& callee.object.name === "Object"
		&& callee.property.name === "assign";
	return isObjectAssign || isMissionUpdateCall(node);
}

function scanMethodBody(body) {
	const callees = new Set();
	let mutatesThis = false;
	let clearsChanges = false;
	let resyncsThis = false;
	const inspect = node => {
		mutatesThis = mutatesThis || isThisMutation(node);
		resyncsThis = resyncsThis || isThisResync(node);
		const calleeName = getCalledOwnMethodName(node);
		if (calleeName) {
			callees.add(calleeName);
			clearsChanges = clearsChanges || CHANGE_CLEARING_METHODS.has(calleeName) || isChangeFlagReset(node, calleeName);
		}
		getChildNodes(node).forEach(inspect);
	};
	inspect(body);
	return {
		mutatesThis, clearsChanges, resyncsThis, callees
	};
}

function getDirectUnsavedMutators(scans) {
	return new Set([...scans]
		.filter(([, scan]) => scan.mutatesThis)
		.filter(([, scan]) => !scan.clearsChanges)
		.map(([name]) => name));
}

function getIndirectUnsavedMutators(scans, mutators) {
	return [...scans]
		.filter(([, scan]) => !scan.clearsChanges)
		.filter(([, scan]) => [...scan.callees].some(callee => mutators.has(callee)))
		.map(([name]) => name)
		.filter(name => !mutators.has(name));
}

function addIndirectUnsavedMutators(scans, mutators) {
	let indirectMutators = getIndirectUnsavedMutators(scans, mutators);
	while (indirectMutators.length > 0) {
		indirectMutators.forEach(name => mutators.add(name));
		indirectMutators = getIndirectUnsavedMutators(scans, mutators);
	}
}

function scanClassMethods(classBody) {
	return new Map(classBody.body
		.filter(member => member.type === "MethodDefinition" && member.value.body)
		.map(member => [member.key.name, scanMethodBody(member.value.body)]));
}

/**
 * Names of the methods that leave `this` dirty, either directly or by calling
 * another such method.
 */
function getUnsavedMutators(scans) {
	const mutators = getDirectUnsavedMutators(scans);
	addIndirectUnsavedMutators(scans, mutators);
	return mutators;
}

function getIndirectReloaders(scans, reloaders) {
	return [...scans]
		.filter(([name, scan]) => !reloaders.has(name) && [...scan.callees].some(callee => reloaders.has(callee)))
		.map(([name]) => name);
}

/**
 * Names of the methods that overwrite `this` with a freshly locked instance, either
 * directly or by calling another such method.
 */
function getReloaders(scans) {
	const reloaders = new Set([...scans]
		.filter(([, scan]) => scan.resyncsThis)
		.map(([name]) => name));
	let indirectReloaders = getIndirectReloaders(scans, reloaders);
	while (indirectReloaders.length > 0) {
		indirectReloaders.forEach(name => reloaders.add(name));
		indirectReloaders = getIndirectReloaders(scans, reloaders);
	}
	return reloaders;
}

function reportUnlisted(context, classBody, { names, listed, messageId }) {
	for (const name of names) {
		if (!listed.has(name)) {
			context.report({
				node: classBody.body.find(member => member.key?.name === name).key,
				messageId,
				data: { method: name }
			});
		}
	}
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
					playerReloaders: {
						type: "array",
						items: { type: "string" }
					},
					nonPlayerReceiver: { type: "string" },
					playerModelFile: { type: "string" }
				},
				additionalProperties: false
			}
		],
		messages: {
			unsavedPlayer: "`{{player}}` was mutated by `{{mutation}}` without being saved: `{{call}}` re-reads the locked row and would discard it. Persist the change first, or apply it on the locked player (`applyOnLockedPlayer`).",
			unlistedReloader: "`{{method}}` overwrites the player instance with a freshly locked row but is missing from the `playerReloaders` option of `crownicles/no-unsaved-player-before-mission-update`, so a pending change before calling it would be silently lost. Add it to the rule options.",
			unlistedMutator: "`{{method}}` leaves the player instance dirty but is missing from the `playerMutators` option of `crownicles/no-unsaved-player-before-mission-update`, so calling it before a mission update would silently lose the change — or throw `UnsavedPlayerChangesError`. Add it to the rule options, or persist the change (`this.save()`) / clear the flag (`this.changed(\"field\", false)`) inside the method."
		}
	},

	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const playerMutators = new Set(context.options[0]?.playerMutators ?? []);
		const playerReloaders = new Set(context.options[0]?.playerReloaders ?? []);
		const nonPlayerReceiverSource = context.options[0]?.nonPlayerReceiver;
		const nonPlayerReceiver = nonPlayerReceiverSource ? new RegExp(nonPlayerReceiverSource, "u") : undefined;
		const playerModelFile = context.options[0]?.playerModelFile;
		const isPlayerModel = Boolean(playerModelFile) && context.filename.replaceAll("\\", "/")
			.endsWith(playerModelFile);

		return {
			ClassBody(node) {
				if (!isPlayerModel) {
					return;
				}
				const scans = scanClassMethods(node);
				reportUnlisted(context, node, {
					names: getUnsavedMutators(scans),
					listed: playerMutators,
					messageId: "unlistedMutator"
				});
				reportUnlisted(context, node, {
					names: getReloaders(scans),
					listed: playerReloaders,
					messageId: "unlistedReloader"
				});
			},

			CallExpression(node) {
				const playerNode = getReloadedPlayerNode(node, {
					reloaders: playerReloaders,
					isPlayerModel,
					nonPlayerReceiver
				});
				const scope = playerNode ? getEnclosingFunction(node) : undefined;
				if (!scope?.body) {
					return;
				}
				const player = {
					text: sourceCode.getText(playerNode),
					mutators: playerMutators,
					reloaders: playerReloaders
				};
				const lastEvent = getLastPlayerEvent(scope.body, player, sourceCode, node);
				if (lastEvent?.kind === "mutation") {
					context.report({
						node,
						messageId: "unsavedPlayer",
						data: {
							player: player.text,
							mutation: sourceCode.getText(lastEvent.node),
							call: sourceCode.getText(node.callee)
						}
					});
				}
			}
		};
	}
};
