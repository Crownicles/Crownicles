import { CrowniclesCachedMessage } from "./CrowniclesCachedMessage";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesEmbed } from "./CrowniclesEmbed";
import i18n from "../translations/i18n";
import { CommandFightStatusPacket } from "../../../Lib/src/packets/fights/FightStatusPacket";
import { DisplayUtils } from "../utils/DisplayUtils";

export class CrowniclesFightStatusCachedMessage extends CrowniclesCachedMessage<CommandFightStatusPacket> {
	private usernamesCache?: Map<string, string>;

	readonly duration = 30;

	get type(): string {
		return "fightStatus";
	}

	updateMessage = async (packet: CommandFightStatusPacket, context: PacketContext): Promise<null> => {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		const lng = interaction.userLanguage;
		if (!this.usernamesCache) {
			this.usernamesCache = new Map<string, string>();
			if (packet.activeFighter.keycloakId) {
				this.usernamesCache.set(packet.activeFighter.keycloakId, await DisplayUtils.getEscapedUsername(packet.activeFighter.keycloakId, lng));
			}
			if (packet.defendingFighter.keycloakId) {
				this.usernamesCache.set(packet.defendingFighter.keycloakId, await DisplayUtils.getEscapedUsername(packet.defendingFighter.keycloakId, lng));
			}
		}
		const attackerUsername = packet.activeFighter.keycloakId ? this.usernamesCache.get(packet.activeFighter.keycloakId) : i18n.t(`models:monsters.${packet.activeFighter.monsterId}.name`, { lng });
		const defenderUsername = packet.defendingFighter.keycloakId ? this.usernamesCache.get(packet.defendingFighter.keycloakId) : i18n.t(`models:monsters.${packet.defendingFighter.monsterId}.name`, { lng });
		const keyProlongation = packet.numberOfTurn > packet.maxNumberOfTurn ? "prolongation" : "noProlongation";

		const embed = new CrowniclesEmbed()
			.setTitle(i18n.t("commands:fight.summarize.title", { lng }))
			.setDescription(`
				${i18n.t("commands:fight.summarize.intro.start", {
					lng,
					state: i18n.t(`commands:fight.summarize.intro.${keyProlongation}`, {
						lng,
						currentTurn: packet.numberOfTurn,
						maxTurn: packet.maxNumberOfTurn
					})
				})}
				${i18n.t("commands:fight.summarize.attacker", {
					lng,
					pseudo: attackerUsername
				})}
				${i18n.t("commands:fight.summarize.stats", {
					lng,
					...packet.activeFighter.stats
				})}
				${i18n.t("commands:fight.summarize.defender", {
					lng,
					pseudo: defenderUsername
				})}
				${i18n.t("commands:fight.summarize.stats", {
					lng,
					...packet.defendingFighter.stats
				})}
			`);

		await this.post({ embeds: [embed] });
		return null;
	};
}
