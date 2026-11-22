import assert from "node:assert/strict";
import { test } from "node:test";
import {
	findParityErrors, findPlaceholders, findSyncErrors, flattenTranslations, SYNC_ERRORS
} from "./check-translations.mjs";

const locale = entries => new Map(Object.entries(entries));

test("nested objects and arrays are flattened under the file name", () => {
	assert.deepEqual([...flattenTranslations({ menu: { title: "Titre" }, advices: ["a", "b"] }, "commands")], [
		["commands.menu.title", "Titre"],
		["commands.advices.0", "a"],
		["commands.advices.1", "b"]
	]);
});

test("placeholders ignore formatting options and duplicates", () => {
	assert.deepEqual(
		findPlaceholders("{emote:unitEmotes.ok} {{count, number}} {{count}} {command:profile} $t(models:pets.{{petId}})"),
		["$t(models:pets.{{petId}})", "{command:profile}", "{emote:unitEmotes.ok}", "{{count}}"]
	);
});

test("missing and orphan keys of a locale are reported", () => {
	const errors = findParityErrors({
		fr: locale({ "bot.a": "A", "bot.b": "B" }),
		en: locale({ "bot.a": "A", "bot.c": "C" })
	});
	assert.deepEqual(errors.map(({ locale, key }) => `${locale}:${key}`), ["en:bot.b", "en:bot.c"]);
});

test("a French edit not mirrored in another locale is reported", () => {
	const base = { fr: locale({ "bot.a": "Bonjour", "bot.b": "Salut" }), en: locale({ "bot.a": "Hello", "bot.b": "Hi" }) };
	const head = { fr: locale({ "bot.a": "Bonjour !", "bot.b": "Salut !" }), en: locale({ "bot.a": "Hello!", "bot.b": "Hi" }) };
	assert.deepEqual(findSyncErrors(base, head).map(({ kind, key }) => `${kind}:${key}`), [`${SYNC_ERRORS.NOT_UPDATED}:bot.b`]);
});

test("added keys and translation-only edits do not require a French edit", () => {
	const base = { fr: locale({ "bot.a": "Bonjour" }), en: locale({ "bot.a": "Helo" }) };
	const head = { fr: locale({ "bot.a": "Bonjour", "bot.b": "Nouveau" }), en: locale({ "bot.a": "Hello", "bot.b": "New" }) };
	assert.deepEqual(findSyncErrors(base, head), []);
});

test("added or edited translations must keep the French placeholders", () => {
	const base = { fr: locale({ "bot.a": "{{pseudo}} a gagné" }), en: locale({ "bot.a": "{{pseudo}} won" }) };
	const head = {
		fr: locale({ "bot.a": "{{pseudo}} a gagné {{count}} points", "bot.b": "{emote:ok} Fini" }),
		en: locale({ "bot.a": "{{pseudo}} won {{amount}} points", "bot.b": "Done" })
	};
	assert.deepEqual(findSyncErrors(base, head).map(({ kind, key }) => `${kind}:${key}`), [
		`${SYNC_ERRORS.PLACEHOLDERS}:bot.a`,
		`${SYNC_ERRORS.PLACEHOLDERS}:bot.b`
	]);
});

test("untouched translations are not checked for placeholders", () => {
	const base = { fr: locale({ "bot.a": "{{pseudo}}" }), en: locale({ "bot.a": "legacy" }) };
	assert.deepEqual(findSyncErrors(base, base), []);
});

test("a French-only edit that changes the placeholders is reported even when edits are allowed", () => {
	const base = { fr: locale({ "bot.a": "Bonjour" }), en: locale({ "bot.a": "Hello" }) };
	const head = { fr: locale({ "bot.a": "Bonjour {{pseudo}}" }), en: locale({ "bot.a": "Hello" }) };
	assert.deepEqual(findSyncErrors(base, head).map(({ kind }) => kind), [SYNC_ERRORS.NOT_UPDATED, SYNC_ERRORS.PLACEHOLDERS]);
});
