import {
	CrowniclesCachedMessage, CrowniclesCachedMessages
} from "./CrowniclesCachedMessage";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import i18n from "../translations/i18n";
import { CommandFightHistoryItemPacket } from "../../../Lib/src/packets/fights/FightHistoryItemPacket";
import { EmoteUtils } from "../utils/EmoteUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { FightAlterationState } from "../../../Lib/src/types/FightAlterationResult";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { CrowniclesFightStatusCachedMessage } from "./CrowniclesFightStatusCachedMessage";
import { StringUtils } from "../utils/StringUtils";
import { CrowniclesActionChooseCachedMessage } from "./CrowniclesActionChooseCachedMessage";
import { PetAssistanceState } from "../../../Lib/src/types/PetAssistanceResult";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";
import { DisplayUtils } from "../utils/DisplayUtils";
import { Language } from "../../../Lib/src/Language";

export class CrowniclesHistoryCachedMessage extends CrowniclesCachedMessage<CommandFightHistoryItemPacket> {
	private usernamesCachePlayer = new Map<string, string>();

	private usernamesCacheMonster = new Map<string, string>();

	readonly duration = 30;

	historyContent: string;

	constructor(originalMessageId: string) {
		super(originalMessageId);
		this.historyContent = "";
	}

	get type(): string {
		return "history";
	}

	updateMessage = async (packet: CommandFightHistoryItemPacket, context: PacketContext): Promise<null> => {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		const lng = interaction.userLanguage;
		if (packet.fighterKeycloakId && !this.usernamesCachePlayer.has(packet.fighterKeycloakId)) {
			this.usernamesCachePlayer.set(packet.fighterKeycloakId, await DisplayUtils.getEscapedUsername(packet.fighterKeycloakId, lng));
		}
		else if (packet.monsterId && !this.usernamesCacheMonster.has(packet.monsterId)) {
			this.usernamesCacheMonster.set(packet.monsterId, i18n.t(`models:monsters.${packet.monsterId}.name`, { lng }));
		}

		let newLine = i18n.t("commands:fight.actions.intro", {
			lng,
			emote: EmoteUtils.translateEmojiToDiscord(packet.pet
				? CrowniclesIcons.pets[packet.pet.typeId][packet.pet.sex === StringConstants.SEX.FEMALE.short ? "emoteFemale" : "emoteMale"]
				: CrowniclesIcons.fightActions[packet.fightActionId]),
			fighter: packet.fighterKeycloakId ? this.usernamesCachePlayer?.get(packet.fighterKeycloakId) : this.usernamesCacheMonster?.get(packet.monsterId!)
		}) + this.manageMainMessage(packet, lng);

		if (packet.fightActionEffectReceived) {
			newLine += this.manageReceivedEffects(packet, lng);
		}

		// Then we need to display the side effects of the attack or alteration if there are any
		if (packet.fightActionEffectDealt) {
			newLine += this.manageSideEffects(packet, lng);
		}

		if (this.historyContent.length + newLine.length <= FightConstants.MAX_HISTORY_LENGTH) {
			this.historyContent = `${this.historyContent}\n${newLine}`;
			await this.post({ content: this.historyContent });
			return null;
		}
		this.storedMessage = undefined;
		this.historyContent = newLine;
		await this.post({ content: this.historyContent });
		CrowniclesCachedMessages.markAsReupload(CrowniclesCachedMessages.getOrCreate(this.originalMessageId, CrowniclesFightStatusCachedMessage));
		CrowniclesCachedMessages.markAsReupload(CrowniclesCachedMessages.getOrCreate(this.originalMessageId, CrowniclesActionChooseCachedMessage));
		return null;
	};

	private manageSideEffects(packet: CommandFightHistoryItemPacket, lng: Language): string {
		let sideEffectString = "";
		Object.entries(packet.fightActionEffectDealt!)
			.forEach(([key, value]) => {
				if (typeof value === "number") {
					const operator = value >= 0 ? FightConstants.OPERATOR.PLUS : FightConstants.OPERATOR.MINUS;
					sideEffectString += i18n.t(`commands:fight.actions.fightActionEffects.opponent.${key}`, {
						lng,
						operator,
						amount: Math.abs(value)
					});
				}
				else if (value) {
					sideEffectString += i18n.t(`commands:fight.actions.fightActionEffects.opponent.${key}`, {
						lng,
						effect: i18n.t(`models:fight_actions.${value}.name`, { lng })
					});
				}
			});
		return sideEffectString;
	}

	private manageMainMessage(packet: CommandFightHistoryItemPacket, lng: Language): string {
		if (
			packet.status
			&& Object.values(FightAlterationState)
				.includes(packet.status as FightAlterationState)
			|| Object.values(PetAssistanceState)
				.includes(packet.status as PetAssistanceState)
		) {
			// The fightAction is an alteration or pet assistance
			return i18n.t(`models:fight_actions.${packet.fightActionId}.${packet.status}`, {
				lng,
				petNickname: packet.pet
					? packet.pet.nickname
						? packet.pet.nickname
						: DisplayUtils.getPetTypeName(lng, packet.pet.typeId, packet.pet.sex)
					: undefined
			});
		}
		else if (packet.customMessage) {
			return i18n.t(`models:fight_actions.${packet.fightActionId}.customMessage`, {
				lng
			});
		}

		// The fightAction is an attack
		return StringUtils.getRandomTranslation(
			`commands:fight.actions.attacksResults.${packet.status}`,
			lng,
			{
				attack: i18n.t(`models:fight_actions.${packet.fightActionId}.name`, {
					lng,
					count: 1
				})
			}
		);
	}

	private manageReceivedEffects(packet: CommandFightHistoryItemPacket, lng: Language): string {
		let effectsString = "";
		Object.entries(packet.fightActionEffectReceived!)
			.forEach(([key, value]) => {
				if (typeof value === "number") {
					effectsString += i18n.t(`commands:fight.actions.fightActionEffects.self.${key}`, {
						lng,
						operator: value >= 0 ? FightConstants.OPERATOR.PLUS : FightConstants.OPERATOR.MINUS,
						amount: Math.abs(value)
					});
				}
				else if (value) {
					effectsString += i18n.t(`commands:fight.actions.fightActionEffects.self.${key}`, {
						lng,
						effect: i18n.t(`models:fight_actions.${value}.name`, { lng })
					});
				}
			});
		return effectsString;
	}
}
