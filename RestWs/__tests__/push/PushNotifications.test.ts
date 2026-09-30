import {beforeAll, describe, expect, it, vi} from "vitest";
import {generateKeyPairSync, verify} from "node:crypto";
import {makePacket} from "../../../Lib/src/packets/CrowniclesPacket";
import {ALL_NOTIFICATION_TYPES, NOTIFICATION_TYPES, NotificationType} from "../../../Lib/src/types/NotificationPreferences";
import {NotificationPacket} from "../../../Lib/src/packets/notifications/NotificationPacket";
import {ReachDestinationNotificationPacket} from "../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import {DailyBonusNotificationPacket} from "../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import {EnergyFullNotificationPacket} from "../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import {GuildDailyNotificationPacket} from "../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import {GuildKickNotificationPacket} from "../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import {GuildStatusChangeNotificationPacket} from "../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import {PlayerFreedFromJailNotificationPacket} from "../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import {PlayerWasAttackedNotificationPacket} from "../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import {ExpeditionFinishedNotificationPacket} from "../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import {TournamentNotificationPacket} from "../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import {AppNotificationDelivery} from "../../../Lib/src/packets/notifications/AppNotificationsSerializedPacket";
import {PushDevice} from "../../../Lib/src/types/PushDevices";
import {loadPushTexts, pushTextOf} from "../../src/push/PushTexts";
import {apnsPayloadOf, isInvalidApnsToken, signApnsToken} from "../../src/push/ApnsClient";
import {fcmMessageOf, isInvalidFcmToken, signServiceAccountAssertion} from "../../src/push/FcmClient";
import {AppNotificationDispatch, dispatchAppNotification} from "../../src/push/AppNotificationDispatcher";
import {PUSH_RESULTS} from "../../src/push/PushSender";

const PLAYER = "player-keycloak-id";
const OTHER = "other-keycloak-id";
const names = (keycloakId: string): Promise<string | undefined> => Promise.resolve(keycloakId === OTHER ? "Gorgonzola" : undefined);

/** One notification of each kind, as Core builds them. */
const SAMPLES: Record<NotificationType, NotificationPacket> = {
	[NOTIFICATION_TYPES.REPORT]: makePacket(ReachDestinationNotificationPacket, {keycloakId: PLAYER, mapType: "be", mapId: 1}),
	[NOTIFICATION_TYPES.DAILY_BONUS]: makePacket(DailyBonusNotificationPacket, {keycloakId: PLAYER}),
	[NOTIFICATION_TYPES.ENERGY]: makePacket(EnergyFullNotificationPacket, {keycloakId: PLAYER}),
	[NOTIFICATION_TYPES.GUILD_DAILY]: makePacket(GuildDailyNotificationPacket, {keycloakId: PLAYER, keycloakIdOfExecutor: OTHER, reward: {}} as GuildDailyNotificationPacket),
	[NOTIFICATION_TYPES.GUILD_KICK]: makePacket(GuildKickNotificationPacket, {keycloakId: PLAYER, keycloakIdOfExecutor: OTHER, guildName: "Les Fromages"}),
	[NOTIFICATION_TYPES.GUILD_STATUS_CHANGE]: makePacket(GuildStatusChangeNotificationPacket, {keycloakId: PLAYER, guildName: "Les Fromages", becomeElder: true}),
	[NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL]: makePacket(PlayerFreedFromJailNotificationPacket, {keycloakId: PLAYER, freedByPlayerKeycloakId: OTHER}),
	[NOTIFICATION_TYPES.FIGHT_CHALLENGE]: makePacket(PlayerWasAttackedNotificationPacket, {keycloakId: PLAYER, attackedByPlayerKeycloakId: OTHER}),
	[NOTIFICATION_TYPES.PET_EXPEDITION]: makePacket(ExpeditionFinishedNotificationPacket, {keycloakId: PLAYER, petId: 1, petSex: "f", petNickname: "Brioche"}),
	[NOTIFICATION_TYPES.TOURNAMENT]: makePacket(TournamentNotificationPacket, {
		keycloakId: PLAYER, event: "ended", tournamentId: 1, category: "level50", participantCount: 10, categoryParticipantCount: 5, rank: 3
	})
};

const IPHONE: PushDevice = {token: "a".repeat(64), platform: "ios", sandbox: true, language: "fr"};
const ANDROID: PushDevice = {token: "fcm:token-1", platform: "android", sandbox: false, language: "en"};

beforeAll(async () => {
	await loadPushTexts("../Lang");
});

