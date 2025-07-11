import { describe, it, expect } from 'vitest';
import {Astronomy} from "../../../src/core/utils/Astronomy";

describe('Astronomy', () => {
	describe('VerifyBoolean', () => {
		it('should return if a boolean is not actually a boolean', () => {
			expect(Astronomy.VerifyBoolean(true)).toBe(true);
			expect(Astronomy.VerifyBoolean("not a bool")).toBe("Value is not boolean: not a bool");
		});
	});
});