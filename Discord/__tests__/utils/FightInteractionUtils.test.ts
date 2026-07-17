import {
	describe, expect, it, vi
} from "vitest";
import { deferFightInteraction } from "../../src/commands/player/FightInteractionUtils";

describe("deferFightInteraction", () => {
	it("defers an untouched interaction", async () => {
		const interaction = {
			deferred: false,
			replied: false,
			deferReply: vi.fn().mockResolvedValue(undefined)
		};

		await deferFightInteraction(interaction as never);

		expect(interaction.deferReply).toHaveBeenCalledOnce();
	});

	it("does not defer an already deferred interaction", async () => {
		const interaction = {
			deferred: true,
			replied: false,
			deferReply: vi.fn()
		};

		await deferFightInteraction(interaction as never);

		expect(interaction.deferReply).not.toHaveBeenCalled();
	});

	it("does not defer an already replied interaction", async () => {
		const interaction = {
			deferred: false,
			replied: true,
			deferReply: vi.fn()
		};

		await deferFightInteraction(interaction as never);

		expect(interaction.deferReply).not.toHaveBeenCalled();
	});
});