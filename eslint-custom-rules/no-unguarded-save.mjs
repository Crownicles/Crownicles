/**
 * ESLint custom rule: no-unguarded-save
 *
 * Flags Sequelize-style `<expr>.save()` calls that are not statically
 * provable to be running inside a row-level lock. Concurrent
 * lost-update bugs all
 * reduce to a `.save()` call whose preceding read happened outside any
 * `SELECT … FOR UPDATE`, so the read-validate-mutate-save sequence is
 * not atomic.
 *
 * A `.save()` is considered guarded when any enclosing function is:
 *   - the callback argument of a `withLockedEntities(...)` call,
 *   - the callback argument of a `withLockedPlayerSafe(...)` call,
 *   - the callback argument of a `<Model>.withLocked(...)` call (the
 *     static helper exposed on `Player`, `Guild`, `Home`, …),
 *   - a function whose declared name ends in `UnderLock` (the project
 *     convention for helpers manually extracted out of a locked
 *     critical section, e.g. `runWitchEndCallbackUnderLock`).
 *
 * Anything else is flagged. Audited legacy call sites can opt out
 * locally with `// eslint-disable-next-line crownicles/no-unguarded-save`
 * (preferably with a one-line justification on the next line).
 *
 * The rule is intentionally conservative: it relies purely on syntax,
 * not on type inference. False negatives (e.g., a `.save()` reached
 * through a long helper chain that *is* called from a locked section)
 * are accepted in exchange for zero false positives on guarded code.
 *
 * Configuration:
 *   {
 *     lockHelpers?: string[];          // names of CallExpressions whose
 *                                      // callback argument is a guarded
 *                                      // critical section.
 *     lockMemberCalls?: string[];      // member-call names like "withLocked"
 *                                      // (matches `Foo.withLocked(...)`).
 *     allowedEnclosingFunctionRegex?: string;
 *                                      // function-name regex that opts a
 *                                      // helper into "this is run under a
 *                                      // lock" without re-checking.
 *     allowList?: string[];            // file-glob list — paths matching
 *                                      // are skipped entirely.
 *   }
 */

const DEFAULT_LOCK_HELPERS = [
	"withLockedEntities",
	"withLockedPlayerSafe"
];

const DEFAULT_LOCK_MEMBER_CALLS = ["withLocked"];

const DEFAULT_ALLOWED_REGEX = /UnderLock$/;

const DEFAULT_INHERITED_LOCK_MARKER = "@lock-inherited";

function hasInheritedLockMarker(sourceCode, marker) {
	const comments = sourceCode.getAllComments();
	for (const comment of comments) {
		if (comment.value.includes(marker)) {
			return true;
		}
	}
	return false;
}

function getEnclosingCallExpression(node) {
	let current = node.parent;
	while (current && current.type !== "CallExpression") {
		current = current.parent;
	}
	return current;
}

function isSimpleLockHelperIdentifier(callee, lockHelpers) {
	return callee.type === "Identifier" && lockHelpers.includes(callee.name);
}

function isLockHelperMemberCall(callee, lockMemberCalls) {
	return callee.type === "MemberExpression"
		&& callee.property.type === "Identifier"
		&& lockMemberCalls.includes(callee.property.name);
}

function isLockHelperCall(callExpression, lockHelpers, lockMemberCalls) {
	if (!callExpression) {
		return false;
	}
	const { callee } = callExpression;
	return isSimpleLockHelperIdentifier(callee, lockHelpers)
		|| isLockHelperMemberCall(callee, lockMemberCalls);
}

const PARENT_NAME_EXTRACTORS = {
	VariableDeclarator: parent => (parent.id.type === "Identifier" ? parent.id.name : null),
	Property: parent => (parent.key.type === "Identifier" ? parent.key.name : null),
	MethodDefinition: parent => (parent.key.type === "Identifier" ? parent.key.name : null)
};

