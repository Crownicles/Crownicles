import {ReactNode} from "react";
import {GuildCommandOutcome, GuildCreationStatus, GuildDailyReward} from "ws-packets/src/objects/Guild";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

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
		<Panel>{DAILY_NUMBERS.filter(key => reward[key] !== undefined).map(key => <KeyValue key={key} label={i18n.t(`app:guild.rewards.${key}`)} value={formatNumber(reward[key]!)} />)}</Panel>
		{DAILY_FLAGS.filter(key => reward[key]).map(key => <Note key={key}>{i18n.t(`app:guild.rewards.${key}`)}</Note>)}
		{reward.advanceTime !== undefined ? <Note>{i18n.t("app:guild.rewards.advanceTime", {duration: formatDurationMinutes(reward.advanceTime * MINUTES_PER_HOUR)})}</Note> : null}
		{reward.alteration ? <Note>{i18n.t("app:guild.rewards.alteration", {health: reward.alteration.healAmount ?? 0})}</Note> : null}
		{reward.pet ? <Note>{i18n.t("app:guild.rewards.pet", {pet: i18n.t(`models:pets.${reward.pet.typeId}`, {context: reward.pet.isFemale ? "female" : "male"})})}</Note> : null}
	</>;
}

function GuildResult({outcome}: {outcome: GuildCommandOutcome}): ReactNode {
	switch (outcome.type) {
		case "created": return <Note>{i18n.t("app:guild.created", {name: outcome.guildName})}</Note>;
		case "creationStatus": return <Note>{creationMessage(outcome.status)}</Note>;
		case "daily": return <DailyReward reward={outcome.reward} />;
		case "dailyCooldown": return <Note>{i18n.t("app:guild.dailyCooldown", {duration: formatDurationMinutes(outcome.remainingTime / MS_PER_MINUTE), total: formatDurationMinutes(outcome.totalTime * MINUTES_PER_HOUR)})}</Note>;
		case "dailyIsland": return <Note>{i18n.t("app:guild.errors.dailyIsland")}</Note>;
		default: return <Note>{i18n.t("app:guild.cancelled")}</Note>;
	}
}

export function GuildOutcome({outcome, onContinue}: {outcome: GuildCommandOutcome; onContinue: () => void}): ReactNode {
	return <Confirmation title={i18n.t("app:guild.eyebrow")} onRequestClose={onContinue}>
		<GuildResult outcome={outcome} />
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}