// @ts-check

import {defineConfig, globalIgnores} from "eslint/config";
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
	},
	{
		// Concurrency hardening sweep (PR-E … PR-H): the orchestration
		// files below sit at the top of every gameplay flow and route
		// state mutations through `withLockedEntities` /
		// `withLockedPlayerSafe`. Any new `.save()` introduced into one
		// of these files without going through a lock helper is a
		// regression — the rule below catches that statically.
		// See §10 of the review checklist for the rationale, patterns
		// and the `*UnderLock` naming convention.
		// Scope is intentionally narrow: many leaf helpers (small
		// events, command handlers) are reached from a locked
		// orchestration path but the rule cannot trace that across
		// files. They are protected at the call site, not at the leaf.
		files: [
			"src/core/missions/MissionsController.ts",
			"src/core/report/ReportSmallEventService.ts",
			"src/core/report/ReportPveService.ts",
			"src/core/report/ReportCookingService.ts",
			"src/core/utils/withLockedPlayerSafe.ts",
			"src/core/smallEvents/**/*.ts"
		],
		rules: {
			"crownicles/no-unguarded-save": "error"
		}
	},
	{
		rules: {
			"no-restricted-imports": [
				"error",
				{
					"patterns": [
						"**/Discord/*",
						"**/RestWs/*"
					]
				}
			]
		}
	},
	globalIgnores(["src/core/utils/Astronomy.ts"])
]);

