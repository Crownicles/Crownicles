// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import {
	readdir, readFile
} from "node:fs/promises";
import {
	Language, LANGUAGE
} from "../../../Lib/src/Language";
import {
	NOTIFICATION_TYPES, NotificationType
} from "../../../Lib/src/types/NotificationPreferences";
import { NotificationPacket } from "../../../Lib/src/packets/notifications/NotificationPacket";
import { ReachDestinationNotificationPacket } from "../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { GuildDailyNotificationPacket } from "../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import { GuildKickNotificationPacket } from "../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import { GuildStatusChangeNotificationPacket } from "../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { PlayerFreedFromJailNotificationPacket } from "../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import { PlayerWasAttackedNotificationPacket } from "../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import { ExpeditionFinishedNotificationPacket } from "../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import { TournamentNotificationPacket } from "../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";

/** What a notification says, on the lock screen and in the app. */
export type PushText = {
	title: string;
	body: string;
};

/** The only namespaces a notification draws from: its own words, place and pet names, tournament categories, the unknown player. */
const NAMESPACES = [
	"app",
	"models",
	"commands",
	"error"
];

/** Game names are resolved by the caller, which knows how to reach Keycloak. */
export type PlayerNameResolver = (keycloakId: string) => Promise<string | undefined>;

type TextContext = {
	lng: Language;
	playerName: (keycloakId: string) => Promise<string>;
};

type TextBuilder = (packet: NotificationPacket, context: TextContext) => PushText | Promise<PushText>;

const translator = i18next.createInstance();

function t(key: string, lng: Language, options: Record<string, unknown> = {}): string {
	return translator.t(key, {
		...options,
		lng
	});
}

function pushText(type: NotificationType, lng: Language, options: Record<string, unknown> = {}, variant?: string): PushText {
	return {
		title: t(`app:notifications.push.${type}.title`, lng, options),
		body: t(`app:notifications.push.${type}.body${variant ? `.${variant}` : ""}`, lng, options)
	};
}

function guildStatusVariant(packet: GuildStatusChangeNotificationPacket): string {
	if (packet.becomeChief) {
		return "becomeChief";
	}
	return packet.becomeElder ? "becomeElder" : "becomeMember";
}

function petName(packet: ExpeditionFinishedNotificationPacket, lng: Language): string {
	return packet.petNickname || t(`models:pets.${packet.petId}`, lng, {
		context: packet.petSex === StringConstants.SEX.FEMALE.short ? StringConstants.SEX.FEMALE.long : StringConstants.SEX.MALE.long
	});
}

function tournamentText(packet: TournamentNotificationPacket, lng: Language): PushText {
	return pushText(NOTIFICATION_TYPES.TOURNAMENT, lng, {
		category: t(`commands:tournament.categories.${packet.category}`, lng),
		rank: packet.rank ?? t("app:notifications.push.tournament.unranked", lng)
	}, packet.cancellationReason ? "cancelled" : packet.event);
}

/** One builder per setting: a new kind of notification does not compile until it says something. */
const TEXT_BUILDERS: Record<NotificationType, TextBuilder> = {
	[NOTIFICATION_TYPES.REPORT]: (packet, { lng }) => pushText(NOTIFICATION_TYPES.REPORT, lng, {
		destination: t(`models:map_locations.${(packet as ReachDestinationNotificationPacket).mapId}.name`, lng)
	}),
	[NOTIFICATION_TYPES.DAILY_BONUS]: (_packet, { lng }) => pushText(NOTIFICATION_TYPES.DAILY_BONUS, lng),
	[NOTIFICATION_TYPES.ENERGY]: (_packet, { lng }) => pushText(NOTIFICATION_TYPES.ENERGY, lng),
	[NOTIFICATION_TYPES.GUILD_DAILY]: async (packet, {
		lng, playerName
	}) => pushText(NOTIFICATION_TYPES.GUILD_DAILY, lng, {
		pseudo: await playerName((packet as GuildDailyNotificationPacket).keycloakIdOfExecutor)
	}),
	[NOTIFICATION_TYPES.GUILD_KICK]: async (packet, {
		lng, playerName
	}) => pushText(NOTIFICATION_TYPES.GUILD_KICK, lng, {
		pseudo: await playerName((packet as GuildKickNotificationPacket).keycloakIdOfExecutor),
		guildName: (packet as GuildKickNotificationPacket).guildName
	}),
	[NOTIFICATION_TYPES.GUILD_STATUS_CHANGE]: (packet, { lng }) => pushText(NOTIFICATION_TYPES.GUILD_STATUS_CHANGE, lng, {
		guildName: (packet as GuildStatusChangeNotificationPacket).guildName
	}, guildStatusVariant(packet as GuildStatusChangeNotificationPacket)),
	[NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL]: async (packet, {
		lng, playerName
	}) => pushText(NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL, lng, {
		pseudo: await playerName((packet as PlayerFreedFromJailNotificationPacket).freedByPlayerKeycloakId)
	}),
	[NOTIFICATION_TYPES.FIGHT_CHALLENGE]: async (packet, {
		lng, playerName
	}) => pushText(NOTIFICATION_TYPES.FIGHT_CHALLENGE, lng, {
		pseudo: await playerName((packet as PlayerWasAttackedNotificationPacket).attackedByPlayerKeycloakId)
	}),
	[NOTIFICATION_TYPES.PET_EXPEDITION]: (packet, { lng }) => pushText(NOTIFICATION_TYPES.PET_EXPEDITION, lng, {
		pet: petName(packet as ExpeditionFinishedNotificationPacket, lng)
	}),
	[NOTIFICATION_TYPES.TOURNAMENT]: (packet, { lng }) => tournamentText(packet as TournamentNotificationPacket, lng)
};

/**
 * The words of a notification in the language of the device it goes to.
 * @param type The setting the notification answers to
 * @param packet The notification, as Core sent it
 * @param lng The language of the device
 * @param resolvePlayerName How to find the game name of another player
 */
export async function pushTextOf(type: NotificationType, packet: NotificationPacket, lng: Language, resolvePlayerName: PlayerNameResolver): Promise<PushText> {
	return await TEXT_BUILDERS[type](packet, {
		lng,
		playerName: async keycloakId => await resolvePlayerName(keycloakId) ?? t("error:unknownPlayer", lng)
	});
}

async function languageResources(root: string, language: Language): Promise<i18next.ResourceLanguage> {
	const files = new Set(await readdir(`${root}/${language}`));
	const resources: i18next.ResourceLanguage = {};
	for (const namespace of NAMESPACES.filter(name => files.has(`${name}.json`))) {
		resources[namespace] = JSON.parse(await readFile(`${root}/${language}/${namespace}.json`, "utf8"));
	}
	return resources;
}

/**
 * Loads the words of the notifications, from the same files the app is served.
 * @param languagesRoot Where the language folders are
 */
export async function loadPushTexts(languagesRoot: string): Promise<void> {
	const resources: i18next.Resource = {};
	for (const language of LANGUAGE.LANGUAGES) {
		resources[language] = await languageResources(languagesRoot, language);
	}
	await translator.init({
		// French is written first: until the other languages are translated, it beats showing a key
		fallbackLng: [LANGUAGE.DEFAULT_LANGUAGE, LANGUAGE.FRENCH],
		ns: NAMESPACES,
		resources,
		interpolation: { escapeValue: false }
	});
}