describe("push texts", () => {
	it.each(ALL_NOTIFICATION_TYPES)("%s says something in French, with no key left untranslated", async type => {
		const text = await pushTextOf(type, SAMPLES[type], "fr", names);
		expect(text.title).not.toMatch(/notifications\.push|\{\{/u);
		expect(text.body).not.toMatch(/notifications\.push|\{\{/u);
		expect(text.title.length).toBeGreaterThan(0);
		expect(text.body.length).toBeGreaterThan(0);
	});

	it("names the destination of the travel", async () => {
		const text = await pushTextOf(NOTIFICATION_TYPES.REPORT, SAMPLES.report, "fr", names);
		expect(text.body).toContain("Plage Sentinelle");
	});

	it("names the player behind the notification, or says the name was not found, as Discord does", async () => {
		expect((await pushTextOf(NOTIFICATION_TYPES.GUILD_KICK, SAMPLES.guildKick, "fr", names)).body)
			.toBe("Gorgonzola vous a exclu de la guilde Les Fromages.");
		const unknown = makePacket(PlayerWasAttackedNotificationPacket, {keycloakId: PLAYER, attackedByPlayerKeycloakId: "gone"});
		expect((await pushTextOf(NOTIFICATION_TYPES.FIGHT_CHALLENGE, unknown, "fr", names)).body).toMatch(/^Pseudo 404 vous a attaqué/u);
	});

	it("tells a promotion from a demotion", async () => {
		const demoted = makePacket(GuildStatusChangeNotificationPacket, {keycloakId: PLAYER, guildName: "Les Fromages"});
		const chief = makePacket(GuildStatusChangeNotificationPacket, {keycloakId: PLAYER, guildName: "Les Fromages", becomeChief: true});
		expect((await pushTextOf(NOTIFICATION_TYPES.GUILD_STATUS_CHANGE, SAMPLES.guildStatusChange, "fr", names)).body).toContain("promu aîné");
		expect((await pushTextOf(NOTIFICATION_TYPES.GUILD_STATUS_CHANGE, demoted, "fr", names)).body).toContain("n'êtes plus aîné");
		expect((await pushTextOf(NOTIFICATION_TYPES.GUILD_STATUS_CHANGE, chief, "fr", names)).body).toContain("chef");
	});

	it("calls the pet by its nickname, or else by its kind", async () => {
		expect((await pushTextOf(NOTIFICATION_TYPES.PET_EXPEDITION, SAMPLES.petExpedition, "fr", names)).body).toMatch(/^Brioche est de retour/u);
		const unnamed = makePacket(ExpeditionFinishedNotificationPacket, {keycloakId: PLAYER, petId: 1, petSex: "f"});
		const body = (await pushTextOf(NOTIFICATION_TYPES.PET_EXPEDITION, unnamed, "fr", names)).body;
		expect(body).not.toMatch(/^Brioche|pets\./u);
	});

	it("gives the rank at the end of a tournament, and the reason of a cancellation", async () => {
		expect((await pushTextOf(NOTIFICATION_TYPES.TOURNAMENT, SAMPLES.tournament, "fr", names)).body).toBe("Le tournoi est terminé. Votre rang en catégorie Niveau 50 : 3.");
		const cancelled = makePacket(TournamentNotificationPacket, {...SAMPLES.tournament as TournamentNotificationPacket, cancellationReason: "notEnoughParticipants"});
		expect((await pushTextOf(NOTIFICATION_TYPES.TOURNAMENT, cancelled, "fr", names)).body).toContain("annulé");
	});
});

describe("Apple push", () => {
	it("groups by kind and carries the kind for the tap where expo-notifications reads it", () => {
		expect(apnsPayloadOf({notificationType: "energy", title: "T", body: "B"})).toEqual({
			aps: {"alert": {title: "T", body: "B"}, "sound": "default", "thread-id": "energy"},
			body: {notificationType: "energy"}
		});
	});

	it.each([
		[{status: 410}, true],
		[{status: 400, reason: "BadDeviceToken"}, true],
		[{status: 400, reason: "DeviceTokenNotForTopic"}, true],
		[{status: 403, reason: "ExpiredProviderToken"}, false],
		[{status: 429, reason: "TooManyRequests"}, false]
	])("forgets the device only when Apple no longer knows it (%o)", (response, invalid) => {
		expect(isInvalidApnsToken(response)).toBe(invalid);
	});

	it("signs its provider token with the team's key, in the form Apple verifies", () => {
		const {privateKey, publicKey} = generateKeyPairSync("ec", {namedCurve: "prime256v1"});
		const token = signApnsToken(privateKey, {KEY_ID: "KEY1234567", TEAM_ID: "TEAM123456"}, 1_900_000_000);
		const [header, claims, signature] = token.split(".");
		expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({alg: "ES256", kid: "KEY1234567"});
		expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({iss: "TEAM123456", iat: 1_900_000_000});
		expect(verify("sha256", Buffer.from(`${header}.${claims}`), {key: publicKey, dsaEncoding: "ieee-p1363"}, Buffer.from(signature, "base64url"))).toBe(true);
	});
});

describe("Firebase push", () => {
	it("uses the channel of the kind, and replaces the previous state-like notification", () => {
		expect(fcmMessageOf(ANDROID, {notificationType: "report", title: "T", body: "B"}).message.android)
			.toEqual({priority: "HIGH", collapse_key: "report", notification: {channel_id: "report", tag: "report"}});
		expect(fcmMessageOf(ANDROID, {notificationType: "guildKick", title: "T", body: "B"}).message.android)
			.toEqual({priority: "HIGH", notification: {channel_id: "guildKick"}});
	});

	it("forgets the device only when Firebase no longer knows it", () => {
		expect(isInvalidFcmToken(404, {})).toBe(true);
		expect(isInvalidFcmToken(400, {error: {status: "INVALID_ARGUMENT", details: [{errorCode: "UNREGISTERED"}]}})).toBe(true);
		expect(isInvalidFcmToken(400, {error: {status: "INVALID_ARGUMENT", details: [{errorCode: "INVALID_ARGUMENT"}]}})).toBe(false);
		expect(isInvalidFcmToken(503, {})).toBe(false);
	});

	it("signs the service account assertion Google exchanges for an access token", () => {
		const {privateKey, publicKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
		const account = {
			project_id: "crownicles",
			client_email: "push@crownicles.iam.gserviceaccount.com",
			private_key: privateKey.export({type: "pkcs8", format: "pem"}).toString(),
			token_uri: "https://oauth2.googleapis.com/token"
		};
		const [header, claims, signature] = signServiceAccountAssertion(account, 1_900_000_000).split(".");
		expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
			iss: account.client_email,
			scope: "https://www.googleapis.com/auth/firebase.messaging",
			aud: account.token_uri,
			iat: 1_900_000_000,
			exp: 1_900_003_600
		});
		expect(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
	});
});

function fakeDispatch(connected: boolean, results: Record<string, string> = {}): AppNotificationDispatch & {pushed: {token: string; body: string}[]} {
	const pushed: {token: string; body: string}[] = [];
	return {
		pushed,
		push: vi.fn((device: PushDevice, message) => {
			pushed.push({token: device.token, body: message.body});
			return Promise.resolve((results[device.token] ?? PUSH_RESULTS.SENT) as typeof PUSH_RESULTS[keyof typeof PUSH_RESULTS]);
		}),
		playerName: names,
		playerLanguage: vi.fn(() => Promise.resolve("fr" as const)),
		isConnected: () => connected,
		showLive: vi.fn(),
		forgetDevice: vi.fn()
	};
}

function delivery(devices: PushDevice[]): AppNotificationDelivery {
	return {notificationType: NOTIFICATION_TYPES.GUILD_KICK, notification: {type: "GuildKickNotificationPacket", packet: SAMPLES.guildKick}, devices};
}

describe("delivering a notification", () => {
	it("pushes to every device of the player, each in its own language", async () => {
		const dispatch = fakeDispatch(false);
		await dispatchAppNotification(delivery([IPHONE, ANDROID]), dispatch);
		expect(dispatch.pushed).toEqual([
			{token: IPHONE.token, body: "Gorgonzola vous a exclu de la guilde Les Fromages."},
			{token: ANDROID.token, body: expect.not.stringContaining("notifications.push")}
		]);
		expect(dispatch.showLive).not.toHaveBeenCalled();
	});

	it("also shows it in the app when it is open", async () => {
		const dispatch = fakeDispatch(true);
		await dispatchAppNotification(delivery([IPHONE]), dispatch);
		expect(dispatch.showLive).toHaveBeenCalledWith(PLAYER, expect.objectContaining({
			notificationType: NOTIFICATION_TYPES.GUILD_KICK,
			title: "Exclu de la guilde",
			body: "Gorgonzola vous a exclu de la guilde Les Fromages."
		}));
	});

	it("shows it in the app in the player's language when no device can be pushed to", async () => {
		const dispatch = fakeDispatch(true);
		await dispatchAppNotification(delivery([]), dispatch);
		expect(dispatch.playerLanguage).toHaveBeenCalledWith(PLAYER);
		expect(dispatch.showLive).toHaveBeenCalledOnce();
		expect(dispatch.pushed).toEqual([]);
	});

	it("forgets only the devices their push service no longer knows", async () => {
		const dispatch = fakeDispatch(false, {[IPHONE.token]: PUSH_RESULTS.INVALID_TOKEN, [ANDROID.token]: PUSH_RESULTS.FAILED});
		await dispatchAppNotification(delivery([IPHONE, ANDROID]), dispatch);
		expect(dispatch.forgetDevice).toHaveBeenCalledExactlyOnceWith(PLAYER, IPHONE.token);
	});
});
