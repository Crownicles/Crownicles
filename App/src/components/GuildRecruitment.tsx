import {ReactNode, useEffect, useState} from "react";
import {useRouter} from "expo-router";
import {RecruitingGuild} from "ws-packets/src/objects/GuildRecruitment";
import {GuildRecruitmentListRes} from "ws-packets/src/fromServer/guild/GuildRecruitmentRes";
import {gameRules} from "@/src/rules/GameRules";
import {Button, ButtonRow, EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Fact, Refusal} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {Minus, Plus, Search, UserPlus} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {useGuildJoin, useGuildSearch, useRecruitmentSettings} from "@/src/store/useGuildRecruitment";
import {i18n} from "@/src/translations/i18n";

const RECRUITMENT_STATUSES = ["open", "closed"] as const;
type RecruitmentStatus = typeof RECRUITMENT_STATUSES[number];

function stepIndex(steps: number[], minScore: number): number {
	return Math.max(0, steps.findIndex(step => step === minScore));
}

/** The minimum score moves from step to step, so the setting never needs the keyboard. */
function MinScoreStepper({minScore, pending, onChange}: {minScore: number; pending: boolean; onChange: (minScore: number) => void}): ReactNode {
	const steps = gameRules().guild.recruitmentMinScoreSteps;
	const index = stepIndex(steps, minScore);
	const last = steps.length - 1;
	return <>
		<ExpandableList><Fact label={i18n.t("app:guild.recruitment.minScore")} value={formatNumber(minScore)} /></ExpandableList>
		<ButtonRow>
			<Button icon={Minus} disabled={pending || index === 0} onPress={(): void => onChange(steps[index - 1])}>{i18n.t("app:guild.recruitment.lower")}</Button>
			<Button icon={Plus} disabled={pending || index === last} onPress={(): void => onChange(steps[index + 1])}>{i18n.t("app:guild.recruitment.raise")}</Button>
		</ButtonRow>
	</>;
}

/** The chief or the elder opens the guild to newcomers and sets how much score they must bring. */
export function RecruitmentSettings(): ReactNode {
	const {state, pending, change} = useRecruitmentSettings();
	if (state.status === "loading") return null;
	return <>
		<SectionHeader>{i18n.t("app:guild.recruitment.title")}</SectionHeader>
		{state.status === "ready"
			? <>
				<SegmentedControl<RecruitmentStatus>
					options={RECRUITMENT_STATUSES.map(value => ({value, label: i18n.t(`app:guild.recruitment.statuses.${value}`)}))}
					value={state.settings.open ? "open" : "closed"}
					onChange={(value): void => change({open: value === "open"})}
					label={i18n.t("app:guild.recruitment.title")}
				/>
				<Note>{i18n.t(state.settings.open ? "app:guild.recruitment.openHint" : "app:guild.recruitment.closedHint")}</Note>
				<MinScoreStepper minScore={state.settings.minScore} pending={pending} onChange={(minScore): void => change({minScore})} />
			</>
			: <Note>{i18n.t(state.status === "noOffice" ? "app:guild.recruitment.noOffice" : "app:common.error")}</Note>}
	</>;
}

function guildCaption(guild: RecruitingGuild): string {
	return i18n.t("app:guild.join.caption", {
		level: guild.level,
		members: guild.memberCount,
		max: gameRules().guild.maxMembers,
		minScore: formatNumber(guild.minScore)
	});
}

function RecruitingGuildEntry({guild, expanded, onToggle, pending, onJoin}: {
	guild: RecruitingGuild;
	expanded: boolean;
	onToggle: () => void;
	pending: boolean;
	onJoin: () => void;
}): ReactNode {
	return <ExpandableEntry label={guild.name} caption={guildCaption(guild)} expanded={expanded} onToggle={onToggle} dimmed={Boolean(guild.blocker)}>
		<ActionBanner
			icon={UserPlus}
			label={i18n.t("app:guild.join.join", {name: guild.name})}
			pending={pending}
			onPress={onJoin}
			{...guild.blocker ? {lock: {reason: i18n.t(`app:guild.join.blockers.${guild.blocker}`)}} : {}}
		/>
	</ExpandableEntry>;
}

