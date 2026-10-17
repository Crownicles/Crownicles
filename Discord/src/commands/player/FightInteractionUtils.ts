import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

export async function deferFightInteraction(interaction: CrowniclesInteraction): Promise<void> {
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply();
	}
}
