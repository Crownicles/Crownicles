import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {Clock3, Info, Wind, Swords} from "@/src/design/FightIcons";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS, FIGHT_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {ExpandableList, Fact, Sheet} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {FightIconButton, useCompactFight} from "@/src/components/FightControls";
import {FIGHT_ACTION_MOTIONS, FIGHT_MOTIONS} from "@/src/display/FightMotion";
import {FightGauge} from "@/src/components/FightGauge";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {useFight} from "@/src/store/FightStore";
import {fightActionName} from "@/src/display/Fight";
import {expeditionPetLabel} from "@/src/display/PetExpedition";
import {formatGlory, formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type CollectorProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

const styles = StyleSheet.create({
	choices: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.sm},
	card: {flexBasis: "47%", flexGrow: 1, minWidth: 0, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: 12, backgroundColor: Theme.colors.paper},
	rest: {flexBasis: "100%", backgroundColor: Theme.colors.wash},
	button: {minHeight: 78, padding: Theme.spacing.md, paddingRight: 32, gap: 8, borderRadius: 12},
	pressed: {backgroundColor: Theme.colors.wash, transform: [{scale: 0.98}]},
	disabled: {opacity: 0.45},
	name: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm},
	label: {flex: 1, minWidth: 0, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: Theme.colors.ink},
	foot: {flexDirection: "row", alignItems: "center", gap: 5},
	cost: {fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.muted},
	info: {position: "absolute", right: 0, top: 0},
	header: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9},
	heading: {fontFamily: Theme.fonts.bold, fontSize: 13, color: Theme.colors.ink},
	timer: {flexDirection: "row", alignItems: "center", gap: 4},
	timerText: {fontFamily: Theme.fonts.semiBold, fontSize: 11, color: Theme.colors.muted, fontVariant: ["tabular-nums"]},
	urgent: {color: Theme.colors.red},
	compactButton: {minHeight: 58, paddingVertical: 5, paddingLeft: 8, paddingRight: 28, gap: 4},
	compactLabel: {fontSize: 12, lineHeight: 16},
	compactChoices: {gap: 6},
	preparation: {alignItems: "center", gap: 9, paddingVertical: 10},
	preparationName: {fontFamily: Theme.fonts.bold, fontSize: 17, color: Theme.colors.ink},
	preparationStats: {flexDirection: "row", justifyContent: "space-around", paddingVertical: 18, borderBottomWidth: 1, borderColor: Theme.colors.line, marginBottom: 12},
	preparationStat: {alignItems: "center", gap: 6},
	statValue: {fontFamily: Theme.fonts.bold, fontSize: 17, color: Theme.colors.ink},
	statLabel: {fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.muted}
});

const URGENT_REMAINING_SECONDS = 10;
type ActionOption = {id?: string; index: number; cost?: number};

function FightActionButton({actionId, cost, disabled, onPress, onDetails}: {actionId: string; cost?: number; disabled: boolean; onPress: () => void; onDetails: () => void}): ReactNode {
	const compact = useCompactFight();
	const icon = AppIcons.getIconOrNull(`fightActions.${actionId}`);
	const description = i18n.t(`models:fight_actions.${actionId}.description`, {defaultValue: ""});
	const resting = FIGHT_ACTION_MOTIONS.get(actionId) === FIGHT_MOTIONS.REST;
	return <View style={[styles.card, resting && styles.rest]}>
		<Pressable accessibilityRole="button" accessibilityLabel={fightActionName(actionId)} accessibilityHint={description} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} onLongPress={onDetails} style={({pressed}) => [styles.button, compact && styles.compactButton, pressed && styles.pressed, disabled && styles.disabled]}>
			<View style={styles.name}>{icon ? <TwemojiIcon emoji={icon} size={compact ? 17 : 20} /> : null}<Text style={[styles.label, compact && styles.compactLabel]} numberOfLines={2}>{fightActionName(actionId)}</Text></View>
			<View style={styles.foot}>{cost === undefined ? null : <><Wind size={12} color={Theme.colors.blue} /><Text style={styles.cost}>{i18n.t("app:arena.actionBreath", {value: cost})}</Text></>}</View>
		</Pressable>
		<View style={styles.info}><FightIconButton icon={Info} label={i18n.t("app:battle.actionDetails", {action: fightActionName(actionId)})} onPress={onDetails} /></View>
	</View>;
}

