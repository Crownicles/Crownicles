import {ReactNode, useEffect, useState} from "react";
import {useRouter} from "expo-router";
import {GUILD_RECRUITMENT_MIN_SCORE_STEPS, RecruitingGuild} from "ws-packets/src/objects/GuildRecruitment";
import {MAX_GUILD_MEMBERS} from "ws-packets/src/objects/Guild";
import {Button, ButtonRow, EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Fact} from "@/src/design/Sections";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {TextField} from "@/src/design/Inputs";
import {Minus, Plus, Search, UserPlus} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {useGuildJoin, useGuildSearch, useRecruitmentSettings} from "@/src/store/useGuildRecruitment";
import {i18n} from "@/src/translations/i18n";

const RECRUITMENT_STATUSES = ["open", "closed"] as const;
type RecruitmentStatus = typeof RECRUITMENT_STATUSES[number];

function stepIndex(minScore: number): number {
	return Math.max(0, GUILD_RECRUITMENT_MIN_SCORE_STEPS.findIndex(step => step === minScore));
}

/** The minimum score moves from step to step, so the setting never needs the keyboard. */
function MinScoreStepper({minScore, pending, onChange}: {minScore: number; pending: boolean; onChange: (minScore: number) => void}): ReactNode {
	const index = stepIndex(minScore);
	const last = GUILD_RECRUITMENT_MIN_SCORE_STEPS.length - 1;
	return <>
		<ExpandableList><Fact label={i18n.t("app:guild.recruitment.minScore")} value={formatNumber(minScore)} /></ExpandableList>
		<ButtonRow>
			<Button icon={Minus} disabled={pending || index === 0} onPress={(): void => onChange(GUILD_RECRUITMENT_MIN_SCORE_STEPS[index - 1])}>{i18n.t("app:guild.recruitment.lower")}</Button>
			<Button icon={Plus} disabled={pending || index === last} onPress={(): void => onChange(GUILD_RECRUITMENT_MIN_SCORE_STEPS[index + 1])}>{i18n.t("app:guild.recruitment.raise")}</Button>
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
		max: MAX_GUILD_MEMBERS,
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

/** Looking for a guild: the most fitting ones at once, or those whose name contains a search. */
export function GuildJoin(): ReactNode {
	const router = useRouter();
	const [text, setText] = useState("");
	const {result, pending: searching, message: searchMessage, search} = useGuildSearch();
	const {pending: joining, message: joinMessage, join} = useGuildJoin(() => router.replace("/guild"));
	const unfolding = useExpandedEntry<number>();
	useEffect(() => search(""), [search]);
	const guilds = result?.guilds ?? [];
	const message = joinMessage ?? searchMessage;
	return <>
		<TextField label={i18n.t("app:guild.join.searchLabel")} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={(): void => search(text)} editable={!searching} />
		<ButtonRow>
			<Button icon={Search} disabled={searching} onPress={(): void => search(text)}>{i18n.t("app:guild.join.search")}</Button>
			{result?.search ? <Button disabled={searching} onPress={(): void => {
				setText("");
				search("");
			}}>{i18n.t("app:guild.join.suggestions")}</Button> : null}
		</ButtonRow>
		{message ? <Note>{message}</Note> : null}
		<SectionHeader>{result?.search ? i18n.t("app:guild.join.results", {search: result.search}) : i18n.t("app:guild.join.suggested")}</SectionHeader>
		{result ? <Note>{i18n.t("app:guild.join.yourScore", {score: formatNumber(result.playerScore)})}</Note> : null}
		<ExpandableList>{guilds.length > 0
			? guilds.map(guild => <RecruitingGuildEntry
				key={guild.id}
				guild={guild}
				expanded={unfolding.isExpanded(guild.id)}
				onToggle={(): void => unfolding.toggle(guild.id)}
				pending={joining}
				onJoin={(): void => join(guild.id)}
			/>)
			: <EmptyState>{i18n.t(result?.search ? "app:guild.join.noMatch" : "app:guild.join.noSuggestion")}</EmptyState>}
		</ExpandableList>
		<Note>{i18n.t("app:guild.join.invitation")}</Note>
	</>;
}
