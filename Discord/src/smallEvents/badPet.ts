import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorBadPetIntimidateReaction,
	ReactionCollectorBadPetPleadReaction,
	ReactionCollectorBadPetGiveMeatReaction,
	ReactionCollectorBadPetGiveVegReaction,
	ReactionCollectorBadPetFleeReaction,
	ReactionCollectorBadPetHideReaction,
	ReactionCollectorBadPetWaitReaction,
	ReactionCollectorBadPetProtectReaction,
	ReactionCollectorBadPetDistractReaction,
	ReactionCollectorBadPetCalmReaction,
	ReactionCollectorBadPetShowcaseReaction,
	ReactionCollectorBadPetEnergizeReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
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
	[ReactionCollectorBadPetIntimidateReaction.name]: {
		id: "intimidate",
		icon: CrowniclesIcons.fightActions.roarAttack,
		labelKey: "intimidate"
	},
	[ReactionCollectorBadPetPleadReaction.name]: {
		id: "plead",
		icon: CrowniclesIcons.fightActions.divineAttack,
		labelKey: "plead"
	},
	[ReactionCollectorBadPetGiveMeatReaction.name]: {
		id: "giveMeat",
		icon: CrowniclesIcons.foods.carnivorousFood,
		labelKey: "giveMeat"
	},
	[ReactionCollectorBadPetGiveVegReaction.name]: {
		id: "giveVeg",
		icon: CrowniclesIcons.foods.herbivorousFood,
		labelKey: "giveVeg"
	},
	[ReactionCollectorBadPetFleeReaction.name]: {
		id: "flee",
		icon: CrowniclesIcons.fightActions.quickAttack,
		labelKey: "flee"
	},
	[ReactionCollectorBadPetHideReaction.name]: {
		id: "hide",
		icon: CrowniclesIcons.fightActions.stealth,
		labelKey: "hide"
	},
	[ReactionCollectorBadPetWaitReaction.name]: {
		id: "wait",
		icon: CrowniclesIcons.fightActions.resting,
		labelKey: "wait"
	},
	[ReactionCollectorBadPetProtectReaction.name]: {
		id: "protect",
		icon: CrowniclesIcons.fightActions.shieldAttack,
		labelKey: "protect"
	},
	[ReactionCollectorBadPetDistractReaction.name]: {
		id: "distract",
		icon: CrowniclesIcons.fightActions.confused,
		labelKey: "distract"
	},
	[ReactionCollectorBadPetCalmReaction.name]: {
		id: "calm",
		icon: CrowniclesIcons.unitValues.health,
		labelKey: "calm"
	},
	[ReactionCollectorBadPetShowcaseReaction.name]: {
		id: "showcase",
		icon: CrowniclesIcons.unitValues.petRarity,
		labelKey: "showcase"
	},
	[ReactionCollectorBadPetEnergizeReaction.name]: {
		id: "energize",
		icon: CrowniclesIcons.unitValues.energy,
		labelKey: "energize"
	}
};

export async function badPetCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction!.userLanguage;

	// Build description with choices
	let description = i18n.t("smallEvents:badPet.intro", { lng }) + "\n\n";

	const row = new ActionRowBuilder<ButtonBuilder>();

	for (const reaction of packet.reactions) {
		const mapping = REACTION_MAPPING[reaction.type];
		if (mapping) {
			description += `${mapping.icon} ${i18n.t(`smallEvents:badPet.choices.${mapping.labelKey}`, { lng })}\n`;

			row.addComponents(
				new ButtonBuilder()
					.setCustomId(mapping.id)
					.setEmoji(parseEmoji(mapping.icon)!)
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
				const mapping = REACTION_MAPPING[r.type];
				return mapping && mapping.id === buttonInteraction.customId;
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
