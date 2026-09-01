import {
	createHash, randomBytes
} from "node:crypto";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { PacketConstants } from "../../../../Lib/src/constants/PacketConstants";
import {
	TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asDays, daysToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentCode } from "../database/game/models/TournamentCode";
import { TournamentDomainError } from "./TournamentErrors";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";

export type TournamentCodeGenerationResult = {
	code: string;
	expiresAt: Date;
};

export type TournamentDuration = {
	registrationDays: number;
	combatDays: number;
};

export type TournamentCreationRequest = {
	context: PacketContext;
	code: string;
	duration: TournamentDuration;
};

type TournamentCreationData = {
	guildId: string;
	channelId: string;
	createdByKeycloakId: string;
};

function hashCode(code: string): string {
	return createHash("sha256").update(code.trim().toUpperCase())
		.digest("hex");
}

function requireGuildId(guildId: string): string {
	if (!guildId) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	if (guildId === PacketConstants.FRONT_END_SUB_ORIGINS.UNKNOWN) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	return guildId;
}

function requireChannelId(channelId: string | undefined): string {
	if (!channelId) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	return channelId;
}

function getTournamentChannel(context: PacketContext): {
	guildId: string; channelId: string;
} {
	return {
		guildId: requireGuildId(context.frontEndSubOrigin),
		channelId: requireChannelId(context.discord?.channel)
	};
}

function requireGuildAdministrator(context: PacketContext): void {
	if (context.discord?.isGuildAdministrator !== true) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
}

function requireTournamentCreator(context: PacketContext): string {
	if (!context.keycloakId) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
	return context.keycloakId;
}

function validateChannelAndCreator(context: PacketContext): TournamentCreationData {
	const {
		guildId,
		channelId
	} = getTournamentChannel(context);
	requireGuildAdministrator(context);
	return {
		guildId,
		channelId,
		createdByKeycloakId: requireTournamentCreator(context)
	};
}

function validateGuildSize(guildMemberCount: number | undefined): void {
	if (guildMemberCount === undefined || guildMemberCount < TournamentConstants.MINIMUM_SERVER_MEMBER_COUNT) {
		throw new TournamentDomainError(TournamentErrorCodes.GUILD_TOO_SMALL);
	}
}

function validateDurations(registrationDays: number, combatDays: number): void {
	const isRegistrationDurationValid = Number.isInteger(registrationDays)
		&& registrationDays >= TournamentConstants.REGISTRATION_MINIMUM_DAYS
		&& registrationDays <= TournamentConstants.REGISTRATION_MAXIMUM_DAYS;
	const isCombatDurationValid = Number.isInteger(combatDays)
		&& combatDays >= TournamentConstants.COMBAT_MINIMUM_DAYS
		&& combatDays <= TournamentConstants.COMBAT_MAXIMUM_DAYS;
	if (!isRegistrationDurationValid || !isCombatDurationValid) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_DURATION);
	}
}

function validateCreationData(
	context: PacketContext,
	duration: TournamentDuration
): TournamentCreationData {
	const creationData = validateChannelAndCreator(context);
	validateGuildSize(context.discord?.guildMemberCount);
	validateDurations(duration.registrationDays, duration.combatDays);
	return creationData;
}

function validateCode(
	code: TournamentCode,
	guildId: string,
	now: number
): void {
	if (code.consumedAt) {
		throw new TournamentDomainError(TournamentErrorCodes.USED_CODE);
	}
	if (code.expiresAt.getTime() <= now) {
		throw new TournamentDomainError(TournamentErrorCodes.EXPIRED_CODE);
	}
	if (code.discordGuildId !== guildId) {
		throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
	}
}

function buildTournament(
	creationData: TournamentCreationData,
	duration: TournamentDuration,
	now: number
): Promise<Tournament> {
	const registrationEndsAt = new Date(now + daysToMilliseconds(asDays(duration.registrationDays)));
	const combatEndsAt = new Date(registrationEndsAt.getTime() + daysToMilliseconds(asDays(duration.combatDays)));
	return Tournament.create({
		discordGuildId: creationData.guildId,
		discordChannelId: creationData.channelId,
		createdByKeycloakId: creationData.createdByKeycloakId,
		status: TournamentStatuses.REGISTRATION,
		pausedFromStatus: null,
		registrationEndsAt,
		combatEndsAt,
		pausedRemainingMs: null,
		startedNotificationSent: false,
		endingNotificationSent: false,
		endedNotificationSent: false,
		rewardsDistributed: false
	});
}

export async function generateTournamentCode(discordGuildId: string): Promise<TournamentCodeGenerationResult> {
	const code = randomBytes(12).toString("hex")
		.toUpperCase();
	const expiresAt = new Date(Date.now() + daysToMilliseconds(asDays(TournamentConstants.CODE_VALIDITY_DAYS)));
	await TournamentCode.create({
		codeHash: hashCode(code),
		discordGuildId,
		expiresAt
	});
	return {
		code,
		expiresAt
	};
}

export async function createTournament(
	request: TournamentCreationRequest
): Promise<Tournament> {
	const creationData = validateCreationData(request.context, request.duration);
	const codeInstance = await TournamentCode.findOne({ where: { codeHash: hashCode(request.code) } });
	if (!codeInstance) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CODE);
	}
	return await TournamentCode.withLocked(codeInstance.id, async lockedCode => {
		const now = Date.now();
		validateCode(lockedCode, creationData.guildId, now);
		const tournament = await buildTournament(creationData, request.duration, now);
		lockedCode.consumedAt = new Date(now);
		await lockedCode.save();
		return tournament;
	});
}
