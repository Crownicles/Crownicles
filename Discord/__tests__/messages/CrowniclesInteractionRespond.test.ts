import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	BaseGuildTextChannel, CommandInteraction, Message
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import {
	CrowniclesInteraction, SendManner
} from "../../src/messages/CrowniclesInteraction";
import { LANGUAGE } from "../../../Lib/src/Language";

const sentMessage = { id: "sent-message-id" } as Message;
const content = { content: "Core's response" };

/**
 * A discord.js interaction in the given acknowledgement state, cast like the cached commands and clicks
 */
function castInteraction(state: {
	deferred: boolean; replied: boolean;
}): CrowniclesInteraction {
	return CrowniclesInteraction.cast({
		...state,
		channel: Object.create(BaseGuildTextChannel.prototype),
		isCommand: (): boolean => false
	} as never, LANGUAGE.FRENCH);
}

describe("CrowniclesInteraction.respond (#2730)", () => {
	beforeEach(() => {
		vi.spyOn(CommandInteraction.prototype, "reply").mockResolvedValue({ resource: { message: sentMessage } } as never);
		vi.spyOn(CommandInteraction.prototype, "editReply").mockResolvedValue(sentMessage as never);
		vi.spyOn(CommandInteraction.prototype, "followUp").mockResolvedValue(sentMessage as never);
		vi.spyOn(BaseGuildTextChannel.prototype, "send").mockResolvedValue(sentMessage as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("replies to an interaction not acknowledged yet, and returns the message of the reply (#3386)", async () => {
		const interaction = castInteraction({
			deferred: false, replied: false
		});

		expect(await interaction.respond(content)).toBe(sentMessage);
		expect(CommandInteraction.prototype.reply).toHaveBeenCalledWith({
			...content,
			withResponse: true
		});
	});

	it("edits the deferred reply while it waits for its content", async () => {
		const interaction = castInteraction({
			deferred: true, replied: false
		});

		await interaction.respond(content);

		expect(CommandInteraction.prototype.editReply).toHaveBeenCalledWith(content);
		expect(CommandInteraction.prototype.reply).not.toHaveBeenCalled();
	});

	it("follows up an interaction already answered", async () => {
		const interaction = castInteraction({
			deferred: true, replied: true
		});

		await interaction.respond(content);

		expect(CommandInteraction.prototype.followUp).toHaveBeenCalledWith(content);
		expect(CommandInteraction.prototype.editReply).not.toHaveBeenCalled();
	});

	it("uses the manner the caller forces", async () => {
		const interaction = castInteraction({
			deferred: false, replied: false
		});

		await interaction.respond(content, { manner: SendManner.SEND });

		expect(BaseGuildTextChannel.prototype.send).toHaveBeenCalledWith(content);
		expect(CommandInteraction.prototype.reply).not.toHaveBeenCalled();
	});

	it("makes a reply or a follow-up ephemeral, but not an edit of the deferred reply", async () => {
		await castInteraction({
			deferred: false, replied: false
		}).respond({
			...content, ephemeral: true
		});
		await castInteraction({
			deferred: true, replied: false
		}).respond({
			...content, ephemeral: true
		});

		expect(CommandInteraction.prototype.reply).toHaveBeenCalledWith({
			...content,
			flags: MessageFlags.Ephemeral,
			withResponse: true
		});
		expect(CommandInteraction.prototype.editReply).toHaveBeenCalledWith(content);
	});
});
