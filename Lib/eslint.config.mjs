// @ts-check

import {defineConfig} from "eslint/config";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";
import customRules from "../eslint-rules.mjs";
import crowniclesCustomRules from "../eslint-custom-rules/index.mjs";

export default defineConfig([
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			parser: typescriptEslintParser,
			parserOptions: { ecmaVersion: 2022 }
		},
		files: ["src/**/*.ts"]
	},
	{
		rules: typescriptEslintPlugin.configs.recommended.rules
	},
	{
		plugins: {
			"@typescript-eslint": typescriptEslintPlugin,
			jsdoc,
			"@stylistic": stylistic,
			"crownicles": crowniclesCustomRules
		},
		rules: {
			...customRules,
			"crownicles/single-line-short-single-property-object": ["error", { maxLength: 40 }]
		}
	}
]);
