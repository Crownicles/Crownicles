import {ReactNode, useRef, useState} from "react";
import {Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ClassesInfoReq} from "ws-packets/src/fromClient/ClassesInfoReq";
import {ClassesReq} from "ws-packets/src/fromClient/ClassesReq";
import {ClassesInfoRes} from "ws-packets/src/fromServer/classes/ClassesInfoRes";
import {ClassesCancelRes, ClassesCooldownRes} from "ws-packets/src/fromServer/classes/ClassesRes";
import {CLASSES_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ClassDetails} from "ws-packets/src/objects/ClassDetails";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {EmptyState, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Lock, LockHint, Refusal, Standing, useSectionStyles} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {Check, Clock3, Swords} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {CLASS_STAT_FIELDS, ClassStatField, ClassStatistics} from "@/src/components/ClassStatistics";
import {StatDelta} from "@/src/components/StatLine";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {UnitIcon} from "@/src/components/UnitIcon";
import {activeEffect, effectLock, PlayerEffect} from "@/src/display/CommandRejection";
import {formatNumber} from "@/src/display/Amounts";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const CHANGE_CLASS_MENU: CommandMenu = {request: ClassesReq, emptyPacket: ClassesCancelRes, emptyMessage: "app:classes.cancelled", outcomePackets: [ClassesCooldownRes]};

const MILLISECONDS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;
const FIGURE_WIDTH = 116;

/** The cooldown spans whole weeks, so hours only matter on its last day. */
function changeCountdown(timestamp?: number): string | null {
	const hours = timestamp === undefined ? 0 : Math.ceil((timestamp - Date.now()) / MILLISECONDS_PER_HOUR);
	if (hours <= 0) return null;
	return hours >= HOURS_PER_DAY
		? i18n.t("app:classes.availableInDays", {count: Math.ceil(hours / HOURS_PER_DAY)})
		: i18n.t("app:classes.availableInHours", {count: hours});
}

const useStyles = createStyles(colors => ({
	panel: {gap: Theme.spacing.md},
	description: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.story, lineHeight: Theme.lineHeight.story, color: colors.ink},
	subheading: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.muted, paddingTop: Theme.spacing.sm},
	attack: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm},
	attackBody: {flex: 1, minWidth: 0, gap: 2},
	attackName: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.ink},
	attackDescription: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	attackCost: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, color: colors.muted},
	notices: {paddingBottom: Theme.spacing.md},
	figure: {width: FIGURE_WIDTH, gap: 6},
	figureTop: {flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4},
	figureValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: colors.ink, fontVariant: ["tabular-nums"]},
	track: {height: 4, borderRadius: Theme.pillRadius, backgroundColor: colors.line, overflow: "hidden"},
	fill: {height: "100%", borderRadius: Theme.pillRadius}
}));

/** What changing class depends on, known before the press, and what pressing does. */
type ClassChange = {lock: Lock | undefined; pending: boolean; message: string | null; choose: (classId: number) => void};

/** Picks, in the server's offer, the class the player chose on this screen; null shows the whole offer instead. */
function reactionFor(collector: ReactionCollectorCreation, classId: number): number | null {
	const index = collector.reactions.findIndex(reaction => reaction.type === CLASSES_REACTION_KINDS.CHOOSE && reaction.data.classId === classId);
	return index === -1 ? null : index;
}

function useClassChange(nextChangeTimestamp: number | undefined, effect: PlayerEffect | null): ClassChange {
	const menus = useCommandMenus();
	const countdown = changeCountdown(nextChangeTimestamp);
	const lock: Lock | undefined = countdown ? {reason: countdown, icon: Clock3} : effect ? effectLock(effect) : undefined;
	return {
		lock,
		pending: menus.pending,
		message: menus.message,
		choose: (classId: number): void => {
			menus.open(CHANGE_CLASS_MENU, undefined, collector => reactionFor(collector, classId)).catch(console.error);
		}
	};
}

