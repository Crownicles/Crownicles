import {describe, expect, it} from "vitest";
import {CrowniclesIcons} from "../../src/CrowniclesIcons";

describe("CrowniclesIcons Emoji Validation", () => {
	// Unicode variation selector characters
	const VARIATION_SELECTORS = {
		VS15: "\uFE0E", // Variation Selector-15 (force text presentation)
		VS16: "\uFE0F"  // Variation Selector-16 (force emoji presentation)
	};

	/**
	 * Checks if an emoji contains variation selectors
	 */
	function hasVariationSelector(emoji: string): boolean {
		return emoji.includes(VARIATION_SELECTORS.VS15) || emoji.includes(VARIATION_SELECTORS.VS16);
	}

	/**
	 * Cleans an emoji by removing variation selectors
	 */
	function cleanEmoji(emoji: string): string {
		return emoji
			.replace(VARIATION_SELECTORS.VS15, "")
			.replace(VARIATION_SELECTORS.VS16, "");
	}

	/**
	 * Recursively collects all emojis in an object
	 */
	function collectEmojis(obj: any, path: string = ""): Array<{ path: string; emoji: string }> {
		const emojis: Array<{ path: string; emoji: string }> = [];

		if (typeof obj === "string") {
			// It's an emoji
			emojis.push({path, emoji: obj});
		}
		else if (Array.isArray(obj)) {
			// It's an array
			obj.forEach((item, index) => {
				emojis.push(...collectEmojis(item, `${path}[${index}]`));
			});
		}
		else if (typeof obj === "object" && obj !== null) {
			// It's an object
			Object.entries(obj).forEach(([key, value]) => {
				const newPath = path ? `${path}.${key}` : key;
				emojis.push(...collectEmojis(value, newPath));
			});
		}

		return emojis;
	}

	it("should not contain emojis with variation selectors", () => {
		const allEmojis = collectEmojis(CrowniclesIcons);
		const problematicEmojis: Array<{ path: string; emoji: string; cleanedEmoji: string }> = [];

		allEmojis.forEach(({path, emoji}) => {
			if (hasVariationSelector(emoji)) {
				problematicEmojis.push({
					path,
					emoji,
					cleanedEmoji: cleanEmoji(emoji)
				});
			}
		});

		// Display statistics in all cases
		console.log(`\n📊 Emoji analysis results:`);
		console.log(`   - Total emojis analyzed: ${allEmojis.length}`);
		console.log(`   - Emojis with variation selectors: ${problematicEmojis.length}`);

		if (problematicEmojis.length > 0) {
			console.log(`\n⚠️  Problematic emojis detected:`);

			// Show first 10 to avoid spamming
			const toShow = problematicEmojis.slice(0, 10);
			toShow.forEach(({path, emoji, cleanedEmoji}) => {
				console.log(`   - ${path}: "${emoji}" → "${cleanedEmoji}"`);
			});

			if (problematicEmojis.length > 10) {
				console.log(`   ... and ${problematicEmojis.length - 10} others`);
			}
			expect(problematicEmojis.length).toBe(0);
		}

		expect(problematicEmojis).toEqual([]);
	});

	it("should correctly detect variation selectors", () => {
		// Test with known examples
		expect(hasVariationSelector("🐉️")).toBe(true);  // Dragon with VS16
		expect(hasVariationSelector("🐉")).toBe(false);  // Dragon without selector
		expect(hasVariationSelector("🦄️")).toBe(true);  // Unicorn with VS16
		expect(hasVariationSelector("🦄")).toBe(false);  // Unicorn without selector
	});

	it("should correctly clean emojis", () => {
		expect(cleanEmoji("🐉️")).toBe("🐉");
		expect(cleanEmoji("🦄️")).toBe("🦄");
		expect(cleanEmoji("🕊️")).toBe("🕊");
		expect(cleanEmoji("🐿️")).toBe("🐿");
		expect(cleanEmoji("🦔️")).toBe("🦔");
		expect(cleanEmoji("🦖️")).toBe("🦖");

		// Test with emoji without selector (should not change)
		expect(cleanEmoji("🐉")).toBe("🐉");
		expect(cleanEmoji("😀")).toBe("😀");
	});

	it("should be able to identify selector types", () => {
		const emojiWithVS16 = "🐉️"; // Dragon with VS16
		const emojiWithVS15 = "🐉︎"; // Dragon with VS15 (if supported)

		expect(emojiWithVS16.includes(VARIATION_SELECTORS.VS16)).toBe(true);
		expect(emojiWithVS16.includes(VARIATION_SELECTORS.VS15)).toBe(false);
		expect(emojiWithVS15.includes(VARIATION_SELECTORS.VS16)).toBe(false);
		expect(emojiWithVS15.includes(VARIATION_SELECTORS.VS15)).toBe(true);
	});

	it("should count the total number of emojis in CrowniclesIcons", () => {
		const allEmojis = collectEmojis(CrowniclesIcons);

		// Check that we've collected emojis
		expect(allEmojis.length).toBeGreaterThan(100);

		// Display some useful statistics
		const uniqueEmojis = new Set(allEmojis.map(e => e.emoji));
		const withVariationSelectors = allEmojis.filter(e => hasVariationSelector(e.emoji));

		console.log(`📊 CrowniclesIcons emoji statistics:`);
		console.log(`   - Total emojis: ${allEmojis.length}`);
		console.log(`   - Unique emojis: ${uniqueEmojis.size}`);
		console.log(`   - With variation selectors: ${withVariationSelectors.length}`);
	});
});