function getEnclosingFunctionName(functionNode) {
	if (!functionNode) {
		return null;
	}
	const directName = functionNode.id?.name;
	if (directName) {
		return directName;
	}
	const { parent } = functionNode;
	const extractor = parent && PARENT_NAME_EXTRACTORS[parent.type];
	return extractor ? extractor(parent) : null;
}

function isFunctionNode(node) {
	return node.type === "FunctionDeclaration"
		|| node.type === "FunctionExpression"
		|| node.type === "ArrowFunctionExpression";
}

function isFunctionPassedToLockHelper(functionNode, lockHelpers, lockMemberCalls) {
	const enclosingCall = getEnclosingCallExpression(functionNode);
	if (!enclosingCall || !enclosingCall.arguments.includes(functionNode)) {
		return false;
	}
	return isLockHelperCall(enclosingCall, lockHelpers, lockMemberCalls);
}

function isFunctionGuarded(functionNode, options) {
	const fnName = getEnclosingFunctionName(functionNode);
	if (fnName && options.allowedRegex.test(fnName)) {
		return true;
	}
	return isFunctionPassedToLockHelper(functionNode, options.lockHelpers, options.lockMemberCalls);
}

function isGuardedByLock(node, options) {
	let current = node.parent;
	while (current) {
		if (isFunctionNode(current) && isFunctionGuarded(current, options)) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

function isZeroArgSaveCall(node) {
	return node.callee.type === "MemberExpression"
		&& node.callee.property.type === "Identifier"
		&& node.callee.property.name === "save"
		&& node.arguments.length === 0;
}

export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Forbid `<expr>.save()` outside `withLockedEntities` / `withLockedPlayerSafe` / `<Model>.withLocked` callbacks or `*UnderLock` helpers.",
			category: "Concurrency"
		},
		fixable: null,
		schema: [
			{
				type: "object",
				properties: {
					lockHelpers: {
						type: "array",
						items: { type: "string" }
					},
					lockMemberCalls: {
						type: "array",
						items: { type: "string" }
					},
					allowedEnclosingFunctionRegex: { type: "string" },
					inheritedLockMarker: { type: "string" }
				},
				additionalProperties: false
			}
		],
		messages: {
			unguardedSave:
				"`.save()` outside a row-level lock — wrap the read-validate-save sequence in `withLockedEntities([…])` (or `withLockedPlayerSafe`) so concurrent writers cannot lose updates."
		}
	},

	create(context) {
		const options = context.options[0] || {};
		const lockHelpers = options.lockHelpers ?? DEFAULT_LOCK_HELPERS;
		const lockMemberCalls = options.lockMemberCalls ?? DEFAULT_LOCK_MEMBER_CALLS;
		const allowedRegex = options.allowedEnclosingFunctionRegex
			? new RegExp(options.allowedEnclosingFunctionRegex)
			: DEFAULT_ALLOWED_REGEX;
		const inheritedLockMarker = options.inheritedLockMarker ?? DEFAULT_INHERITED_LOCK_MARKER;

		// File-level opt-out: if the source contains an `@lock-inherited`
		// marker comment anywhere (typically a top-of-file block comment),
		// the whole file is treated as running under an outer lock acquired
		// at one of its call sites. This matches the PR-H1 contract for
		// `loadAndExecuteSmallEvent`, where every small-event body executes
		// inside a `withLockedEntities([Player.lockKey])` callback in the
		// caller. Use sparingly and document the lock chain in the marker
		// comment.
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		if (hasInheritedLockMarker(sourceCode, inheritedLockMarker)) {
			return {};
		}

		return {
			CallExpression(node) {
				if (!isZeroArgSaveCall(node)) {
					return;
				}
				if (isGuardedByLock(node, {
					lockHelpers, lockMemberCalls, allowedRegex
				})) {
					return;
				}
				context.report({
					node,
					messageId: "unguardedSave"
				});
			}
		};
	}
};
