import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PacketUtils } from "../../../../core/utils/PacketUtils";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReachDestinationNotificationPacket } from "../../../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { MapLocationDataController } from "../../../../data/MapLocation";
import { GuildDailyNotificationPacket } from "../../../../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import { CommandGuildDailyRewardPacket } from "../../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { NotificationPacket } from "../../../../../../Lib/src/packets/notifications/NotificationPacket";
import { DailyBonusNotificationPacket } from "../../../../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import { EnergyFullNotificationPacket } from "../../../../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { GuildKickNotificationPacket } from "../../../../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import { GuildStatusChangeNotificationPacket } from "../../../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { PlayerFreedFromJailNotificationPacket } from "../../../../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import { PlayerWasAttackedNotificationPacket } from "../../../../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import { ExpeditionFinishedNotificationPacket } from "../../../../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import { TournamentNotificationPacket } from "../../../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import {
	TournamentCategories, TournamentNotificationEvents
} from "../../../../../../Lib/src/types/Tournament";
import { StringConstants } from "../../../../../../Lib/src/constants/StringConstants";

/** One sample of each notification, sent to the player themselves: the other player named in it is them too. */
const SAMPLES: Record<string, (keycloakId: string) => NotificationPacket> = {
	report: keycloakId => {
		const map = MapLocationDataController.instance.getRandomGotoableMap();
		return makePacket(ReachDestinationNotificationPacket, {
			keycloakId,
			mapType: map.type,
			mapId: map.id
		});
	},
	gd: keycloakId => makePacket(GuildDailyNotificationPacket, {
		keycloakId,
		keycloakIdOfExecutor: keycloakId,
		reward: makePacket(CommandGuildDailyRewardPacket, {
			guildName: "Test",
			money: 666,
			personalXp: 666,
			badge: true,
			superBadge: true,
			fullHeal: true,
			heal: 666,
			alteration: { healAmount: 666 },
			guildXp: 666,
			commonFood: 666,
			pet: {
				typeId: 1, isFemale: false
			},
			advanceTime: 666
		})
	}),
	daily: keycloakId => makePacket(DailyBonusNotificationPacket, { keycloakId }),
	energy: keycloakId => makePacket(EnergyFullNotificationPacket, { keycloakId }),
	kick: keycloakId => makePacket(GuildKickNotificationPacket, {
		keycloakId,
		keycloakIdOfExecutor: keycloakId,
		guildName: "Test"
	}),
	promote: keycloakId => makePacket(GuildStatusChangeNotificationPacket, {
		keycloakId,
		guildName: "Test",
		becomeElder: true
	}),
	jail: keycloakId => makePacket(PlayerFreedFromJailNotificationPacket, {
		keycloakId,
		freedByPlayerKeycloakId: keycloakId
	}),
	fight: keycloakId => makePacket(PlayerWasAttackedNotificationPacket, {
		keycloakId,
		attackedByPlayerKeycloakId: keycloakId
	}),
	pet: keycloakId => makePacket(ExpeditionFinishedNotificationPacket, {
		keycloakId,
		petId: 1,
		petSex: StringConstants.SEX.FEMALE.short
	}),
	tournament: keycloakId => makePacket(TournamentNotificationPacket, {
		keycloakId,
		event: TournamentNotificationEvents.ENDED,
		tournamentId: 0,
		category: TournamentCategories.LEVEL_50,
		participantCount: 10,
		categoryParticipantCount: 5,
		rank: 3
	})
};

export const commandInfo: ITestCommand = {
	name: "sendnotification",
	aliases: ["sendnotif"],
	commandFormat: "<type>",
	typeWaited: { type: TypeKey.STRING },
	description: `Envoie une notification de test au joueur, sur Discord et dans l'application. Types disponibles : ${Object.keys(SAMPLES).join(", ")}`
};

/**
 * Send a notification of the given type
 */
const sendNotificationTestCommand: ExecuteTestCommandLike = (player, args) => {
	const sample = SAMPLES[args[0]];
	if (!sample) {
		throw "Type de notification inconnu";
	}
	PacketUtils.sendNotifications([sample(player.keycloakId)]);

	return "Notification envoyée !";
};

commandInfo.execute = sendNotificationTestCommand;
