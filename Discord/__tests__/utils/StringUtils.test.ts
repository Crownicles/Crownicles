import {beforeEach, describe, expect, it, vi} from 'vitest';
import {escapeUsername, StringUtils} from "../../src/utils/StringUtils";
import i18n from "../../src/translations/i18n";

vi.mock('../../src/translations/i18n', () => {
	return {
		default: {
			t: vi.fn(),
			tArray: vi.fn()
		}
	};
});


describe('escapeUsername', () => {
	it('should remove Discord formatting characters from usernames', () => {
		expect(escapeUsername('normal_user')).toBe('normaluser');
		expect(escapeUsername('*bold*')).toBe('bold');
		expect(escapeUsername('_italic_')).toBe('italic');
		expect(escapeUsername('`code`')).toBe('code');
		expect(escapeUsername('|spoiler|')).toBe('spoiler');
		expect(escapeUsername('mix*ed_for`mat|ting')).toBe('mixedformatting');
	});

	it('should return "." if all characters are removed', () => {
		expect(escapeUsername('***')).toBe('.');
		expect(escapeUsername('_|`*')).toBe('.');
	});

	it('should handle empty strings', () => {
		expect(escapeUsername('')).toBe('.');
	});

	it('should preserve non-formatting characters', () => {
		expect(escapeUsername('user123!')).toBe('user123!');
		expect(escapeUsername('👍🔥cool')).toBe('👍🔥cool');
	});
});

describe('StringUtils', () => {
	beforeEach(() => {
		// Reset mock between __tests__
		vi.resetAllMocks();
	});

	describe('getRandomTranslation', () => {
		it('should return a random item from the translation array', () => {
			// Setup
			const mockTranslations = ['Hello', 'Hi', 'Hey'];
			(i18n.tArray as any).mockReturnValue(mockTranslations);

			// Mock Math.random to return a predictable value
			const randomSpy = vi.spyOn(Math, 'floor');
			randomSpy.mockReturnValue(1); // Will select index 1 ('Hi')

			// Execute
			const result = StringUtils.getRandomTranslation('greeting', "en");

			// Assert
			expect(i18n.tArray).toHaveBeenCalledWith('greeting', {
				lng: "en"
			});
			expect(result).toBe('Hi');

			// Cleanup
			randomSpy.mockRestore();
		});

		it('should pass replacements to i18n.t', () => {
			// Setup
			const mockTranslations = ['Hello {{name}}', 'Hi {{name}}'];
			(i18n.tArray as any).mockReturnValue(mockTranslations);
			const randomSpy = vi.spyOn(Math, 'floor').mockReturnValue(0);

			// Execute
			const result = StringUtils.getRandomTranslation('greeting', "fr", {name: 'John'});

			// Assert
			expect(i18n.tArray).toHaveBeenCalledWith('greeting', {
				lng: "fr",
				name: 'John'
			});

			// Cleanup
			randomSpy.mockRestore();
		});
	});

	describe('capitalizeFirstLetter', () => {
		it('should capitalize the first letter of a string', () => {
			expect(StringUtils.capitalizeFirstLetter('hello')).toBe('Hello');
			expect(StringUtils.capitalizeFirstLetter('world')).toBe('World');
		});

		it('should handle empty strings', () => {
			expect(StringUtils.capitalizeFirstLetter('')).toBe('');
		});

		it('should handle single character strings', () => {
			expect(StringUtils.capitalizeFirstLetter('a')).toBe('A');
			expect(StringUtils.capitalizeFirstLetter('z')).toBe('Z');
		});

		it('should not affect strings that already start with a capital letter', () => {
			expect(StringUtils.capitalizeFirstLetter('Hello')).toBe('Hello');
			expect(StringUtils.capitalizeFirstLetter('CAPS')).toBe('CAPS');
		});

		it('should handle strings with non-alphabetic first characters', () => {
			expect(StringUtils.capitalizeFirstLetter('123abc')).toBe('123abc');
			expect(StringUtils.capitalizeFirstLetter('!test')).toBe('!test');
		});
	});
});