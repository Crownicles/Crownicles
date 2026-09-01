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

type TournamentCreationData = {
	guildId: string;
	channelId: string;
	createdByKeycloakId: string;
};

function hashCode(code: string): string {
	return createHash("sha256").update(code.trim().toUpperCase())
		.digest("hex");
}

function validateCreationData(
	context: PacketContext,
	registrationDays: number,
	combatDays: number
): TournamentCreationData {
	const guildId = context.frontEndSubOrigin;
	const channelId = context.discord?.channel;
	const guildMemberCount = context.discord?.guildMemberCount;
	if (!guildId || guildId === PacketConstants.FRONT_END_SUB_ORIGINS.UNKNOWN || !channelId) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	if (context.discord?.isGuildAdministrator !== true) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
	if (guildMemberCount === undefined || guildMemberCount < TournamentConstants.MINIMUM_SERVER_MEMBER_COUNT) {
		throw new TournamentDomainError(TournamentErrorCodes.GUILD_TOO_SMALL);
	}
	if (!Number.isInteger(registrationDays)
		|| registrationDays < TournamentConstants.REGISTRATION_MINIMUM_DAYS
		|| registrationDays > TournamentConstants.REGISTRATION_MAXIMUM_DAYS
		|| !Number.isInteger(combatDays)
		|| combatDays < TournamentConstants.COMBAT_MINIMUM_DAYS
		|| combatDays > TournamentConstants.COMBAT_MAXIMUM_DAYS) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_DURATION);
	}
	if (!context.keycloakId) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
	return {
		guildId,
		channelId,
		createdByKeycloakId: context.keycloakId
	};
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
	context: PacketContext,
	code: string,
	registrationDays: number,
	combatDays: number
): Promise<Tournament> {
	const {
		guildId,
		channelId,
		createdByKeycloakId
	} = validateCreationData(context, registrationDays, combatDays);
	const codeInstance = await TournamentCode.findOne({ where: { codeHash: hashCode(code) } });
	if (!codeInstance) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CODE);
	}
	return await TournamentCode.withLocked(codeInstance.id, async lockedCode => {
		const now = Date.now();
		if (lockedCode.consumedAt) {
			throw new TournamentDomainError(TournamentErrorCodes.USED_CODE);
		}
		if (lockedCode.expiresAt.getTime() <= now) {
			throw new TournamentDomainError(TournamentErrorCodes.EXPIRED_CODE);
		}
		if (lockedCode.discordGuildId !== guildId) {
			throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
		}

		const registrationEndsAt = new Date(now + daysToMilliseconds(asDays(registrationDays)));
		const combatEndsAt = new Date(registrationEndsAt.getTime() + daysToMilliseconds(asDays(combatDays)));
		const tournament = await Tournament.create({
			discordGuildId: guildId,
			discordChannelId: channelId,
			createdByKeycloakId,
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
		lockedCode.consumedAt = new Date(now);
		await lockedCode.save();
		return tournament;
	});
}
