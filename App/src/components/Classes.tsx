import {ReactNode, useState} from "react";
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
import {Button, ButtonRow, EmptyState, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {ClassStatistics} from "@/src/components/ClassStatistics";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {className} from "@/src/display/Classes";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const CHANGE_CLASS_MENU: CommandMenu = {request: ClassesReq, emptyPacket: ClassesCancelRes, emptyMessage: "app:classes.cancelled", outcomePackets: [ClassesCooldownRes]};

function ClassDescription({details, onBack}: {details: ClassDetails; onBack: () => void}): ReactNode {
	return <>
		<ButtonRow><Button onPress={onBack}>{i18n.t("app:classes.comparison")}</Button></ButtonRow>
		<SectionHeader>{className(details.id)}</SectionHeader>
		<Note>{i18n.t(`models:class_descriptions.${details.id}`)}</Note>
		<ClassStatistics stats={details.stats} />
		<SectionHeader>{i18n.t("app:classes.attacks")}</SectionHeader>
		<Panel>{details.attacks.map(attack => <Row key={attack.id}
			title={i18n.t("app:classes.name", {icon: AppIcons.getIcon(`fightActions.${attack.id}`), name: i18n.t(`models:fight_actions.${attack.id}.name`, {count: 1})})}
			subtitle={i18n.t(`models:fight_actions.${attack.id}.description`)}
			end={i18n.t("app:classes.breathCost", {cost: attack.cost})}
		/>)}</Panel>
	</>;
}

export function ClassesContent({classes, currentClass}: {classes: ClassDetails[]; currentClass?: number}): ReactNode {
	const [selected, setSelected] = useState<number | null>(null);
	const details = classes.find(entry => entry.id === selected);
	if (details) return <ClassDescription details={details} onBack={(): void => setSelected(null)} />;
	if (classes.length === 0) return <EmptyState>{i18n.t("app:classes.empty")}</EmptyState>;
	return <>
		<SectionHeader>{i18n.t("app:classes.comparison")}</SectionHeader>
		<Panel>{classes.map(entry => <Row key={entry.id} title={className(entry.id)}
			subtitle={i18n.t("app:classes.tierKind", {tier: entry.stats.classGroup + 1, kind: i18n.t(`app:classes.kinds.${entry.stats.classKind}`)})}
			{...(entry.id === currentClass ? {end: i18n.t("app:classes.current")} : {})}
			onPress={(): void => setSelected(entry.id)} chevron
		/>)}</Panel>
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
	return <>
		<ButtonRow><Button variant="primary" disabled={pending} onPress={(): Promise<void> => open(CHANGE_CLASS_MENU)}>{i18n.t("app:classes.change")}</Button></ButtonRow>
		{message ? <Note>{message}</Note> : null}
		<ClassesContent classes={state.data.data.classesStats} {...(profile.status === "ready" ? {currentClass: profile.data.classId} : {})} />
	</>;
}