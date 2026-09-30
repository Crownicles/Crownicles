import {ReactNode} from "react";
import {AppIcons} from "@/src/AppIcons";
import {CelebrationModal} from "@/src/components/UnlockCelebration";
import {ArrowRight} from "@/src/design/FightIcons";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GuildCommandOutcome, GuildCreationStatus, GuildDailyReward} from "ws-packets/src/objects/Guild";
import {Note} from "@/src/design/Primitives";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {ActionBanner, Fact, QuestionSheet, Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const TOAST_EMBLEM_SIZE = 22;

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

/** Why Core turned a request down, or null when the outcome is a result worth its own sheet. */
export function guildRefusal(outcome: GuildCommandOutcome): string | null {
	switch (outcome.type) {
		case "creationStatus": return creationMessage(outcome.status);
		case "descriptionInvalid": return i18n.t("app:guild.descriptionInvalid", {min: outcome.min, max: outcome.max});
		case "memberError": return i18n.t(`app:guild.memberErrors.${outcome.error}`);
		case "notInGuild": return i18n.t("app:requirements.guild");
		case "forbidden": return i18n.t("app:guild.forbidden");
		case "dailyIsland": return i18n.t("app:guild.errors.dailyIsland");
		case "dailyCooldown": return i18n.t("app:guild.dailyCooldown", {duration: formatDurationMinutes(outcome.remainingTime / MS_PER_MINUTE), total: formatDurationMinutes(outcome.totalTime * MINUTES_PER_HOUR)});
		default: return null;
	}
}

/** The refusal a guild command menu reads from its outcome packet. */
export function guildPacketRefusal(packet: FromServerPacket): string | null {
	return guildRefusal((packet as GuildCommandRes).outcome);
}

/** A change the screen already shows, or a refusal, is only acknowledged in passing, never in a window to close. */
function acknowledgement(outcome: GuildCommandOutcome): {title: string; subtitle?: string} | null {
	const refusal = guildRefusal(outcome);
	if (refusal !== null) return {title: i18n.t("app:guild.pages.manage"), subtitle: refusal};
	if (outcome.type === "descriptionUpdated") return {title: i18n.t("app:guild.descriptionUpdated")};
	if (outcome.type === "left") return {
		title: i18n.t(outcome.isGuildDestroyed ? "app:guild.dissolved" : "app:guild.left", {name: outcome.guildName}),
		...outcome.newChiefName ? {subtitle: i18n.t("app:guild.newChief", {name: outcome.newChiefName})} : {}
	};
	if (outcome.type !== "memberAction") return null;
	return {
		title: i18n.t(`app:guild.memberResults.${outcome.action}`, {member: outcome.memberName ?? i18n.t("app:profile.values.unknown")}),
		...outcome.guildName ? {subtitle: outcome.guildName} : {}
	};
}

/** A new banner is raised: the moment takes the whole screen, like a part of the game opening. */
function GuildFounded({name, onContinue}: {name: string; onContinue: () => void}): ReactNode {
	return <CelebrationModal onClose={onContinue} icon="navigation.guild" eyebrow={i18n.t("app:guild.founded.eyebrow")} title={name} description={i18n.t("app:guild.founded.description")} testID="guild-founded">
		<ActionBanner icon={ArrowRight} emoji={AppIcons.getIcon("navigation.guild")} label={i18n.t("app:guild.founded.enter")} onPress={onContinue} />
	</CelebrationModal>;
}

export function GuildOutcome({outcome, onContinue}: {outcome: GuildCommandOutcome; onContinue: () => void}): ReactNode {
	if (outcome.type === "created") return <GuildFounded name={outcome.guildName} onContinue={onContinue} />;
	const toast = acknowledgement(outcome);
	if (toast) {
		const emblem = AppIcons.getIconOrNull("guild.icon");
		return <Toast
			{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={TOAST_EMBLEM_SIZE} />} : {}}
			title={toast.title}
			{...toast.subtitle ? {subtitle: toast.subtitle} : {}}
			onDismiss={onContinue}
		/>;
	}
	if (outcome.type !== "daily") return null;
	return <QuestionSheet
		caption={i18n.t("app:guild.eyebrow")}
		title={i18n.t("app:guild.pages.manage")}
		onClose={onContinue}
	>
		<DailyReward reward={outcome.reward} />
		<ActionBanner icon={ArrowRight} label={i18n.t("app:common.continue")} onPress={onContinue} />
	</QuestionSheet>;
}