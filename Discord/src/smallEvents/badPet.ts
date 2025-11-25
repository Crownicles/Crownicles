import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorBadPetSmallEventData } from "../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
import { StringUtils } from "../utils/StringUtils";
import { PetUtils } from "../utils/PetUtils";
import { SexTypeShort } from "../../../Lib/src/constants/StringConstants";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, parseEmoji
} from "discord.js";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../bot/CrowniclesShard";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";

const REACTION_MAPPING: Record<string, {
	id: string;
	icon: string;
	labelKey: string;
}> = {
	intimidate: {
		id: "intimidate",
		icon: CrowniclesIcons.fightActions.roarAttack,
		labelKey: "intimidate"
	},
	plead: {
		id: "plead",
		icon: CrowniclesIcons.fightActions.divineAttack,
		labelKey: "plead"
	},
	giveMeat: {
		id: "giveMeat",
		icon: CrowniclesIcons.foods.carnivorousFood,
		labelKey: "giveMeat"
	},
	giveVeg: {
		id: "giveVeg",
		icon: CrowniclesIcons.foods.herbivorousFood,
		labelKey: "giveVeg"
	},
	flee: {
		id: "flee",
		icon: CrowniclesIcons.fightActions.quickAttack,
		labelKey: "flee"
	},
	hide: {
		id: "hide",
		icon: CrowniclesIcons.fightActions.stealth,
		labelKey: "hide"
	},
	wait: {
		id: "wait",
		icon: CrowniclesIcons.fightActions.resting,
		labelKey: "wait"
	},
	protect: {
		id: "protect",
		icon: CrowniclesIcons.fightActions.shieldAttack,
		labelKey: "protect"
	},
	distract: {
		id: "distract",
		icon: CrowniclesIcons.fightActions.confused,
		labelKey: "distract"
	},
	calm: {
		id: "calm",
		icon: CrowniclesIcons.unitValues.health,
		labelKey: "calm"
	},
	imposer: {
		id: "imposer",
		icon: CrowniclesIcons.unitValues.petRarity,
		labelKey: "imposer"
	},
	energize: {
		id: "energize",
		icon: CrowniclesIcons.unitValues.energy,
		labelKey: "energize"
	}
};

export async function badPetCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction!.userLanguage;
	const data = packet.data.data as ReactionCollectorBadPetSmallEventData;

	const petDisplay = PetUtils.petToShortString(lng, data.petNickname, data.petId, data.sex as SexTypeShort);

	let description = StringUtils.getRandomTranslation("smallEvents:badPet.intro", lng, { pet: petDisplay }) + "\n\n";

	const row = new ActionRowBuilder<ButtonBuilder>();

	for (const reaction of packet.reactions) {
		const reactId = (reaction.data as unknown as { id?: string }).id;
		const mapping = reactId ? REACTION_MAPPING[reactId] : undefined;
		if (mapping) {
			const iconFromLib = CrowniclesIcons.badPetSmallEvent[reactId!];
			const icon = iconFromLib ?? mapping.icon ?? "";

			description += `${icon} ${i18n.t(`smallEvents:badPet.choices.${mapping.labelKey}`, { lng })}\n`;

			row.addComponents(
				new ButtonBuilder()
					.setCustomId(mapping.id)
					.setEmoji(parseEmoji(icon) ?? icon)
					.setStyle(ButtonStyle.Secondary)
			);
		}
	}

	const embed = new CrowniclesSmallEventEmbed(
		"badPet",
		description,
		interaction.user,
		lng
	);

	const msg = await interaction.editReply({
		embeds: [embed],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async buttonInteraction => {
		if (buttonInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		const getReactingPlayer = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, buttonInteraction.user.id, buttonInteraction.user.displayName);
		if (!getReactingPlayer.isError && getReactingPlayer.payload.keycloakId) {
			await buttonInteraction.deferReply();

			// Disable buttons
			row.components.forEach(c => c.setDisabled(true));
			await msg.edit({ components: [row] });

			// Find the reaction index based on customId
			const reactionIndex = packet.reactions.findIndex(r => {
				const id = (r.data as unknown as { id?: string }).id;
				return id === buttonInteraction.customId;
			});

			if (reactionIndex !== -1) {
				DiscordCollectorUtils.sendReaction(packet, context, getReactingPlayer.payload.keycloakId, buttonInteraction, reactionIndex);
			}
			collector.stop();
		}
	});

	collector.on("end", async () => {
		row.components.forEach(c => c.setDisabled(true));
		await msg.edit({ components: [row] });
	});

	return [collector];
}