/** On a recruiting guild's own page, a player without a guild joins it where they found it. */
export function GuildJoinOffer({guild}: {guild: RecruitingGuild}): ReactNode {
	const router = useRouter();
	const {pending, message, join} = useGuildJoin(() => router.replace("/guild"));
	return <>
		<Note>{guildCaption(guild)}</Note>
		{message ? <Refusal>{message}</Refusal> : null}
		<ActionBanner
			icon={UserPlus}
			label={i18n.t("app:guild.join.join", {name: guild.name})}
			pending={pending}
			onPress={(): void => join(guild.id)}
			{...guild.blocker ? {lock: {reason: i18n.t(`app:guild.join.blockers.${guild.blocker}`)}} : {}}
			testID="guild-join-offer"
		/>
	</>;
}

/** A name to look for; once a search was made, a way back to the suggestions. */
function GuildSearchForm({searching, searched, onSearch}: {searching: boolean; searched: boolean; onSearch: (text: string) => void}): ReactNode {
	const [text, setText] = useState("");
	return <FormBlock>
		<TextField label={i18n.t("app:guild.join.searchLabel")} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={(): void => onSearch(text)} editable={!searching} />
		<ButtonRow>
			<Button icon={Search} disabled={searching} onPress={(): void => onSearch(text)}>{i18n.t("app:guild.join.search")}</Button>
			{searched ? <Button disabled={searching} onPress={(): void => {
				setText("");
				onSearch("");
			}}>{i18n.t("app:guild.join.suggestions")}</Button> : null}
		</ButtonRow>
	</FormBlock>;
}

function RecruitingGuildList({guilds, searched, joining, onJoin}: {guilds: RecruitingGuild[]; searched: boolean; joining: boolean; onJoin: (guildId: number) => void}): ReactNode {
	const unfolding = useExpandedEntry<number>();
	if (guilds.length === 0) {
		return <ExpandableList><EmptyState>{i18n.t(searched ? "app:guild.join.noMatch" : "app:guild.join.noSuggestion")}</EmptyState></ExpandableList>;
	}
	return <ExpandableList>{guilds.map(guild => <RecruitingGuildEntry
		key={guild.id}
		guild={guild}
		expanded={unfolding.isExpanded(guild.id)}
		onToggle={(): void => unfolding.toggle(guild.id)}
		pending={joining}
		onJoin={(): void => onJoin(guild.id)}
	/>)}</ExpandableList>;
}

function SearchHeading({result}: {result: GuildRecruitmentListRes | null}): ReactNode {
	return <>
		<SectionHeader>{result?.search ? i18n.t("app:guild.join.results", {search: result.search}) : i18n.t("app:guild.join.suggested")}</SectionHeader>
		{result ? <Note>{i18n.t("app:guild.join.yourScore", {score: formatNumber(result.playerScore)})}</Note> : null}
	</>;
}

/** Looking for a guild: the most fitting ones at once, or those whose name contains a search. */
export function GuildJoin(): ReactNode {
	const router = useRouter();
	const {result, pending: searching, message: searchMessage, search} = useGuildSearch();
	const {pending: joining, message: joinMessage, join} = useGuildJoin(() => router.replace("/guild"));
	useEffect(() => search(""), [search]);
	const message = joinMessage ?? searchMessage;
	const searched = Boolean(result?.search);
	return <>
		<GuildSearchForm searching={searching} searched={searched} onSearch={search} />
		{message ? <Note>{message}</Note> : null}
		<SearchHeading result={result} />
		<RecruitingGuildList guilds={result?.guilds ?? []} searched={searched} joining={joining} onJoin={join} />
		<Note>{i18n.t("app:guild.join.invitation")}</Note>
	</>;
}
