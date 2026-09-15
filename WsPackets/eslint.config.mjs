// @ts-check

import {defineConfig, globalIgnores} from "eslint/config";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";
import customRules from "../eslint-rules.mjs";

export default defineConfig([
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			parser: typescriptEslintParser,
			parserOptions: {
				ecmaVersion: 2022
			}
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
			"@stylistic": stylistic
		},
		rules: customRules
	},
	{
		rules: {
			"no-restricted-imports": [
				"error",
				{
					"patterns": [
						"**/Core/*",
						"**/Discord/*"
					]
				}
			]
		}
	},
	globalIgnores(["src/@types/**/*.ts"])
]);
