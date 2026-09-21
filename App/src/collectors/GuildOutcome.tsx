import {ReactNode} from "react";
import {GuildCommandOutcome, GuildCreationStatus, GuildDailyReward} from "ws-packets/src/objects/Guild";
import {Note} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {Fact, Sheet} from "@/src/design/Sections";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const DAILY_NUMBERS = ["money", "heal", "personalXp", "guildXp", "guildPoints", "commonFood"] as const;
const DAILY_FLAGS = ["fullHeal", "badge", "superBadge"] as const;

function creationMessage(status: GuildCreationStatus): string {
	if (status.foundGuild) return i18n.t("app:guild.errors.alreadyMember");
	if (status.guildNameIsAvailable === false) return i18n.t("app:guild.errors.nameTaken");
	if (status.guildNameIsAcceptable === false) return i18n.t("app:guild.errors.invalidName");
	return i18n.t("app:guild.errors.missingMoney", {money: formatMoney(status.missingMoney ?? 0)});
}

function DailyReward({reward}: {reward: GuildDailyReward}): ReactNode {
	return <>
		<Note>{reward.guildName}</Note>
		{DAILY_NUMBERS.filter(key => reward[key] !== undefined).map(key => <Fact key={key} label={i18n.t(`app:guild.rewards.${key}`)} value={formatNumber(reward[key]!)} />)}
		{DAILY_FLAGS.filter(key => reward[key]).map(key => <Note key={key}>{i18n.t(`app:guild.rewards.${key}`)}</Note>)}
		{reward.advanceTime !== undefined ? <Note>{i18n.t("app:guild.rewards.advanceTime", {duration: formatDurationMinutes(reward.advanceTime * MINUTES_PER_HOUR)})}</Note> : null}
		{reward.alteration ? <Note>{i18n.t("app:guild.rewards.alteration", {health: reward.alteration.healAmount ?? 0})}</Note> : null}
		{reward.pet ? <Note>{i18n.t("app:guild.rewards.pet", {pet: i18n.t(`models:pets.${reward.pet.typeId}`, {context: reward.pet.isFemale ? "female" : "male"})})}</Note> : null}
	</>;
}

function GuildManagementResult({outcome}: {outcome: GuildCommandOutcome}): ReactNode {
	switch (outcome.type) {
		case "descriptionUpdated": return <Note>{i18n.t("app:guild.descriptionUpdated")}</Note>;
		case "descriptionInvalid": return <Note>{i18n.t("app:guild.descriptionInvalid", {min: outcome.min, max: outcome.max})}</Note>;
		case "notInGuild": return <Note>{i18n.t("app:requirements.guild")}</Note>;
		case "forbidden": return <Note>{i18n.t("app:guild.forbidden")}</Note>;
		case "left": return <>
			<Note>{i18n.t(outcome.isGuildDestroyed ? "app:guild.dissolved" : "app:guild.left", {name: outcome.guildName})}</Note>
			{outcome.newChiefName ? <Note>{i18n.t("app:guild.newChief", {name: outcome.newChiefName})}</Note> : null}
		</>;
		default: return null;
	}
}

function GuildMemberResult({outcome}: {outcome: Extract<GuildCommandOutcome, {type: "memberAction"}>}): ReactNode {
	return <>
		<Note>{i18n.t(`app:guild.memberResults.${outcome.action}`, {member: outcome.memberName ?? i18n.t("app:profile.values.unknown")})}</Note>
		{outcome.guildName ? <Note>{outcome.guildName}</Note> : null}
	</>;
}

function GuildResult({outcome}: {outcome: GuildCommandOutcome}): ReactNode {
	switch (outcome.type) {
		case "memberAction": return <GuildMemberResult outcome={outcome} />;
		case "memberError": return <Note>{i18n.t(`app:guild.memberErrors.${outcome.error}`)}</Note>;
		case "created": return <Note>{i18n.t("app:guild.created", {name: outcome.guildName})}</Note>;
		case "creationStatus": return <Note>{creationMessage(outcome.status)}</Note>;
		case "daily": return <DailyReward reward={outcome.reward} />;
		case "dailyCooldown": return <Note>{i18n.t("app:guild.dailyCooldown", {duration: formatDurationMinutes(outcome.remainingTime / MS_PER_MINUTE), total: formatDurationMinutes(outcome.totalTime * MINUTES_PER_HOUR)})}</Note>;
		case "dailyIsland": return <Note>{i18n.t("app:guild.errors.dailyIsland")}</Note>;
		default: return <GuildManagementResult outcome={outcome} />;
	}
}

export function GuildOutcome({outcome, onContinue}: {outcome: GuildCommandOutcome; onContinue: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:guild.eyebrow")}
		title={i18n.t("app:guild.pages.manage")}
		closeLabel={i18n.t("app:common.back")}
		onClose={onContinue}
	>
		<GuildResult outcome={outcome} />
	</Sheet>;
}