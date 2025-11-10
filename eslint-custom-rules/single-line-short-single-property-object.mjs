/**
 * ESLint custom rule: single-line-short-single-property-object
 * 
 * Enforces that object literals with a single property should be written on a single line
 * if the total line length is less than or equal to 40 characters.
 * 
 * This rule helps maintain code consistency and reduces unnecessary line breaks
 * for simple single-property objects.
 * 
 * @example
 * // ✓ GOOD (single property, single line, < 40 chars)
 * const obj = { foo: "bar" };
 * import { join } from "path";
 * where: { id: playerId }
 * 
 * // ✗ BAD (single property split across multiple lines when it could fit on one)
 * const obj = {
 *   foo: "bar"
 * };
 * 
 * // ✓ GOOD (single property but line is too long)
 * const obj = {
 *   veryLongPropertyNameThatWouldExceedTheMaximumLength: "value"
 * };
 * 
 * // ✓ GOOD (multiple properties can use multiple lines)
 * const obj = {
 *   foo: "bar",
 *   baz: "qux"
 * };
 */

export default {
	meta: {
		type: "layout",
		docs: {
			description: "Enforce single-line format for short single-property objects (<40 characters)",
			category: "Stylistic Issues"
		},
		fixable: "whitespace",
		schema: [
			{
				type: "object",
				properties: {
					maxLength: {
						type: "integer",
						minimum: 20,
						default: 40
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			singlePropertyOneLine: "Object with single property should be on one line (total length: {{length}} chars, max: {{maxLength}})"
		}
	},

	create(context) {
		const sourceCode = context.sourceCode || context.getSourceCode();
		const options = context.options[0] || {};
		const maxLength = options.maxLength || 40;

		return {
			ObjectExpression(node) {
				// Only check objects with exactly one property
				if (node.properties.length !== 1) {
					return;
				}

				const property = node.properties[0];

				// Skip spread properties
				if (property.type === "SpreadElement") {
					return;
				}

				const openBrace = sourceCode.getFirstToken(node);
				const closeBrace = sourceCode.getLastToken(node);

				// Check if the object spans multiple lines
				if (openBrace.loc.start.line === closeBrace.loc.end.line) {
					// Already on a single line, no issue
					return;
				}

				// Calculate what the single-line version would look like
				const beforeBrace = sourceCode.getText().substring(
					sourceCode.getIndexFromLoc({
						line: openBrace.loc.start.line,
						column: 0
					}),
					openBrace.range[0]
				);

				// Get the property text
				const propertyText = sourceCode.getText(property);

				// Check if there's a trailing comma
				const tokenAfterProperty = sourceCode.getTokenAfter(property);
				const hasTrailingComma = tokenAfterProperty && 
					tokenAfterProperty.value === "," && 
					tokenAfterProperty.range[0] < closeBrace.range[0];

				// Get text after closing brace on the same line
				const afterBraceLineEnd = sourceCode.getIndexFromLoc({
					line: closeBrace.loc.end.line,
					column: sourceCode.lines[closeBrace.loc.end.line - 1].length
				});
				const afterBrace = sourceCode.getText().substring(
					closeBrace.range[1],
					afterBraceLineEnd
				);

				// Construct the single-line version
				const singleLine = `${beforeBrace}{ ${propertyText} }${afterBrace}`;

				// Check if it would fit within the max length
				if (singleLine.length <= maxLength) {
					context.report({
						node,
						messageId: "singlePropertyOneLine",
						data: {
							length: singleLine.length,
							maxLength
						},
						fix(fixer) {
							// Get the full range from start of the line to end of closing brace line
							const startOfLine = sourceCode.getIndexFromLoc({
								line: openBrace.loc.start.line,
								column: 0
							});
							
							const endOfLine = sourceCode.getIndexFromLoc({
								line: closeBrace.loc.end.line,
								column: sourceCode.lines[closeBrace.loc.end.line - 1].length
							});

							// Replace the entire multi-line object with single-line version
							return fixer.replaceTextRange(
								[startOfLine, endOfLine],
								singleLine.trimEnd()
							);
						}
					});
				}
			}
		};
	}
};