export function FightConfirmCollector({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== FIGHT_DATA_KINDS.CONFIRM) return null;
	const stats = collector.data.data.playerStats;
	const classIcon = AppIcons.getIconOrNull(`classes.${stats.classId}`);
	const accept = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
	const refuse = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	return <Sheet
		caption={i18n.t("app:arena.eyebrow")}
		title={i18n.t("app:arena.confirm")}
		closeLabel={i18n.t("app:collector.refuse")}
		onClose={(): void => answer(refuse)}
	>
		<View style={styles.preparation}>{classIcon ? <TwemojiIcon emoji={classIcon} size={44} /> : <Swords size={36} color={Theme.colors.muted} />}<Text style={styles.preparationName}>{i18n.t(`models:classes.${stats.classId}`)}</Text></View>
		<FightGauge emoji={AppIcons.getIcon("unitValues.energy")} label={i18n.t("app:arena.energy")} value={stats.energy.value} max={stats.energy.max} color={Theme.colors.green} reducedMotion />
		<View style={styles.preparationStats}>{(["attack", "defense", "speed"] as const).map(key => <View key={key} style={styles.preparationStat}><TwemojiIcon emoji={AppIcons.getIcon(`unitValues.${key}`)} size={18} /><Text style={styles.statValue}>{formatNumber(stats[key])}</Text><Text style={styles.statLabel}>{i18n.t(`app:arena.stats.${key}`)}</Text></View>)}</View>
		<ExpandableList>
			<Fact label={i18n.t("app:arena.glory")} value={formatGlory(stats.fightRanking.glory)} />
			{stats.pet ? <Fact label={i18n.t("app:arena.pet")} value={expeditionPetLabel(stats.pet)} /> : null}
		</ExpandableList>
		{stats.pet?.isOnExpedition ? <Note>{i18n.t("app:pet.powers.expedition")}</Note> : null}
		<ButtonRow><Button variant="primary" icon={Swords} disabled={locked || accept < 0} onPress={(): void => answer(accept)}>{i18n.t("app:arena.start")}</Button><Button disabled={locked || refuse < 0} onPress={(): void => answer(refuse)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
	</Sheet>;
}

function ActionGrid({options, locked, onChoose}: {options: ActionOption[]; locked: boolean; onChoose: (index: number) => void}): ReactNode {
	const [details, setDetails] = useState<string | null>(null);
	const compact = useCompactFight();
	return <>
		<View style={[styles.choices, compact && styles.compactChoices]}>
		{options.map(option => {
			if (!option.id) return <View key={`unknown:${option.index}`} style={[styles.card, styles.disabled]}><Note>{i18n.t("app:collector.unknownChoice")}</Note></View>;
			const actionId = option.id;
			return <FightActionButton key={actionId} actionId={actionId} {...(option.cost === undefined ? {} : {cost: option.cost})} disabled={locked || option.index < 0} onPress={(): void => onChoose(option.index)} onDetails={(): void => setDetails(actionId)} />;
		})}
		</View>
		{details ? <Sheet
			caption={i18n.t("app:battle.actions")}
			title={fightActionName(details)}
			closeLabel={i18n.t("app:common.back")}
			onClose={(): void => setDetails(null)}
		><Note>{i18n.t(`models:fight_actions.${details}.description`, {defaultValue: ""})}</Note></Sheet> : null}
	</>;
}

export function FightActions({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const {introduction} = useFight();
	const actions = introduction?.initiatorActions ?? [];
	const options: ActionOption[] = actions.map(([id, cost]) => ({id, cost, index: collector.reactions.findIndex(reaction => reaction.type === FIGHT_REACTION_KINDS.ACTION && reaction.data.id === id)}));
	collector.reactions.forEach((reaction, index) => {
		if (reaction.type !== FIGHT_REACTION_KINDS.ACTION) options.push({index});
		else if (!actions.some(([id]) => id === reaction.data.id)) options.push({id: reaction.data.id, index});
	});
	return <>
		<View style={styles.header}><Text style={styles.heading}>{i18n.t(locked ? "app:battle.actions" : "app:battle.chooseAction")}</Text><View style={styles.timer}><Clock3 size={13} color={secondsLeft <= URGENT_REMAINING_SECONDS ? Theme.colors.red : Theme.colors.muted} /><Text style={[styles.timerText, secondsLeft <= URGENT_REMAINING_SECONDS && styles.urgent]}>{i18n.t("app:battle.seconds", {seconds: secondsLeft})}</Text></View></View>
		<ActionGrid options={options} locked={locked} onChoose={answer} />
	</>;
}

export function FightActionsWaiting({actions}: {actions: [string, number][]}): ReactNode {
	return <>
		<View style={styles.header}><Text style={styles.heading}>{i18n.t("app:battle.actions")}</Text><Text style={styles.timerText}>{i18n.t("app:battle.wait")}</Text></View>
		<ActionGrid options={actions.map(([id, cost]) => ({id, cost, index: -1}))} locked onChoose={() => undefined} />
	</>;
}
