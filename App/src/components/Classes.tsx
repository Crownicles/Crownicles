import {ReactNode, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ClassesInfoReq} from "ws-packets/src/fromClient/ClassesInfoReq";
import {ClassesReq} from "ws-packets/src/fromClient/ClassesReq";
import {ClassesInfoRes} from "ws-packets/src/fromServer/classes/ClassesInfoRes";
import {ClassesCancelRes, ClassesCooldownRes} from "ws-packets/src/fromServer/classes/ClassesRes";
import {ClassDetails} from "ws-packets/src/objects/ClassDetails";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Button, ButtonRow, EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList, sectionStyles, Standing} from "@/src/design/Sections";
import {Swords} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {ClassStatistics} from "@/src/components/ClassStatistics";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const CHANGE_CLASS_MENU: CommandMenu = {request: ClassesReq, emptyPacket: ClassesCancelRes, emptyMessage: "app:classes.cancelled", outcomePackets: [ClassesCooldownRes]};

const MILLISECONDS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;

/** The cooldown spans whole weeks, so hours only matter on its last day. */
function changeCountdown(timestamp?: number): string | null {
	const hours = timestamp === undefined ? 0 : Math.ceil((timestamp - Date.now()) / MILLISECONDS_PER_HOUR);
	if (hours <= 0) return null;
	return hours >= HOURS_PER_DAY
		? i18n.t("app:classes.availableInDays", {count: Math.ceil(hours / HOURS_PER_DAY)})
		: i18n.t("app:classes.availableInHours", {count: hours});
}

const styles = StyleSheet.create({
	description: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.note, lineHeight: Theme.lineHeight.note, color: Theme.colors.muted, paddingTop: Theme.spacing.md, borderTopWidth: 1, borderColor: Theme.colors.line},
	attacksLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.muted, paddingTop: Theme.spacing.sm},
	attack: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm},
	attackBody: {flex: 1, minWidth: 0, gap: 2},
	attackName: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowSubtitle, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.ink},
	attackDescription: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	attackCost: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, color: Theme.colors.muted}
});

function ClassEmblem({classId, size}: {classId: number; size: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`classes.${classId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Swords size={size} color={Theme.colors.muted} />;
}

function classTier(details: ClassDetails): string {
	return i18n.t("app:classes.tierKind", {tier: details.stats.classGroup + 1, kind: i18n.t(`app:classes.kinds.${details.stats.classKind}`)});
}

function ClassStanding({details}: {details: ClassDetails}): ReactNode {
	return <Standing
		testID="class-standing"
		emblem={<ClassEmblem classId={details.id} size={40} />}
		caption={i18n.t("app:classes.yours")}
		title={i18n.t(`models:classes.${details.id}`)}
		subtitle={classTier(details)}
	/>;
}

function ClassAttack({attack}: {attack: ClassDetails["attacks"][number]}): ReactNode {
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

function ClassDetailsPanel({details}: {details: ClassDetails}): ReactNode {
	return <View testID={`class-details-${details.id}`}>
		<Text style={styles.description}>{i18n.t(`models:class_descriptions.${details.id}`)}</Text>
		<ClassStatistics stats={details.stats} />
		<Text style={styles.attacksLabel}>{i18n.t("app:classes.attacks")}</Text>
		{details.attacks.map(attack => <ClassAttack key={attack.id} attack={attack} />)}
	</View>;
}

type ClassChoiceProps = {details: ClassDetails; current: boolean; selected: boolean; onSelect: (id: number) => void};

function ClassChoice({details, current, selected, onSelect}: ClassChoiceProps): ReactNode {
	return <ExpandableEntry
		emblem={<ClassEmblem classId={details.id} size={26} />}
		label={i18n.t(`models:classes.${details.id}`)}
		caption={classTier(details)}
		{...current ? {end: <Text style={sectionStyles.you}>{i18n.t("app:classes.current")}</Text>} : {}}
		expanded={selected}
		highlighted={current}
		onToggle={(): void => onSelect(details.id)}
	>
		<ClassDetailsPanel details={details} />
	</ExpandableEntry>;
}

export function ClassesContent({classes, currentClass}: {classes: ClassDetails[]; currentClass?: number}): ReactNode {
	const [selected, setSelected] = useState<number | undefined>(currentClass);
	const current = classes.find(entry => entry.id === currentClass);
	const select = (id: number): void => setSelected(previous => previous === id ? undefined : id);
	if (classes.length === 0) return <EmptyState>{i18n.t("app:classes.empty")}</EmptyState>;
	return <>
		{current ? <ClassStanding details={current} /> : null}
		<SectionHeader first={!current}>{i18n.t("app:classes.comparison")}</SectionHeader>
		<ExpandableList>{classes.map(entry => <ClassChoice key={entry.id} details={entry} current={entry.id === currentClass} selected={entry.id === selected} onSelect={select} />)}</ExpandableList>
	</>;
}

export function Classes(): ReactNode {
	const queryClient = useQueryClient();
	const profile = usePlayerProfile();
	const state = useGameQuery(GAME_ENTITIES.CLASSES, () => GameClient.request(makeFromClientPacket(ClassesInfoReq, {}), ClassesInfoRes));
	const {message, pending, open} = useCommandMenus();
	if (state.status === "loading") return <EmptyState>{i18n.t("app:common.loading")}</EmptyState>;
	if (state.status === "failed") return <>
		<Note>{state.rejection ? commandRejectionMessage(state.rejection) : i18n.t("app:common.error")}</Note>
		<ButtonRow><Button onPress={(): void => {queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.CLASSES)}).catch(console.error);}}>{i18n.t("app:common.retry")}</Button></ButtonRow>
	</>;
	if (state.status !== "ready" || !state.data.data) return <EmptyState>{i18n.t("app:classes.empty")}</EmptyState>;
	const countdown = changeCountdown(state.data.data.nextChangeTimestamp);
	return <>
		<ClassesContent classes={state.data.data.classesStats} {...(profile.status === "ready" ? {currentClass: profile.data.classId} : {})} />
		<ButtonRow><Button variant="primary" icon={Swords} disabled={pending || countdown !== null} onPress={(): Promise<void> => open(CHANGE_CLASS_MENU)}>{countdown ?? i18n.t("app:classes.change")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
	</>;
}