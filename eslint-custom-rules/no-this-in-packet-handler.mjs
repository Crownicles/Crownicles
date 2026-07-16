/**
 * ESLint custom rule: no-this-in-packet-handler
 *
 * Forbids using `this` inside methods whose decorator registers an unbound
 * prototype method.
 *
 * Rationale: `@packetHandler`, `@commandRequires` and `@adminCommand` register
 * the raw `descriptor.value` (the unbound prototype method). The handler class
 * is never instantiated, so at call time `this` is `undefined`. Any use of
 * `this.<x>` therefore crashes at runtime with "Cannot read properties of
 * undefined".
 *
 * History: #4246 (blockedHandler crash on `this.helper(...)`), #4257 (latent pitfall).
 *
 * Allowed alternatives:
 *   - Pure module functions exported from the same file
 *   - `static` methods called as `ClassName.method(...)`
 *
 * @example
 * // ✗ BAD
 * class FooHandler {
 *     @packetHandler(SomePacket)
 *     async handle(ctx, packet) {
 *         await this.helper(ctx); // ← crash at runtime
 *     }
 *     private async helper(ctx) { ... }
 * }
 *
 * // ✓ GOOD
 * class FooHandler {
 *     @packetHandler(SomePacket)
 *     async handle(ctx, packet) {
 *         await FooHandler.helper(ctx);
 *     }
 *     private static async helper(ctx) { ... }
 * }
 */

const UNBOUND_HANDLER_DECORATORS = new Set([
	"adminCommand",
	"commandRequires",
	"packetHandler"
]);

function isPacketHandlerCall(expr) {
	if (!expr || expr.type !== "CallExpression") {
		return false;
	}
	const callee = expr.callee;
	if (!callee || callee.type !== "Identifier") {
		return false;
	}
	return UNBOUND_HANDLER_DECORATORS.has(callee.name);
}

function hasPacketHandlerDecorator(node) {
	const decorators = node.decorators ?? [];
	return decorators.some(decorator => isPacketHandlerCall(decorator.expression));
}

export default {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid `this` inside handlers whose decorators do not bind this",
			category: "Possible Errors"
		},
		schema: [],
		messages: {
			noThis: "`this` is unbound inside this decorated handler (the decorator registers the raw prototype function). Use `ClassName.staticMethod(...)` or a module-level function instead."
		}
	},

	create(context) {
		// Track depth of function boundaries crossed inside a decorated method.
		// We don't want to flag `this` inside nested ArrowFunctions when those are themselves
		// inside another non-arrow function declared inside the handler (rare, but for safety
		// only the decorated method's direct lexical `this` is what matters).
		const handlerStack = [];

		function enterMethod(node) {
			if (hasPacketHandlerDecorator(node)) {
				handlerStack.push({
					node,
					nonArrowFunctionDepth: 0
				});
			}
		}

		function exitMethod(node) {
			const top = handlerStack[handlerStack.length - 1];
			if (top && top.node === node) {
				handlerStack.pop();
			}
		}

		function enterNonArrowFunction(node) {
			const top = handlerStack[handlerStack.length - 1];
			if (!top) {
				return;
			}
			// The decorated method's own FunctionExpression IS `top.node.value` — that
			// body still binds `this` to the (missing) class instance, so we must not
			// count it as a nested function. Only count truly inner non-arrow functions.
			if (node === top.node.value) {
				return;
			}
			top.nonArrowFunctionDepth += 1;
		}

		function exitNonArrowFunction(node) {
			const top = handlerStack[handlerStack.length - 1];
			if (!top) {
				return;
			}
			if (node === top.node.value) {
				return;
			}
			top.nonArrowFunctionDepth -= 1;
		}

		return {
			MethodDefinition: enterMethod,
			"MethodDefinition:exit": exitMethod,
			FunctionDeclaration: enterNonArrowFunction,
			"FunctionDeclaration:exit": exitNonArrowFunction,
			FunctionExpression: enterNonArrowFunction,
			"FunctionExpression:exit": exitNonArrowFunction,
			ThisExpression(node) {
				const top = handlerStack[handlerStack.length - 1];
				if (!top) {
					return;
				}
				// If we crossed into a nested non-arrow function, that function has its own
				// `this` binding and is not affected by the decorator.
				if (top.nonArrowFunctionDepth > 0) {
					return;
				}
				context.report({
					node,
					messageId: "noThis"
				});
			}
		};
	}
};