function ClassEmblem({classId, size}: {classId: number; size: number}): ReactNode {
	const colors = useColors();
	const icon = AppIcons.getIconOrNull(`classes.${classId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Swords size={size} color={colors.muted} />;
}

function classTier(details: ClassDetails): string {
	return i18n.t("app:classes.tierKind", {tier: details.stats.classGroup + 1, kind: i18n.t(`app:classes.kinds.${details.stats.classKind}`)});
}

/** The player's class may belong to a lower tier than the classes offered, whose figures the server does not send. */
function ClassStanding({classId, details}: {classId: number; details?: ClassDetails}): ReactNode {
	return <Standing
		testID="class-standing"
		emblem={<ClassEmblem classId={classId} size={40} />}
		caption={i18n.t("app:classes.yours")}
		title={i18n.t(`models:classes.${classId}`)}
		{...details ? {subtitle: classTier(details)} : {}}
	/>;
}

/** Why the class cannot change now, or why the server just refused it, never folded inside a class. */
function ChangeNotices({change}: {change: ClassChange}): ReactNode {
	const styles = useStyles();
	if (!change.lock && !change.message) return null;
	return <View style={styles.notices}>
		{change.lock ? <LockHint lock={change.lock} testID="class-change-lock" /> : null}
		{change.message ? <Refusal>{change.message}</Refusal> : null}
	</View>;
}

function ClassAttack({attack}: {attack: ClassDetails["attacks"][number]}): ReactNode {
	const styles = useStyles();
	const icon = AppIcons.getIconOrNull(`fightActions.${attack.id}`);
	return <View style={styles.attack}>
		{icon ? <TwemojiIcon emoji={icon} size={14} /> : null}
		<View style={styles.attackBody}>
			<Text style={styles.attackName} numberOfLines={1}>{i18n.t(`models:fight_actions.${attack.id}.name`, {count: 1})}</Text>
			<Text style={styles.attackDescription}>{i18n.t(`models:fight_actions.${attack.id}.description`)}</Text>
		</View>
		<TwemojiText textStyle={styles.attackCost} emojiSize={12}>{i18n.t("app:classes.breathCost", {cost: attack.cost})}</TwemojiText>
	</View>;
}

/** The criterion the list is ranked by, the best value among the classes, and the player's own class to measure against. */
type Comparison = {criterion: ClassStatField; best: number; reference?: ClassDetails};

/** A class's value on the chosen criterion: its gap to the player's class, the value, and a bar against the best class. */
function ClassFigure({details, comparison, current}: {details: ClassDetails; comparison: Comparison; current: boolean}): ReactNode {
	const styles = useStyles();
	const sectionStyles = useSectionStyles();
	const colors = useColors();
	const {criterion, best, reference} = comparison;
	const value = details.stats[criterion.field];
	return <View style={styles.figure}>
		<View style={styles.figureTop}>
			{current ? <Text style={sectionStyles.you}>{i18n.t("app:classes.current")}</Text> : null}
			{!current && reference ? <StatDelta value={value} reference={reference.stats[criterion.field]} /> : null}
			<Text style={styles.figureValue}>{formatNumber(value)}</Text>
			<UnitIcon unit={criterion.unit} size={13} />
		</View>
		<View style={styles.track}>
			<View style={[styles.fill, {width: `${best > 0 ? value / best * 100 : 0}%`, backgroundColor: current ? colors.green : colors.muted}]} />
		</View>
	</View>;
}

function ClassDetailsPanel({details, reference, change, onChoose}: {details: ClassDetails; reference?: ClassDetails; change?: ClassChange; onChoose: () => void}): ReactNode {
	const styles = useStyles();
	return <View style={styles.panel} testID={`class-details-${details.id}`}>
		{change ? <ActionBanner icon={Check} label={i18n.t("app:classes.choose")} pending={change.pending} onPress={onChoose} {...change.lock ? {lock: change.lock} : {}} /> : null}
		<Text style={styles.description}>{i18n.t(`models:class_descriptions.${details.id}`)}</Text>
		<Text style={styles.subheading}>{i18n.t("app:profile.titles.statistics")}</Text>
		<ClassStatistics stats={details.stats} {...reference ? {reference: reference.stats} : {}} />
		<Text style={styles.subheading}>{i18n.t("app:classes.attacks")}</Text>
		{details.attacks.map(attack => <ClassAttack key={attack.id} attack={attack} />)}
	</View>;
}

type ClassChoiceProps = {details: ClassDetails; comparison: Comparison; selected: boolean; onSelect: (id: number | undefined) => void; change?: ClassChange};

function ClassChoice({details, comparison, selected, onSelect, change}: ClassChoiceProps): ReactNode {
	const current = comparison.reference?.id === details.id;
	const chosen = useRef(false);
	const choose = (): void => {
		chosen.current = true;
		onSelect(undefined);
	};
	// The celebration that answers the choice must not open while the sheet is still leaving.
	const sendChoice = (): void => {
		if (!chosen.current) return;
		chosen.current = false;
		change?.choose(details.id);
	};
	return <ExpandableEntry
		emblem={<ClassEmblem classId={details.id} size={26} />}
		label={i18n.t(`models:classes.${details.id}`)}
		caption={classTier(details)}
		end={<ClassFigure details={details} comparison={comparison} current={current} />}
		expanded={selected}
		onToggle={(): void => onSelect(selected ? undefined : details.id)}
		onDismissed={sendChoice}
	>
		<ClassDetailsPanel
			details={details}
			{...current || !comparison.reference ? {} : {reference: comparison.reference}}
			{...current || !change ? {} : {change}}
			onChoose={choose}
		/>
	</ExpandableEntry>;
}

function criterionOf(field: string): ClassStatField {
	return CLASS_STAT_FIELDS.find(stat => stat.field === field) ?? CLASS_STAT_FIELDS[0];
}

/** Ranks the classes on one figure at a time, so the player sees at a glance which one is best at what. */
export function ClassesContent({classes, currentClass, change}: {classes: ClassDetails[]; currentClass?: number; change?: ClassChange}): ReactNode {
	const [selected, setSelected] = useState<number | undefined>();
	const [criterion, setCriterion] = useState<ClassStatField>(CLASS_STAT_FIELDS[0]);
	if (classes.length === 0) return <EmptyState>{i18n.t("app:classes.empty")}</EmptyState>;
	const current = classes.find(entry => entry.id === currentClass);
	const comparison: Comparison = {criterion, best: Math.max(...classes.map(entry => entry.stats[criterion.field])), ...current ? {reference: current} : {}};
	const ranked = [...classes].sort((first, second) => second.stats[criterion.field] - first.stats[criterion.field]);
	const criterionLabel = (stat: ClassStatField): string => i18n.t(`app:profile.fields.${stat.unit}`);
	return <>
		{currentClass === undefined ? null : <ClassStanding classId={currentClass} {...current ? {details: current} : {}} />}
		{change ? <ChangeNotices change={change} /> : null}
		<SectionHeader first={currentClass === undefined} action={{hint: criterionLabel(criterion)}}>{i18n.t("app:classes.comparison")}</SectionHeader>
		<SegmentedControl
			iconsOnly
			label={i18n.t("app:classes.comparison")}
			value={criterion.field}
			onChange={(field): void => setCriterion(criterionOf(field))}
			options={CLASS_STAT_FIELDS.map(stat => {
				const icon = AppIcons.getIconOrNull(`unitValues.${stat.unit}`);
				return {value: stat.field, label: criterionLabel(stat), ...icon ? {icon} : {}};
			})}
		/>
		<ExpandableList>{ranked.map(entry => <ClassChoice
			key={entry.id}
			details={entry}
			comparison={comparison}
			selected={entry.id === selected}
			onSelect={setSelected}
			{...change ? {change} : {}}
		/>)}</ExpandableList>
	</>;
}

function ClassesReady({info, currentClass, effect}: {info: ClassesInfoRes; currentClass: number | undefined; effect: PlayerEffect | null}): ReactNode {
	const change = useClassChange(info.data?.nextChangeTimestamp, effect);
	if (!info.data) return <EmptyState>{i18n.t("app:classes.empty")}</EmptyState>;
	return <ClassesContent classes={info.data.classesStats} change={change} {...(currentClass === undefined ? {} : {currentClass})} />;
}

export function Classes(): ReactNode {
	const profile = usePlayerProfile();
	const state = useGameQuery(GAME_ENTITIES.CLASSES, () => GameClient.request(makeFromClientPacket(ClassesInfoReq, {}), ClassesInfoRes));
	const currentClass = profile.status === "ready" ? profile.data.classId : undefined;
	const effect = profile.status === "ready" ? activeEffect(profile.data) : null;
	return <GameQueryContent state={state} entity={GAME_ENTITIES.CLASSES}>{info => <ClassesReady info={info} currentClass={currentClass} effect={effect} />}</GameQueryContent>;
}
