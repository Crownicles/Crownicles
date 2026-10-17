import {
	InteractionEditReplyOptions, Message, MessageFlags
} from "discord.js";
import { CrowniclesInteraction } from "./CrowniclesInteraction";

export async function editNestedMenuMessage(
	message: Message,
	interaction: CrowniclesInteraction | undefined,
	options: Parameters<Message["edit"]>[0]
): Promise<void> {
	if (message.flags?.has(MessageFlags.Ephemeral) && interaction) {
		await interaction.editReply(options as InteractionEditReplyOptions);
		return;
	}
	await message.edit(options);
}
