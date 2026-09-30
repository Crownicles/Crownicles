import {ReactNode, useState} from "react";
import {Text, View} from "react-native";
import {useRouter} from "expo-router";
import {useOpenPlayer} from "@/src/navigation/OtherProfiles";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildCreateReq, GuildDailyReq, GuildStorageReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildDescriptionReq, GuildLeaveReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {GuildCommandRes, GuildStorageRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildData, GuildMember, GuildMembership} from "ws-packets/src/objects/Guild";
import {TEXT_RULE_IDS} from "ws-packets/src/objects/TextRules";
import {checkText} from "@/src/rules/InputChecks";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCommandMenus, CommandMenu} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {FightGauge} from "@/src/components/FightGauge";
import {GuildBoatBoarding, GuildInvitation, GuildMemberControls} from "@/src/components/GuildMembers";
import {UnitIcon} from "@/src/components/UnitIcon";
import {Button, ButtonRow, EmptyState, Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, Figure, Figures, Lock, Refusal, useSectionStyles, Standing} from "@/src/design/Sections";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {guildPacketRefusal} from "@/src/collectors/GuildOutcome";
import {ArrowRight, Check, Clock3, Gift, LogOut, Star} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {GuildJoinOffer, RecruitmentSettings} from "@/src/components/GuildRecruitment";

export type GuildPage = "storage" | "shelter" | "domain" | "rankings" | "leave";
const CREATE_MENU: CommandMenu = {request: GuildCreateReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal};
const DAILY_MENU: CommandMenu = {request: GuildDailyReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal};
const DESCRIPTION_MENU: CommandMenu = {request: GuildDescriptionReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal};
const LEAVE_MENU: CommandMenu = {request: GuildLeaveReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal};

/** Only the whereabouts another member can act upon are worth a word; the rest is noise. */
const TRAVEL_STATUSES = ["isOnPveIsland", "isOnBoat"] as const;
const GUILD_PAGES = ["storage", "shelter", "domain", "rankings", "leave"] as const;
const PAGE_ICONS = {storage: "foods.commonFood", shelter: "city.guildDomain.shelter", domain: "city.guildDomain.menu", rankings: "top.congrats", leave: "city.exit"} as const;
const MILLISECONDS_PER_MINUTE = 60_000;

const useStyles = createStyles(colors => ({
	links: {marginTop: Theme.spacing.xxl},
	self: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.green},
	score: {alignItems: "flex-end", gap: 3, flexShrink: 0}
}));

/** The gauge takes an emoji only when the asset pack ships one, so an unknown path leaves it bare. */
export function gaugeEmoji(path: string): {emoji?: string} {
	const icon = AppIcons.getIconOrNull(path);
	return icon ? {emoji: icon} : {};
}

export function GuildCreation(): ReactNode {
	const [name, setName] = useState("");
	const {pending, message, open, clearMessage} = useCommandMenus();
	const guildName = checkText(name, TEXT_RULE_IDS.GUILD_NAME);
	return <FormBlock>
		<TextField label={i18n.t("app:guild.name")} value={name} onChangeText={(value): void => {
			setName(value);
			clearMessage();
		}} editable={!pending} autoCorrect={false} lock={guildName.lock} refusal={message} />
		<ButtonRow><Button variant="primary" disabled={pending || guildName.lock !== null} onPress={(): Promise<void> => open(CREATE_MENU, makeFromClientPacket(GuildCreateReq, {askedGuildName: guildName.value}))}>{i18n.t("app:guild.create")}</Button></ButtonRow>
	</FormBlock>;
}

