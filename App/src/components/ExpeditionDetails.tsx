import {ReactNode} from "react";
import {Pressable, Text, View} from "react-native";
import {ExpeditionFood, ExpeditionOption, ExpeditionProgress, ExpeditionRewards} from "ws-packets/src/objects/PetExpedition";
import {expeditionLocationIcon, expeditionLocationName, expeditionLocationTitle, expeditionPetName, expeditionRisk} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {materialName} from "@/src/display/Resources";
import {missionDate} from "@/src/display/Missions";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {i18n} from "@/src/translations/i18n";
import {EntryRow, ExpandableList, Fact, Gauge} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

export function ExpeditionFoodDetails({amount, details}: {amount?: number; details?: ExpeditionFood[]}): ReactNode {
	return <>
		{amount !== undefined ? <Fact label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(amount)} /> : null}
		{details?.map(food => <Fact key={food.foodType} label={i18n.t(`models:foods.${food.foodType}`, {count: food.amount})} value={formatNumber(food.amount)} />)}
	</>;
}

/** From the calmest trip to the most desperate one, as Core ranks them; the upper half is worth a warning. */
const RISK_LADDER = ["trivial", "veryLow", "low", "moderate", "high", "veryHigh", "extreme", "desperate"] as const;
const FIRST_PERILOUS_RISK = RISK_LADDER.indexOf("high");
const REWARD_LADDER = ["meager", "modest", "substantial", "bountiful", "legendary"] as const;
const FIRST_GENEROUS_REWARD = REWARD_LADDER.indexOf("bountiful");
const OPTION_EMBLEM_SIZE = 28;
const STAT_EMOJI_SIZE = 13;

const STAT_TONES = {PLAIN: "plain", WARNING: "warning", GOOD: "good", BONUS: "bonus"} as const;
type StatTone = typeof STAT_TONES[keyof typeof STAT_TONES];
type OptionStat = {key: string; emoji: string; text: string; tone: StatTone};

const useOptionStyles = createStyles(colors => ({
	option: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, padding: Theme.spacing.md, borderRadius: Theme.radius, borderWidth: 2, borderColor: "transparent", backgroundColor: colors.paper},
	selected: {borderColor: colors.green},
	body: {flex: 1, minWidth: 0, gap: Theme.spacing.xs},
	title: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.ink},
	stats: {flexDirection: "row", flexWrap: "wrap", columnGap: Theme.spacing.md, rowGap: 2},
	stat: {flexDirection: "row", alignItems: "center", gap: 4},
	statText: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	plain: {},
	warning: {color: colors.red},
	good: {color: colors.green},
	bonus: {color: colors.gold}
}));

function ladderTone(ladder: readonly string[], category: string, threshold: number, tone: StatTone): StatTone {
	return ladder.indexOf(category) >= threshold ? tone : STAT_TONES.PLAIN;
}

/** What Discord writes under each destination, reduced to its emojis and values so three fit on one screen. */
function optionStats(option: ExpeditionOption): OptionStat[] {
	return [
		{key: "duration", emoji: AppIcons.getIcon("expedition.duration"), text: formatDurationMinutes(option.displayDurationMinutes), tone: STAT_TONES.PLAIN},
		{key: "risk", emoji: AppIcons.getIcon(`expedition.risk.${option.riskCategory}`), text: i18n.t(`commands:petExpedition.riskCategories.${option.riskCategory}`), tone: ladderTone(RISK_LADDER, option.riskCategory, FIRST_PERILOUS_RISK, STAT_TONES.WARNING)},
		{key: "terrain", emoji: AppIcons.getIcon(`expedition.terrain.${option.difficultyCategory}`), text: i18n.t(`commands:petExpedition.terrainCategories.${option.difficultyCategory}`), tone: STAT_TONES.PLAIN},
		{key: "rewards", emoji: AppIcons.getIcon("expedition.reward"), text: i18n.t(`commands:petExpedition.rewardCategories.${option.rewardCategory}`), tone: ladderTone(REWARD_LADDER, option.rewardCategory, FIRST_GENEROUS_REWARD, STAT_TONES.GOOD)},
		{key: "food", emoji: AppIcons.getIcon("expedition.food"), text: i18n.t("commands:petExpedition.foodCost", {count: option.foodCost}), tone: STAT_TONES.PLAIN},
		...option.hasCloneTalismanBonus ? [{key: "clone", emoji: AppIcons.getIcon("expedition.cloneTalisman"), text: i18n.t("app:expedition.cloneBonus"), tone: STAT_TONES.BONUS}] : [],
		...option.hasBonusTokens ? [{key: "tokens", emoji: AppIcons.getIcon("unitValues.token"), text: i18n.t("app:expedition.tokenBonus"), tone: STAT_TONES.BONUS}] : []
	];
}

