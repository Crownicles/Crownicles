import { vi } from "vitest";

type UpdatableInteraction = {
	update: (options: unknown) => Promise<unknown>;
};

type DeferrableInteraction = {
	deferUpdate: () => Promise<unknown>;
	deferReply: () => Promise<unknown>;
};

type EditableMessage = {
	edit: (options: unknown) => Promise<unknown>;
};

/**
 * Nominal behaviour of the DiscordCollectorUtils acknowledgement helpers, for the tests mocking that module:
 * the acknowledgement is awaited and succeeds, the cosmetic edits are applied.
 * The vi.mock factories are hoisted above the static imports, so they load this module through a dynamic import
 */
export const collectorAcknowledgementMocks = {
	deferUpdate: vi.fn(async (interaction: DeferrableInteraction): Promise<boolean> => {
		await interaction.deferUpdate();
		return true;
	}),
	deferReply: vi.fn(async (interaction: DeferrableInteraction): Promise<boolean> => {
		await interaction.deferReply();
		return true;
	}),
	updateComponentMessage: vi.fn(async (interaction: UpdatableInteraction, options: unknown): Promise<boolean> => {
		await interaction.update(options);
		return true;
	}),
	editWithoutBlocking: vi.fn(async (message: EditableMessage, options: unknown): Promise<void> => {
		await message.edit(options);
	})
};
