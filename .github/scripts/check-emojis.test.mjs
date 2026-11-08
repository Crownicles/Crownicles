import assert from "node:assert/strict";
import { test } from "node:test";
import { findEmojis, findEmojisInJson } from "./check-emojis.mjs";

test("emojis are detected", () => {
	for (const emoji of ["✨", "🔥", "⭐", "◾", "⚔", "✔", "❤", "▶", "🇫🇷", "1️⃣", "©️", "↗️"]) {
		assert.notDeepEqual(findEmojis(`fix: something ${emoji} here`), [], emoji);
	}
});

test("typographic and technical symbols are allowed", () => {
	for (const symbol of ["→", "←", "↔", "↗", "↩", "⌊x⌋", "⌘", "✓", "✗", "©", "®", "™", "‼", "•", "…", "« »", "—", "·", "☆"]) {
		assert.deepEqual(findEmojis(`fix: something ${symbol} here`), [], symbol);
	}
});

test("all emojis of a message are reported once", () => {
	assert.deepEqual(findEmojis("🔥 fix ✨ and 🔥 again"), ["✨", "🔥"]);
});

test("escaped emojis in translations are detected through the decoded JSON", () => {
	const translations = JSON.parse("{\"menu\": {\"label\": \"\\ud83d\\ude00 hello\", \"ok\": \"fine → {emote:unitEmotes.ok}\"}}");
	assert.deepEqual(findEmojisInJson(translations), [{ path: ["menu", "label"], emojis: ["😀"] }]);
});

test("emojis in translation arrays are reported with their index", () => {
	assert.deepEqual(findEmojisInJson({ advices: ["fine", "bad ⭐"] }), [{ path: ["advices", "1"], emojis: ["⭐"] }]);
});
