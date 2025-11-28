import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedField
} from "discord.js";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { Language } from "../../../../Lib/src/Language";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import {
	CommandInventoryPacketReq,
	CommandInventoryPacketRes,
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { MessageFlags } from "discord-api-types/v10";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { disableRows } from "../../utils/DiscordCollectorUtils";

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandInventoryPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}

	return makePacket(CommandInventoryPacketReq, { askedPlayer });
}

function getBackupField<T = MainItemDisplayPacket | SupportItemDisplayPacket>(
	lng: Language,
	items: {
		display: T;
		slot: number;
	}[],
	slots: number,
	toFieldFunc: (displayPacket: T, language: Language) => EmbedField,
	itemKind: string
): EmbedField {
	const formattedTitle = i18n.t(`commands:inventory.${itemKind}`, {
		lng,
		count: items.length,
		max: slots - 1
	});
	if (slots <= 1) {
		return {
			name: formattedTitle,
			value: i18n.t("commands:inventory.noSlot", { lng }),
			inline: false
		};
	}
	let value = "";
	for (let i = 1; i < slots; ++i) {
		const search = items.find(item => item.slot === i);
		if (!search) {
			value += i18n.t("commands:inventory.emptySlot", { lng });
		}
		else {
			value += toFieldFunc(search.display, lng).value;
		}
		value += "\n";
	}
	return {
		name: formattedTitle,
		value,
		inline: false
	};
}

function getEquippedEmbed(packet: CommandInventoryPacketRes, pseudo: string, lng: Language): CrowniclesEmbed {
	if (packet.data) {
		// Build talisman display value
		let talismanValue: string;
		if (packet.hasTalisman || packet.hasCloneTalisman) {
			const talismans: string[] = [];
			if (packet.hasTalisman) {
				talismans.push(i18n.t("commands:inventory.anchorTalismanOwned", { lng }));
			}
			if (packet.hasCloneTalisman) {
				talismans.push(i18n.t("commands:inventory.cloneTalismanOwned", { lng }));
			}
			talismanValue = talismans.join("\n");
		}
		else {
			talismanValue = i18n.t("commands:inventory.talismanNotOwned", { lng });
		}

		const embed = new CrowniclesEmbed()
			.setTitle(i18n.t("commands:inventory.title", {
				lng,
				pseudo
			}))
			.addFields([
				DiscordItemUtils.getWeaponField(packet.data.weapon, lng),
				DiscordItemUtils.getArmorField(packet.data.armor, lng),
				DiscordItemUtils.getPotionField(packet.data.potion, lng),
				DiscordItemUtils.getObjectField(packet.data.object, lng),
				{
					name: i18n.t("commands:inventory.talisman", { lng }),
					value: talismanValue,
					inline: false
				}
			]);
		return embed;
	}

	throw new Error("Inventory packet data must not be undefined");
}

function getBackupEmbed(packet: CommandInventoryPacketRes, pseudo: string, lng: Language): CrowniclesEmbed {
	if (packet.data) {
		return new CrowniclesEmbed()
			.setTitle(i18n.t("commands:inventory.stockTitle", {
				lng,
				pseudo
			}))
			.addFields([
				getBackupField(lng, packet.data.backupWeapons, packet.data.slots.weapons, DiscordItemUtils.getWeaponField, "weapons"),
				getBackupField(lng, packet.data.backupArmors, packet.data.slots.armors, DiscordItemUtils.getArmorField, "armors"),
				getBackupField(lng, packet.data.backupPotions, packet.data.slots.potions, DiscordItemUtils.getPotionField, "potions"),
				getBackupField(lng, packet.data.backupObjects, packet.data.slots.objects, DiscordItemUtils.getObjectField, "objects")
			]);
	}

	throw new Error("Inventory packet data must not be undefined");
}

export async function handleCommandInventoryPacketRes(packet: CommandInventoryPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	if (!packet.foundPlayer) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:playerDoesntExist", { lng })
				)
			],
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const username = await DisplayUtils.getEscapedUsername(packet.keycloakId!, lng);
	let equippedView = true;
	const buttonId = "switchItems";
	const equippedButtonLabel = i18n.t("commands:inventory.seeEquippedItems", { lng });
	const backupButtonLabel = i18n.t("commands:inventory.seeBackupItems", { lng });
	const switchItemsButton = new ButtonBuilder()
		.setCustomId(buttonId)
		.setLabel(backupButtonLabel)
		.setStyle(ButtonStyle.Primary);
	const equippedEmbed = getEquippedEmbed(packet, username, lng);
	const backupEmbed = getBackupEmbed(packet, username, lng);
	const reply = await interaction.reply({
		embeds: [equippedEmbed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(switchItemsButton)],
		withResponse: true
	});
	if (!reply?.resource?.message) {
		return;
	}
	const msg = reply.resource.message;
	const collector = msg.createMessageComponentCollector({
		filter: buttonInteraction => buttonInteraction.customId === buttonId,
		time: Constants.MESSAGES.COLLECTOR_TIME
	});
	collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		equippedView = !equippedView;
		switchItemsButton.setLabel(equippedView ? backupButtonLabel : equippedButtonLabel);
		await buttonInteraction.update({
			embeds: [equippedView ? equippedEmbed : backupEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(switchItemsButton)]
		});
	});
	collector.on("end", async () => {
		// Disable buttons instead of removing them
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(switchItemsButton.setDisabled(true));
		disableRows([row]);

		await msg.edit({ components: [row] });
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("inventory")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("inventory", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("inventory", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
