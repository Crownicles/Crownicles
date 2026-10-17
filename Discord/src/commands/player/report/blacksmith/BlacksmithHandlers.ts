import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

export type BlacksmithReplyConfig = {
	context: PacketContext;
	titleKey: string;
	descriptionKey: string;
	descriptionParams?: Record<string, unknown>;
};

export async function sendBlacksmithReply(config: BlacksmithReplyConfig): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(config.context);
	if (!interaction) {
		return;
	}
	const lng = config.context.discord!.language;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t(config.titleKey, {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(config.context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t(config.descriptionKey, {
			lng, ...config.descriptionParams
		}));
	await interaction.editReply({
		embeds: [embed]
	});
}

/**
 * Result of a city service acting on an enchantment: every field of the packet is a parameter of the description
 */
type EnchantmentReplyPacket = {
	enchantmentId: string;
	enchantmentType: string;
};

export async function sendEnchantmentReply(
	context: PacketContext,
	keys: Pick<BlacksmithReplyConfig, "titleKey" | "descriptionKey">,
	packet: EnchantmentReplyPacket
): Promise<void> {
	await sendBlacksmithReply({
		context,
		...keys,
		descriptionParams: { ...packet }
	});
}
