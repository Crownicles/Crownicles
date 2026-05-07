/**
 * ESLint custom rule: no-unguarded-save
 *
 * Flags Sequelize-style `<expr>.save()` calls that are not statically
 * provable to be running inside a row-level lock. Concurrent
 * lost-update bugs covered by §3-§4 of `docs/CONCURRENCY_PLAN.md` all
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

function getEnclosingCallExpression(node) {
	let current = node.parent;
	while (current && current.type !== "CallExpression") {
		current = current.parent;
	}
	return current;
}

function isLockHelperCall(callExpression, lockHelpers, lockMemberCalls) {
	if (!callExpression) {
		return false;
	}
	const { callee } = callExpression;
	if (callee.type === "Identifier" && lockHelpers.includes(callee.name)) {
		return true;
	}
	if (
		callee.type === "MemberExpression"
		&& callee.property.type === "Identifier"
		&& lockMemberCalls.includes(callee.property.name)
	) {
		return true;
	}
	return false;
}

function getEnclosingFunctionName(functionNode) {
	if (!functionNode) {
		return null;
	}
	if (functionNode.id && functionNode.id.name) {
		return functionNode.id.name;
	}
	const { parent } = functionNode;
	if (!parent) {
		return null;
	}
	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
		return parent.id.name;
	}
	if (parent.type === "Property" && parent.key.type === "Identifier") {
		return parent.key.name;
	}
	if (parent.type === "MethodDefinition" && parent.key.type === "Identifier") {
		return parent.key.name;
	}
	return null;
}

function isGuardedByLock(node, options) {
	const {
		lockHelpers, lockMemberCalls, allowedRegex
	} = options;
	let current = node.parent;
	while (current) {
		if (
			current.type === "FunctionDeclaration"
			|| current.type === "FunctionExpression"
			|| current.type === "ArrowFunctionExpression"
		) {
			const fnName = getEnclosingFunctionName(current);
			if (fnName && allowedRegex.test(fnName)) {
				return true;
			}
			const enclosingCall = getEnclosingCallExpression(current);
			if (
				enclosingCall
				&& enclosingCall.arguments.includes(current)
				&& isLockHelperCall(enclosingCall, lockHelpers, lockMemberCalls)
			) {
				return true;
			}
		}
		current = current.parent;
	}
	return false;
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
					allowedEnclosingFunctionRegex: { type: "string" }
				},
				additionalProperties: false
			}
		],
		messages: {
			unguardedSave:
				"`.save()` outside a row-level lock — wrap the read-validate-save sequence in `withLockedEntities([…])` (or `withLockedPlayerSafe`) so concurrent writers cannot lose updates. See docs/CONCURRENCY_PLAN.md."
		}
	},

	create(context) {
		const options = context.options[0] || {};
		const lockHelpers = options.lockHelpers ?? DEFAULT_LOCK_HELPERS;
		const lockMemberCalls = options.lockMemberCalls ?? DEFAULT_LOCK_MEMBER_CALLS;
		const allowedRegex = options.allowedEnclosingFunctionRegex
			? new RegExp(options.allowedEnclosingFunctionRegex)
			: DEFAULT_ALLOWED_REGEX;

		return {
			CallExpression(node) {
				if (
					node.callee.type !== "MemberExpression"
					|| node.callee.property.type !== "Identifier"
					|| node.callee.property.name !== "save"
					|| node.arguments.length !== 0
				) {
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
