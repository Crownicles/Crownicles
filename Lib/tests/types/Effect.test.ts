import {
	describe, expect, it
} from "vitest";
import { Effect } from "../../src/types/Effect";

describe("Effect", () => {
	it("finds an effect by its id", () => {
		const effect = Effect.getById("jailed");

		expect(effect).toBe(Effect.JAILED);
		expect(effect?.id).toBe("jailed");
		expect(effect?.timeMinutes).toBe(1440);
		expect(effect?.v4Id).toBe(":lock:");
	});

	it("returns null for an unknown id", () => {
		expect(Effect.getById("unknown")).toBeNull();
	});

	it("lists every effect with a distinct id", () => {
		const all = [...Effect.getAll()];

		expect(all).toContain(Effect.NOT_STARTED);
		expect(all).toContain(Effect.FISHED);
		expect(all).toHaveLength(Object.values(Effect).filter(value => value instanceof Effect).length);
	});
});