export function GuildStorage(): ReactNode {
	const sectionStyles = useSectionStyles();
	const colors = useColors();
	const state = useGameQuery(GAME_ENTITIES.GUILD_STORAGE, () => GameClient.request(makeFromClientPacket(GuildStorageReq, {}), GuildStorageRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD_STORAGE}>{data => <>
		<SectionHeader first>{data.guildName}</SectionHeader>
		{data.foods.map(food => <View key={food.id} style={sectionStyles.gauge}>
			<FightGauge
				label={i18n.t(`models:foods.${food.id}`, {count: food.amount, context: "capitalized"})}
				value={food.amount}
				max={food.maxAmount}
				color={colors.gold}
				{...gaugeEmoji(`foods.${food.id}`)}
			/>
		</View>)}
	</>}</GameQueryContent>;
}

type MemberRole = "chief" | "elder" | "member";

function memberRole(member: GuildMember, guild: GuildData): MemberRole {
	return member.id === guild.chiefId ? "chief" : member.id === guild.elderId ? "elder" : "member";
}

function memberCaption(member: GuildMember, role: MemberRole): string {
	const travels = TRAVEL_STATUSES.filter(key => member.islandStatus[key]).map(key => i18n.t(`app:guild.island.${key}`));
	const probation = member.probationEndsAt === undefined ? [] : [i18n.t("app:guild.onProbation")];
	return [i18n.t(`app:guild.roles.${role}`), ...probation, ...travels].join(" · ");
}

function MemberEmblem({role, size = 26}: {role: MemberRole; size?: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`guild.${role}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : null;
}

function MemberScore({member}: {member: GuildMember}): ReactNode {
	const sectionStyles = useSectionStyles();
	const styles = useStyles();
	return <View style={styles.score}>
		<View style={sectionStyles.value}>
			<Text style={sectionStyles.amount} numberOfLines={1}>{formatNumber(member.score)}</Text>
			<UnitIcon unit="score" size={12} />
		</View>
		{member.isSelf ? <Text style={styles.self}>{i18n.t("app:guild.you")}</Text> : null}
	</View>;
}

type MemberEntryProps = {member: GuildMember; guild: GuildData; expanded: boolean; onToggle: (id: number) => void};

function useOpenMemberProfile(guildName: string): (member: GuildMember) => void {
	const router = useRouter();
	const openPlayer = useOpenPlayer();
	return (member): void => member.isSelf
		? router.navigate("/profile")
		: openPlayer(member.playerRef, guildName);
}

function MemberEntry({member, guild, expanded, onToggle}: MemberEntryProps): ReactNode {
	const sectionStyles = useSectionStyles();
	const openProfile = useOpenMemberProfile(guild.name);
	const role = memberRole(member, guild);
	const heading = {
		emblem: <MemberEmblem role={role} />,
		label: member.name ?? i18n.t("app:profile.values.unknown"),
		caption: memberCaption(member, role),
		end: <MemberScore member={member} />,
		highlighted: member.isSelf,
		testID: `guild-member-${member.id}`
	};
	// Outside one's own guild there is nothing to do with a member but look them up.
	if (!guild.membership) {
		return <ExpandableEntry {...heading} expanded={false} chevron={ENTRY_CHEVRONS.FORWARD} onToggle={(): void => openProfile(member)} />;
	}
	return <ExpandableEntry {...heading} expanded={expanded} onToggle={(): void => onToggle(member.id)}>
		<Text style={sectionStyles.caption}>{i18n.t("app:guild.memberRank", {rank: formatNumber(member.rank)})}</Text>
		<ActionBanner
			icon={ArrowRight}
			label={i18n.t("app:guild.openProfile")}
			onPress={(): void => {
				onToggle(member.id);
				openProfile(member);
			}}
			testID={`guild-member-profile-${member.id}`}
		/>
		<GuildBoatBoarding member={member} />
		<GuildMemberControls member={member} guild={guild} />
	</ExpandableEntry>;
}

function GuildMemberList({guild}: {guild: GuildData}): ReactNode {
	const {isExpanded, toggle} = useExpandedEntry<number>();
	return <ExpandableList>
		{guild.members.map(member => <MemberEntry key={member.id} member={member} guild={guild} expanded={isExpanded(member.id)} onToggle={toggle} />)}
	</ExpandableList>;
}

function GuildDescriptionForm({guild, lock}: {guild: GuildData; lock?: Lock}): ReactNode {
	const [description, setDescription] = useState(guild.description ?? "");
	const {pending, message, open, clearMessage} = useCommandMenus();
	const checked = checkText(description, TEXT_RULE_IDS.GUILD_DESCRIPTION);
	const unchanged = checked.value === (guild.description ?? "");
	const blocked = lock ?? (unchanged ? {reason: i18n.t("app:guild.descriptionUnchanged")} : checked.lock ?? undefined);
	return <>
		<SectionHeader first>{i18n.t("app:guild.identity")}</SectionHeader>
		<FormBlock>
			<TextField
				label={i18n.t("app:guild.description")}
				value={description}
				onChangeText={(value): void => {
					setDescription(value);
					clearMessage();
				}}
				multiline
				returnKeyType="done"
				submitBehavior="blurAndSubmit"
				editable={!pending && !lock}
				refusal={message}
			/>
			<ActionBanner
				icon={Check}
				label={i18n.t("app:pet.care.save")}
				pending={pending}
				{...blocked ? {lock: blocked} : {}}
				onPress={(): void => {
					open(DESCRIPTION_MENU, makeFromClientPacket(GuildDescriptionReq, {description: checked.value})).catch(console.error);
				}}
				testID="guild-description-save"
			/>
		</FormBlock>
	</>;
}

/** Leaving has a page of its own, so the warning is read before the confirmation. */
export function GuildDeparture({guild}: {guild: GuildData}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	return <>
		<Note>{i18n.t(guild.members.length === 1 ? "app:guild.dissolveWarning" : "app:guild.leaveWarning", {name: guild.name})}</Note>
		{message ? <Refusal>{message}</Refusal> : null}
		<ButtonRow><Button variant="danger" icon={LogOut} disabled={pending} onPress={(): Promise<void> => open(LEAVE_MENU)}>{i18n.t("app:guild.leave")}</Button></ButtonRow>
	</>;
}

/** The chief finds the way out inside the domain rather than beside everyday pages. */
export function GuildDepartureLink(): ReactNode {
	const router = useRouter();
	return <>
		<SectionHeader>{i18n.t("app:guild.membership")}</SectionHeader>
		<ButtonRow><Button icon={LogOut} onPress={(): void => router.push("/guild/leave")}>{i18n.t("app:guild.leave")}</Button></ButtonRow>
	</>;
}

/** The chief's levers, found inside the domain since only the chief enters it. */
export function GuildManagement({guild}: {guild: GuildData}): ReactNode {
	const self = guild.members.find(entry => entry.isSelf);
	const lock = self && memberRole(self, guild) !== "member" ? undefined : {reason: i18n.t("app:guild.forbidden")};
	return <>
		<GuildDescriptionForm guild={guild} {...lock ? {lock} : {}} />
		<GuildInvitation {...lock ? {lock} : {}} />
		{lock ? null : <RecruitmentSettings />}
	</>;
}

function guildFigures(guild: GuildData, membership?: GuildMembership): Figure[] {
	const rank = guild.rank.rank < 0
		? i18n.t("app:profile.values.unranked")
		: i18n.t("app:profile.formats.progress", {value: guild.rank.rank, max: guild.rank.numberOfGuilds});
	return [
		{caption: i18n.t("app:profile.fields.score"), value: formatNumber(guild.rank.score), unit: "guildPoint"},
		...membership ? [{caption: i18n.t("app:city.summary.treasury"), value: formatNumber(membership.treasury), unit: "money"}] : [],
		{caption: i18n.t("app:profile.fields.rank"), value: rank}
	];
}

function GuildStanding({guild, membership}: {guild: GuildData; membership?: GuildMembership}): ReactNode {
	const colors = useColors();
	const icon = AppIcons.getIconOrNull("guild.icon");
	return <Standing
		testID="guild-standing"
		emblem={icon ? <TwemojiIcon emoji={icon} size={40} /> : null}
		caption={i18n.t("app:guild.eyebrow")}
		title={guild.name}
		subtitle={i18n.t(guild.isMaxLevel ? "app:guild.maxLevel" : "app:guild.level", {level: guild.level})}
	>
		<FightGauge
			label={i18n.t("app:profile.fields.experience")}
			value={guild.experience.value}
			{...guild.isMaxLevel ? {} : {max: guild.experience.max}}
			color={colors.gold}
			icon={Star}
		/>
		<Figures items={guildFigures(guild, membership)} />
	</Standing>;
}

/** Why the shared reward cannot be claimed, in the order Core enforces it. */
function dailyLock(membership: GuildMembership): Lock | undefined {
	if (membership.daily.blockedByIsland) return {reason: i18n.t("app:guild.dailyLocks.island")};
	const remaining = membership.daily.availableAt - Date.now();
	if (remaining <= 0) return undefined;
	return {reason: i18n.t("app:guild.dailyLocks.cooldown", {duration: formatDurationMinutes(remaining / MILLISECONDS_PER_MINUTE)}), icon: Clock3};
}

type GuildLinksProps = {isChief: boolean; onPage: (page: GuildPage) => void};

/** The domain is the chief's alone; the chief leaves from there, everyone else from here. */
function GuildLinks({isChief, onPage}: GuildLinksProps): ReactNode {
	const styles = useStyles();
	return <View style={styles.links}>
		<QuickActions>
			{GUILD_PAGES.filter(page => page === "domain" ? isChief : page !== "leave" || !isChief).map(page => <QuickAction
				key={page}
				icon={AppIcons.getIcon(PAGE_ICONS[page])}
				onPress={(): void => onPage(page)}
			>{i18n.t(`app:guild.pages.${page}`)}</QuickAction>)}
		</QuickActions>
	</View>;
}

function GuildMemberTools({guild, membership, onPage}: {guild: GuildData; membership: GuildMembership; onPage: (page: GuildPage) => void}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const isChief = guild.members.some(member => member.isSelf && member.id === guild.chiefId);
	const daily = dailyLock(membership);
	return <>
		{message ? <Refusal>{message}</Refusal> : null}
		<ActionBanner
			icon={Gift}
			label={i18n.t("app:guild.daily")}
			pending={pending}
			{...daily ? {lock: daily} : {}}
			onPress={(): void => {
				open(DAILY_MENU).catch(console.error);
			}}
			testID="guild-daily-lock"
		/>
		<GuildLinks isChief={isChief} onPage={onPage} />
	</>;
}

export function GuildOverview({guild, onPage}: {guild: GuildData; onPage?: (page: GuildPage) => void}): ReactNode {
	return <>
		<GuildStanding guild={guild} {...guild.membership ? {membership: guild.membership} : {}} />
		{guild.description ? <Note>{guild.description}</Note> : null}
		{guild.recruitment ? <GuildJoinOffer guild={guild.recruitment} /> : null}
		{guild.membership && onPage ? <GuildMemberTools guild={guild} membership={guild.membership} onPage={onPage} /> : null}
		<SectionHeader action={{hint: formatNumber(guild.members.length)}}>{i18n.t("app:guild.members")}</SectionHeader>
		{guild.members.length ? <GuildMemberList guild={guild} /> : <ExpandableList><EmptyState>{i18n.t("app:guild.noMembers")}</EmptyState></ExpandableList>}
	</>;
}