/** One destination in a single tap-to-select line; departing waits for the button below all of them. */
export function ExpeditionOptionRow({option, selected, disabled, onSelect}: {option: ExpeditionOption; selected: boolean; disabled: boolean; onSelect: () => void}): ReactNode {
	const styles = useOptionStyles();
	return <Pressable
		accessibilityRole="radio"
		accessibilityState={{selected, disabled}}
		accessibilityLabel={expeditionLocationTitle(option)}
		disabled={disabled}
		onPress={onSelect}
		style={[styles.option, selected && styles.selected]}
	>
		<TwemojiIcon emoji={expeditionLocationIcon(option)} size={OPTION_EMBLEM_SIZE} />
		<View style={styles.body}>
			<Text style={styles.title} numberOfLines={2}>{expeditionLocationTitle(option)}</Text>
			<View style={styles.stats}>{optionStats(option).map(stat => <View key={stat.key} style={styles.stat}>
				<TwemojiIcon emoji={stat.emoji} size={STAT_EMOJI_SIZE} />
				<Text style={[styles.statText, styles[stat.tone]]}>{stat.text}</Text>
			</View>)}</View>
		</View>
	</Pressable>;
}

export function ExpeditionProgressDetails({data}: {data: ExpeditionProgress}): ReactNode {
	const colors = useColors();
	const secondsLeft = useSecondsLeft(data.returnTime);
	const duration = data.startTime === undefined ? null : data.returnTime - data.startTime;
	return <ExpandableList>
		<Fact label={i18n.t("app:profile.titles.pet")} value={expeditionPetName(data.pet)} />
		<Fact label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data)} />
		<Fact label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.riskCategory)} />
		<Fact label={i18n.t("app:expedition.returnAt")} value={missionDate(data.returnTime)} />
		{duration ? <Gauge label={i18n.t("app:expedition.remaining")} value={formatDurationMinutes(secondsLeft / SECONDS_PER_MINUTE)} ratio={1 - secondsLeft * MILLISECONDS_PER_SECOND / duration} color={colors.green} /> : null}
		{data.durationMinutes !== undefined ? <Fact label={i18n.t("app:expedition.duration")} value={formatDurationMinutes(data.durationMinutes)} /> : null}
		<ExpeditionFoodDetails amount={data.foodConsumed} details={data.foodConsumedDetails} />
	</ExpandableList>;
}

export function ExpeditionRewardDetails({rewards}: {rewards: ExpeditionRewards}): ReactNode {
	return <>
		<ExpandableList>
			<Fact label={i18n.t("app:profile.fields.money")} value={formatMoney(rewards.money)} />
			<Fact label={i18n.t("app:profile.fields.experience")} value={formatNumber(rewards.experience)} />
			<Fact label={i18n.t("app:profile.fields.score")} value={formatNumber(rewards.points)} />
			{rewards.tokens !== undefined ? <Fact label={i18n.t("app:profile.fields.tokens")} value={formatNumber(rewards.tokens)} /> : null}
			{rewards.materialLoot?.map(material => <Fact key={material.materialId} label={materialName(material.materialId)} value={formatNumber(material.quantity)} />)}
		</ExpandableList>
		{rewards.cloneTalismanFound ? <EntryRow title={i18n.t("app:expedition.cloneFound")} /> : null}
		{rewards.itemGiven ? <EntryRow title={i18n.t("app:expedition.itemFound")} /> : null}
	</>;
}