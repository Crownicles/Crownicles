import {ICommand} from "../ICommand";
import {makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {DraftbotInteraction} from "../../messages/DraftbotInteraction";
import i18n from "../../translations/i18n";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {SlashCommandBuilder} from "@discordjs/builders";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedField} from "discord.js";
import {Constants} from "../../../../Lib/src/constants/Constants";
import {DiscordCache} from "../../bot/DiscordCache";
import {DraftBotErrorEmbed} from "../../messages/DraftBotErrorEmbed";
import {Language} from "../../../../Lib/src/Language";
import {KeycloakUser} from "../../../../Lib/src/keycloak/KeycloakUser";
import {KeycloakUtils} from "../../../../Lib/src/keycloak/KeycloakUtils";
import {keycloakConfig} from "../../bot/DraftBotShard";
import {
	CommandInventoryPacketReq,
	CommandInventoryPacketRes,
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import {DiscordItemUtils} from "../../utils/DiscordItemUtils";
import {sendInteractionNotForYou} from "../../utils/ErrorUtils";
import {PacketUtils} from "../../utils/PacketUtils";

async function getPacket(interaction: DraftbotInteraction, keycloakUser: KeycloakUser): Promise<CommandInventoryPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}

	return makePacket(CommandInventoryPacketReq, {askedPlayer});
}

function getBackupField<T = MainItemDisplayPacket | SupportItemDisplayPacket>(
	lng: Language,
	items: {
		display: T,
		slot: number
	}[],
	slots: number,
	toFieldFunc: (displayPacket: T, language: Language) => EmbedField,
	itemKind: string
): EmbedField {
	const formattedTitle = i18n.t(`commands:inventory.${itemKind}`, {lng, count: items.length, max: slots - 1});
	if (slots <= 1) {
		return {
			name: formattedTitle,
			value: i18n.t("commands:inventory.noSlot", {lng}),
			inline: false
		};
	}
	let value = "";
	for (let i = 1; i < slots; ++i) {
		const search = items.find(item => item.slot === i);
		if (!search) {
			value += i18n.t("commands:inventory.emptySlot", {lng});
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

function getEquippedEmbed(packet: CommandInventoryPacketRes, pseudo: string, lng: Language): DraftBotEmbed {
	if (packet.data) {
		return new DraftBotEmbed()
			.setTitle(i18n.t("commands:inventory.title", {
				lng,
				pseudo
			}))
			.addFields([
				DiscordItemUtils.getWeaponField(packet.data.weapon, lng),
				DiscordItemUtils.getArmorField(packet.data.armor, lng),
				DiscordItemUtils.getPotionField(packet.data.potion, lng),
				DiscordItemUtils.getObjectField(packet.data.object, lng)
			]);
	}

	throw new Error("Inventory packet data must not be undefined");
}

function getBackupEmbed(packet: CommandInventoryPacketRes, pseudo: string, lng: Language): DraftBotEmbed {
	if (packet.data) {
		return new DraftBotEmbed()
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

	if (interaction) {
		if (!packet.foundPlayer) {
			await interaction.reply({
				embeds: [
					new DraftBotErrorEmbed(
						interaction.user,
						interaction,
						i18n.t("error:playerDoesntExist", {lng: interaction.userLanguage})
					)
				]
			});
			return;
		}

		const keycloakUser = (await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId!))!;
		let equippedView = true;

		const buttonId = "switchItems";
		const equippedButtonLabel = i18n.t("commands:inventory.seeEquippedItems", {lng: interaction.userLanguage});
		const backupButtonLabel = i18n.t("commands:inventory.seeBackupItems", {lng: interaction.userLanguage});

		const switchItemsButton = new ButtonBuilder()
			.setCustomId(buttonId)
			.setLabel(backupButtonLabel)
			.setStyle(ButtonStyle.Primary);

		const equippedEmbed = getEquippedEmbed(packet, keycloakUser.attributes.gameUsername[0], interaction.userLanguage);
		const backupEmbed = getBackupEmbed(packet, keycloakUser.attributes.gameUsername[0], interaction.userLanguage);

		const msg = await interaction.reply({
			embeds: [equippedEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(switchItemsButton)]
		});

		const collector = msg.createMessageComponentCollector({
			filter: i => i.customId === buttonId, // TODO: rename single letter variable to something clearer
			time: Constants.MESSAGES.COLLECTOR_TIME
		});
		collector.on("collect", async (i: ButtonInteraction) => {
			if (i.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(i.user, i, interaction.userLanguage);
				return;
			}

			equippedView = !equippedView;
			switchItemsButton.setLabel(equippedView ? backupButtonLabel : equippedButtonLabel);
			await i.update({
				embeds: [equippedView ? equippedEmbed : backupEmbed],
				components: [new ActionRowBuilder<ButtonBuilder>().addComponents(switchItemsButton)]
			});
		});
	}
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