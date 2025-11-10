# Crownicles Custom ESLint Rules

This directory contains custom ESLint rules specific to the Crownicles project.

## Rules

### `single-line-short-single-property-object`

Enforces that object literals with a single property should be written on a single line if the total line length is less than or equal to 40 characters.

**Why?** This rule helps maintain code consistency and reduces unnecessary line breaks for simple single-property objects, making the code more concise and readable.

#### ✓ Good Examples

```typescript
// Single property, single line, < 40 chars
const obj = { foo: "bar" };
import { join } from "path";
where: { id: playerId }

// Single property but line is too long (> 40 chars)
const obj = {
  veryLongPropertyNameThatWouldExceedTheMaximumLength: "value"
};

// Multiple properties can use multiple lines
const obj = {
  foo: "bar",
  baz: "qux"
};
```

#### ✗ Bad Examples

```typescript
// Single property split across multiple lines when it could fit on one
const obj = {
  foo: "bar"
};

import {
  join
} from "path";
```

#### Configuration

The rule accepts one option:
- `maxLength` (default: `40`): The maximum line length for single-line format

```javascript
"crownicles/single-line-short-single-property-object": ["error", { maxLength: 40 }]
```

#### Auto-fix

This rule supports ESLint's `--fix` option and will automatically convert multi-line single-property objects to single-line format when appropriate.

## Usage

The custom rules are automatically loaded in each service's `eslint.config.mjs`:

```javascript
import crowniclesCustomRules from "../eslint-custom-rules/index.mjs";

export default defineConfig([
  {
    plugins: {
      "crownicles": crowniclesCustomRules
    },
    rules: {
      "crownicles/single-line-short-single-property-object": ["error", { maxLength: 40 }]
    }
  }
]);
```

## Related Issue

This rule was created to address issue #2980: "Mettre sur une seule ligne les objets ne contenant qu'un seul et unique élément court (<40 caractères)"
