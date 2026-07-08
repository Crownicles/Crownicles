/**
 * ESLint custom rule: no-response-push-through-return
 *
 * Forbids the pattern `arr.push(await fn(..., arr, ...))` — i.e. pushing into a
 * response array the awaited return value of a function that was itself handed
 * that same array.
 *
 * Rationale: packet handlers receive a shared `response: CrowniclesPacket[]`
 * array. A helper that both (a) receives that array (and pushes side effects
 * such as `MissionsController.update(...)` into it) and (b) returns a packet the
 * caller appends afterwards produces an ordering hazard: the side-effect packets
 * (e.g. `MissionsCompletedPacket`) end up BEFORE the command response in the
 * batch. On the front-end, the pending request callback then consumes the first
 * packet carrying the request's packetId — the mission broadcast — instead of
 * the real response, showing a false error and dropping the real reply.
 *
 * The hazard is inherently asynchronous (the accumulated side effects come from
 * awaited DB/mission work), so the rule only targets `await`-ed calls. This
 * deliberately ignores synchronous patterns such as
 * `actions.push(pickExcluding(actions))`, where the array is passed only to
 * exclude already-chosen values — no ordering hazard there.
 *
 * History: issue #4380 (food-shop buy showed a false "cannot buy" error and a
 * mission error). The same latent shape existed for garden harvest/plant and
 * guild treasury deposit.
 *
 * Fix: the helper must push its response into the array itself (before running
 * mission updates) and return `void`, or collect side effects in a separate
 * array and push the response first. See `ReportCityFoodShopService`,
 * `ReportGardenService` and `ReportCookingService` for the canonical shapes.
 *
 * @example
 * // ✗ BAD — response appended after the helper already pushed missions into it
 * response.push(await handleFoodShopBuy(keycloakId, packet, response));
 *
 * // ✓ GOOD — helper pushes its response first, then missions, and returns void
 * await handleFoodShopBuy(keycloakId, packet, response);
 */

function callArgumentsContainIdentifier(callNode, identifierName) {
	return callNode.arguments.some(arg => {
		if (arg.type === "Identifier") {
			return arg.name === identifierName;
		}

		// `...response` spread of the same array is the same hazard.
		if (arg.type === "SpreadElement" && arg.argument.type === "Identifier") {
			return arg.argument.name === identifierName;
		}
		return false;
	});
}

export default {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid pushing into a response array the awaited return of a function that received that same array (ordering hazard, see #4380)",
			category: "Possible Errors"
		},
		schema: [],
		messages: {
			noPushThroughReturn: "Do not push into `{{array}}` the awaited return of a function that received `{{array}}` as an argument: side-effect packets (missions, rewards) would land before the response. Make the helper push its response into `{{array}}` itself (before mission updates) and return void."
		}
	},

	create(context) {
		return {
			CallExpression(node) {
				const callee = node.callee;

				// Match `<identifier>.push(...)`
				if (
					callee.type !== "MemberExpression"
					|| callee.computed
					|| callee.property.type !== "Identifier"
					|| callee.property.name !== "push"
					|| callee.object.type !== "Identifier"
				) {
					return;
				}

				const arrayName = callee.object.name;

				for (const rawArg of node.arguments) {
					// Unwrap `...await fn(...)` and `await fn(...)`.
					const maybeAwait = rawArg.type === "SpreadElement" ? rawArg.argument : rawArg;
					if (maybeAwait.type !== "AwaitExpression") {
						continue;
					}
					const call = maybeAwait.argument;
					if (call.type === "CallExpression" && callArgumentsContainIdentifier(call, arrayName)) {
						context.report({
							node,
							messageId: "noPushThroughReturn",
							data: { array: arrayName }
						});
						return;
					}
				}
			}
		};
	}
};
