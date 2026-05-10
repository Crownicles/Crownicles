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
 *     critical section, e.g. `runWitchEndCallbackUnderLock`),
 *   - a function whose first executable statement is a runtime guard
 *     `assertUnderLock("...")` (or `await assertUnderLock(...)`) — the
 *     guard throws at runtime if the helper is reached without an
 *     active CLS transaction, so the rule trusts the contract,
 *   - any function in a file whose first block comment carries the
 *     `@lockInherited` marker (file-level opt-out: every `.save()` in
 *     the file is assumed to run under an outer lock acquired by every
 *     caller — the marker is *only* honoured when it sits at the very
 *     top of the file, not inside random function comments).
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

const DEFAULT_LOCK_ASSERTIONS = ["assertUnderLock"];

const DEFAULT_ALLOWED_REGEX = /UnderLock$/;

// Hyphenated tags like `@lock-inherited` are rendered as `@lock` by GitHub's
// markdown lexer (it treats the hyphen as a word boundary), which makes them
// effectively undetectable in code review. Use camelCase to keep the marker
// visible end-to-end in the GitHub UI.
const DEFAULT_INHERITED_LOCK_MARKER = "@lockInherited";

/**
 * The marker is only honoured when it appears in a *file-level* block comment
 * (the first block comment of the source, before any code). This prevents the
 * tag from being abused as a per-function escape hatch — a guarantee about an
 * "outer lock acquired by every caller" only makes sense at file scope.
 */
function hasFileLevelInheritedLockMarker(sourceCode, marker) {
	const comments = sourceCode.getAllComments();
	if (comments.length === 0) {
		return false;
	}
	const firstComment = comments[0];
	if (firstComment.type !== "Block") {
		return false;
	}
	const firstToken = sourceCode.getFirstToken(sourceCode.ast);
	if (firstToken && firstToken.range[0] < firstComment.range[1]) {
		return false;
	}
	return firstComment.value.includes(marker);
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

/**
 * Returns the list of statements directly executed at the start of
 * `functionNode`'s body. Arrow functions with an expression body have
 * no statements (they cannot host an assertion call), so this returns
 * an empty list in that case.
 */
function getFunctionPrologueStatements(functionNode) {
	const { body } = functionNode;
	if (!body || body.type !== "BlockStatement") {
		return [];
	}
	return body.body;
}

/**
 * Detects the runtime guard pattern recommended for helpers that need
 * to be called under a lock but cannot be wrapped statically: a leading
 * `assertUnderLock(...)` (or `await assertUnderLock(...)`) call as the
 * very first statement of the function body. The presence of this call
 * documents the contract at the call site *and* enforces it at runtime,
 * so `*save()` invocations inside the same function body are treated as
 * guarded for the purposes of this rule.
 */
function hasLockAssertionPrologue(functionNode, assertNames) {
	const [firstStatement] = getFunctionPrologueStatements(functionNode);
	if (!firstStatement || firstStatement.type !== "ExpressionStatement") {
		return false;
	}
	let expression = firstStatement.expression;
	if (expression.type === "AwaitExpression") {
		expression = expression.argument;
	}
	if (!expression || expression.type !== "CallExpression") {
		return false;
	}
	const { callee } = expression;
	if (callee.type !== "Identifier") {
		return false;
	}
	return assertNames.includes(callee.name);
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
	if (hasLockAssertionPrologue(functionNode, options.lockAssertions)) {
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
					lockAssertions: {
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
		const lockAssertions = options.lockAssertions ?? DEFAULT_LOCK_ASSERTIONS;
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
		if (hasFileLevelInheritedLockMarker(sourceCode, inheritedLockMarker)) {
			return {};
		}

		return {
			CallExpression(node) {
				if (!isZeroArgSaveCall(node)) {
					return;
				}
				if (isGuardedByLock(node, {
					lockHelpers, lockMemberCalls, lockAssertions, allowedRegex
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
