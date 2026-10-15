// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const jsdoc = require("eslint-plugin-jsdoc");
const stylistic = require("@stylistic/eslint-plugin");
const sharedRules = require("../eslint-rules.mjs").default;
const crowniclesCustomRules = require("../eslint-custom-rules/index.mjs").default;

/**
 * The rules Core, Discord, Lib and RestWs share, adjusted where a React Native app cannot follow them.
 * Every rule changed here says why, so the gap with the other services stays deliberate.
 */
const APP_RULE_EXCEPTIONS = {
	// Names the app does not choose: OAuth and Keycloak wire fields, the font exports of @expo-google-fonts
	// and the token types of markdown-it. The other services silence these one line at a time.
	camelcase: ["error", {
		allow: [
			"^(access|refresh|id)_token$",
			"^(refresh_)?expires_in$",
			"^(token_type|session_state|ui_locales|kc_idp_hint|kc_action|grant_type|redirect_uri|client_id|code_verifier|error_description)$",
			"^Inter_\\d{3}\\w+$",
			"^(strong|em)_(open|close)$"
		]
	}],

	// react-native-gesture-handler builds gestures with capitalised factories (Gesture.Pan(), Gesture.Race()…),
	// and React Navigation does the same with its routers.
	"new-cap": ["error", {
		capIsNewExceptionPattern: "^Gesture\\.",
		capIsNewExceptions: ["StackRouter"]
	}]
};

/**
 * The other services do not lint their tests at all; the app keeps every rule on its tests except these.
 */
const APP_TEST_RULE_EXCEPTIONS = {
	// `await act(async () => …)` is how React Testing Library flushes the updates a synchronous call schedules:
	// the callback is async without awaiting anything, on purpose. Promise mocks follow the same shape.
	"require-await": "off",

	// Mock factories handed to jest.mock() and to fixtures describe throwaway shapes: typing every one of them
	// would only restate what the mocked module already declares.
	"@typescript-eslint/explicit-function-return-type": "off"
};

/** The player chooses when the app vibrates: every vibration goes through Haptics, which applies that setting. */
const HAPTICS_RESTRICTION = {
	name: "expo-haptics",
	importNames: ["impactAsync", "notificationAsync", "selectionAsync", "performAndroidHapticsAsync"],
	message: "Vibrate through Haptics from @/src/design/Haptics, which follows the player's vibration setting."
};

/**
 * Animation keyframe tables: one particle per line keeps its six frames side by side, so a timing reads across
 * the effect. One element and one property per line turned these 830 lines into 9 000 nobody could compare.
 */
const KEYFRAME_TABLES = {
	files: [
		"src/display/FightAttackSignatures.ts",
		"src/display/FightChoreography.ts",
		"src/display/FightEffectPrimitives.ts",
		"src/display/FightOutcomeEffects.ts",
		"src/display/FightSpellSignatures.ts",
		"src/display/FightTrajectories.ts",
		"src/display/PetDance.ts"
	],
	rules: {
		"@stylistic/array-bracket-newline": "off",
		"@stylistic/array-element-newline": "off",
		"@stylistic/object-curly-newline": "off",
		"@stylistic/max-len": "off"
	}
};

module.exports = defineConfig([
	expoConfig,
	{
		files: ["app.config.js", "plugins/**/*.js"],
		languageOptions: {
			globals: { __dirname: "readonly" }
		}
	},
	{
		ignores: ["dist/*"],
		rules: {
			"no-use-before-define": ["error", { variables: true }],
			"no-alert": "error",
			"react/jsx-boolean-value": ["error", "never"],
			"prefer-template": "error",
			"prefer-const": "error",
			"object-shorthand": ["error", "always"],
			"no-void": "error"
		}
	},

	// The tooling files stay in the CommonJS style Expo generates and documents: only the TypeScript sources follow the shared rules.
	{
		files: ["**/*.{ts,tsx}"],
		plugins: {
			jsdoc,
			"@stylistic": stylistic,
			crownicles: crowniclesCustomRules
		},
		rules: {
			...sharedRules,
			"crownicles/single-line-short-single-property-object": ["error", { maxLength: 40 }],
			...APP_RULE_EXCEPTIONS
		}
	},
	{
		files: ["__tests__/**/*.{ts,tsx}", "jest.setup.ts"],
		rules: APP_TEST_RULE_EXCEPTIONS
	},
	KEYFRAME_TABLES,

	// Screen formats are decided in docs/adr/0001-formats-ecran.html: windows are opened by the design primitives only.
	{
		files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
		ignores: ["src/design/**", "src/components/MapViewer.tsx", "src/components/WorldMap.tsx"],
		rules: {
			"no-restricted-imports": ["error", {
				paths: [
					{
						name: "react-native",
						importNames: ["Modal", "Alert"],
						message: "Use a screen format primitive (BottomSheet, QuestionSheet, FullScreen, Page, Toast, CelebrationModal): see App/docs/adr/0001-formats-ecran.html."
					},
					{
						name: "@/src/design/Sections",
						importNames: ["SheetModal", "ModalSurface"],
						message: "These build the primitives; use FullScreen or BottomSheet instead: see App/docs/adr/0001-formats-ecran.html."
					},
					HAPTICS_RESTRICTION
				]
			}]
		}
	},

	// iOS loses a window opened while another one moves or while the app wakes up: every native window waits its turn in NativeWindow.
	{
		files: ["src/design/**/*.{ts,tsx}"],
		ignores: ["src/design/NativeWindow.tsx", "src/design/Haptics.ts"],
		rules: {
			"no-restricted-imports": ["error", {
				paths: [
					{
						name: "react-native",
						importNames: ["Modal"],
						message: "Open native windows through NativeWindow, which waits for the app to be active and for the other windows to settle."
					},
					HAPTICS_RESTRICTION
				]
			}]
		}
	}
]);
