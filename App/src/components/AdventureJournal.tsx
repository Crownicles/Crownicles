import {ReactNode, useState} from "react";
import {View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {AdventureHistoryReq} from "ws-packets/src/fromClient/AdventureHistoryReq";
import {AdventureHistoryRes} from "ws-packets/src/fromServer/history/AdventureHistoryRes";
import {AdventureHistoryEvent} from "ws-packets/src/objects/AdventureHistory";
import {BIG_EVENT_END_POSSIBILITY_ID} from "ws-packets/src/fromServer/collectors";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Note, SectionHeader} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList} from "@/src/design/Sections";
import {Story} from "@/src/design/Story";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";
import {plainStory} from "@/src/display/Markdown";
import {missionDate} from "@/src/display/Missions";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

/** The emoji the outcome screen showed for this memory, so the player recognises it. */
function memoryIcon(memory: AdventureHistoryEvent): string | null {
	const base = `events.${memory.eventId}.${memory.possibilityId}`;
	return AppIcons.getIconOrNull(`${base}.${memory.outcomeId}`)
		?? AppIcons.getIconOrNull(base)
		?? AppIcons.getIconOrNull(`events.${memory.eventId}.end.${memory.outcomeId}`);
}

function memoryChoice(memory: AdventureHistoryEvent): string {
	return memory.possibilityId === BIG_EVENT_END_POSSIBILITY_ID
		? i18n.t("app:adventure.journal.noAnswer")
		: plainStory(i18n.t(`events:${memory.eventId}.possibilities.${memory.possibilityId}.text`));
}

function memoryPlace(memory: AdventureHistoryEvent): string {
	return memory.mapId === undefined ? i18n.t("app:adventure.unknownLocation") : i18n.t(`models:map_locations.${memory.mapId}.name`);
}

function memoryDay(date: number): string {
	return new Intl.DateTimeFormat(i18n.language, {weekday: "long", day: "numeric", month: "long"}).format(date);
}

function memoryTime(date: number): string {
	return new Intl.DateTimeFormat(i18n.language, {timeStyle: "short"}).format(date);
}

function MemoryEntry({memory}: {memory: AdventureHistoryEvent}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const icon = memoryIcon(memory);
	return <ExpandableEntry
		emblem={icon ? <TwemojiIcon emoji={icon} size={Theme.fontSize.rowTitle} /> : undefined}
		label={memoryChoice(memory)}
		caption={`${memoryTime(memory.date)} · ${memoryPlace(memory)}`}
		expanded={expanded}
		onToggle={(): void => setExpanded(open => !open)}
		testID={`memory-${memory.date}`}
	>
		<SectionHeader first>{i18n.t("app:adventure.journal.situation")}</SectionHeader>
		<Story>{i18n.t(`events:${memory.eventId}.text`)}</Story>
		<SectionHeader>{i18n.t("app:adventure.journal.outcome")}</SectionHeader>
		<Story>{i18n.t(`events:${memory.eventId}.possibilities.${memory.possibilityId}.outcomes.${memory.outcomeId}`)}</Story>
	</ExpandableEntry>;
}

function groupByDay(memories: AdventureHistoryEvent[]): {label: string; memories: AdventureHistoryEvent[]}[] {
	const days = new Map<string, AdventureHistoryEvent[]>();
	for (const memory of memories) {
		const label = memoryDay(memory.date);
		days.set(label, [...(days.get(label) ?? []), memory]);
	}
	return [...days].map(([label, dayMemories]) => ({label, memories: dayMemories}));
}

type OlderPages = {pages: AdventureHistoryRes[]; pending: boolean; failed: boolean; load: (() => void) | null};

/**
 * Later pages hang on the first page's time fence: a refreshed first page starts a new reading and drops them.
 */
function useOlderPages(first: AdventureHistoryRes): OlderPages {
	const [loaded, setLoaded] = useState<{until: number; pages: AdventureHistoryRes[]}>({until: first.until, pages: []});
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const pages = loaded.until === first.until ? loaded.pages : [];
	const nextPage = (pages.at(-1) ?? first).nextPage;
	const load = async (): Promise<void> => {
		setPending(true);
		setFailed(false);
		const answer = await GameClient.request(makeFromClientPacket(AdventureHistoryReq, {page: nextPage, until: first.until}), AdventureHistoryRes);
		setPending(false);
		if (answer.kind !== "answer" || !answer.packet.available) {
			setFailed(true);
			return;
		}
		setLoaded({until: first.until, pages: [...pages, answer.packet]});
	};
	return {pages, pending, failed, load: nextPage === undefined ? null : (): void => {
		load().catch(() => {
			setPending(false);
			setFailed(true);
		});
	}};
}

export function AdventureJournalContent({first}: {first: AdventureHistoryRes}): ReactNode {
	const older = useOlderPages(first);
	if (!first.available) return <Note>{i18n.t("app:adventure.journal.unavailable")}</Note>;
	const memories = [first, ...older.pages].flatMap(page => page.entries);
	return <>
		<Note>{i18n.t("app:adventure.journal.window", {date: missionDate(first.windowStartsAt)})}</Note>
		{memories.length === 0 ? <Note>{i18n.t("app:adventure.journal.empty")}</Note> : null}
		{groupByDay(memories).map((day, dayIndex) => <View key={day.label}>
			<SectionHeader first={dayIndex === 0}>{day.label}</SectionHeader>
			<ExpandableList>{day.memories.map((memory, index) => <MemoryEntry key={`${memory.date}-${index}`} memory={memory} />)}</ExpandableList>
		</View>)}
		{older.failed ? <Note>{i18n.t("app:adventure.journal.unavailable")}</Note> : null}
		{older.load ? <ButtonRow>
			<Button onPress={older.pending ? undefined : older.load} disabled={older.pending}>{i18n.t("app:adventure.journal.more")}</Button>
		</ButtonRow> : null}
	</>;
}

export function AdventureJournal(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.ADVENTURE_HISTORY, () => GameClient.request(makeFromClientPacket(AdventureHistoryReq, {}), AdventureHistoryRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.ADVENTURE_HISTORY}>{packet => <AdventureJournalContent first={packet} />}</GameQueryContent>;
}
