import {ReactNode, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildCreateReq, GuildDailyReq, GuildStorageReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildDescriptionReq, GuildLeaveReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {GuildCommandRes, GuildStorageRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildData, GuildMember, GuildMembership} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCommandMenus, CommandMenu} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {FightGauge} from "@/src/components/FightGauge";
import {GuildBoatBoarding, GuildInvitation, GuildMemberControls} from "@/src/components/GuildMembers";
import {UnitIcon} from "@/src/components/UnitIcon";
import {Button, ButtonRow, EmptyState, Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Figure, Figures, Lock, LockHint, sectionStyles, Standing} from "@/src/design/Sections";
import {TextField} from "@/src/design/Inputs";
import {Check, Clock3, Gift, LogOut, Star} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

export type GuildPage = "storage" | "shelter" | "manage" | "domain";
const CREATE_MENU: CommandMenu = {request: GuildCreateReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};
const DAILY_MENU: CommandMenu = {request: GuildDailyReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};
const DESCRIPTION_MENU: CommandMenu = {request: GuildDescriptionReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};
const LEAVE_MENU: CommandMenu = {request: GuildLeaveReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};

/** Only the whereabouts another member can act upon are worth a word; the rest is noise. */
const TRAVEL_STATUSES = ["isOnPveIsland", "isOnBoat"] as const;
const GUILD_PAGES = ["storage", "shelter", "domain", "manage"] as const;
const PAGE_ICONS = {storage: "foods.commonFood", shelter: "other.pet", domain: "city.guildDomain.menu", manage: "guild.chief"} as const;
const MILLISECONDS_PER_MINUTE = 60_000;

const styles = StyleSheet.create({
	links: {marginTop: Theme.spacing.xxl},
	self: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.green},
	score: {alignItems: "flex-end", gap: 3, flexShrink: 0}
});

/** The gauge takes an emoji only when the asset pack ships one, so an unknown path leaves it bare. */
export function gaugeEmoji(path: string): {emoji?: string} {
	const icon = AppIcons.getIconOrNull(path);
	return icon ? {emoji: icon} : {};
}

export function GuildCreation(): ReactNode {
	const [name, setName] = useState("");
	const {pending, message, open} = useCommandMenus();
	return <>
		<TextField label={i18n.t("app:guild.name")} value={name} onChangeText={setName} editable={!pending} />
		{message ? <Note>{message}</Note> : null}
		<ButtonRow><Button variant="primary" disabled={pending || name.length === 0} onPress={(): Promise<void> => open(CREATE_MENU, makeFromClientPacket(GuildCreateReq, {askedGuildName: name}))}>{i18n.t("app:guild.create")}</Button></ButtonRow>
	</>;
}

export function GuildStorage(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.GUILD_STORAGE, () => GameClient.request(makeFromClientPacket(GuildStorageReq, {}), GuildStorageRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD_STORAGE}>{data => <>
		<SectionHeader first>{data.guildName}</SectionHeader>
		{data.foods.map(food => <View key={food.id} style={sectionStyles.gauge}>
			<FightGauge
				label={i18n.t(`models:foods.${food.id}`, {count: food.amount, context: "capitalized"})}
				value={food.amount}
				max={food.maxAmount}
				color={Theme.colors.gold}
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
	return [i18n.t(`app:guild.roles.${role}`), ...travels].join(" · ");
}

function MemberEmblem({role, size = 26}: {role: MemberRole; size?: number}): ReactNode {
	const icon = AppIcons.getIconOrNull(`guild.${role}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : null;
}

function MemberScore({member}: {member: GuildMember}): ReactNode {
	return <View style={styles.score}>
		<View style={sectionStyles.value}>
			<Text style={sectionStyles.amount} numberOfLines={1}>{formatNumber(member.score)}</Text>
			<UnitIcon unit="score" size={12} />
		</View>
		{member.isSelf ? <Text style={styles.self}>{i18n.t("app:guild.you")}</Text> : null}
	</View>;
}

type MemberEntryProps = {member: GuildMember; guild: GuildData; expanded: boolean; onToggle: (id: number) => void};

function MemberEntry({member, guild, expanded, onToggle}: MemberEntryProps): ReactNode {
	const role = memberRole(member, guild);
	return <ExpandableEntry
		emblem={<MemberEmblem role={role} />}
		label={member.name ?? i18n.t("app:profile.values.unknown")}
		caption={memberCaption(member, role)}
		end={<MemberScore member={member} />}
		expanded={expanded}
		highlighted={member.isSelf}
		onToggle={(): void => onToggle(member.id)}
		testID={`guild-member-${member.id}`}
	>
		<Text style={sectionStyles.caption}>{i18n.t("app:guild.memberRank", {rank: formatNumber(member.rank)})}</Text>
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
	const {pending, message, open} = useCommandMenus();
	const unchanged = description === (guild.description ?? "");
	const blocked = lock ?? (unchanged ? {reason: i18n.t("app:guild.descriptionUnchanged")} : undefined);
	return <>
		<SectionHeader first>{i18n.t("app:guild.identity")}</SectionHeader>
		<TextField label={i18n.t("app:guild.description")} value={description} onChangeText={setDescription} multiline editable={!pending && !lock} />
		{message ? <Note>{message}</Note> : null}
		<ActionBanner
			icon={Check}
			label={i18n.t("app:pet.care.save")}
			pending={pending}
			{...blocked ? {lock: blocked} : {}}
			onPress={(): void => {
				open(DESCRIPTION_MENU, makeFromClientPacket(GuildDescriptionReq, {description})).catch(console.error);
			}}
			testID="guild-description-save"
		/>
	</>;
}

function GuildDeparture({guild}: {guild: GuildData}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const dissolves = guild.members.length === 1;
	return <>
		<SectionHeader>{i18n.t("app:guild.membership")}</SectionHeader>
		<Note>{i18n.t(dissolves ? "app:guild.dissolveWarning" : "app:guild.leaveWarning", {name: guild.name})}</Note>
		{message ? <Note>{message}</Note> : null}
		<ButtonRow><Button variant="danger" icon={LogOut} disabled={pending} onPress={(): Promise<void> => open(LEAVE_MENU)}>{i18n.t("app:guild.leave")}</Button></ButtonRow>
	</>;
}

export function GuildManagement({guild}: {guild: GuildData}): ReactNode {
	const self = guild.members.find(entry => entry.isSelf);
	const role = self ? memberRole(self, guild) : "member";
	const lock = role === "member" ? {reason: i18n.t("app:guild.forbidden")} : undefined;
	return <>
		<Standing
			emblem={<MemberEmblem role={role} size={40} />}
			caption={i18n.t("app:guild.pages.manage")}
			title={guild.name}
			subtitle={i18n.t("app:guild.yourRole", {role: i18n.t(`app:guild.roles.${role}`)})}
			testID="guild-management-standing"
		/>
		<GuildDescriptionForm guild={guild} {...lock ? {lock} : {}} />
		<GuildInvitation {...lock ? {lock} : {}} />
		<GuildDeparture guild={guild} />
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
			color={Theme.colors.gold}
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

/** Why the domain cannot be entered, in the order Core enforces: it must exist, you must lead, you must stand there. */
function domainLock(membership: GuildMembership, isChief: boolean): Lock | undefined {
	const domain = membership.domain;
	if (!domain.established) return {reason: i18n.t("app:guild.domainLocks.none")};
	if (!isChief) return {reason: i18n.t("app:guild.domainLocks.chiefOnly")};
	if (domain.isInCity) return undefined;
	return {reason: domain.mapLocationId === undefined
		? i18n.t("app:guild.domainLocks.awayUnknown")
		: i18n.t("app:guild.domainLocks.away", {city: i18n.t(`models:map_locations.${domain.mapLocationId}.name`)})};
}

function GuildLinks({lock, onPage}: {lock?: Lock; onPage: (page: GuildPage) => void}): ReactNode {
	return <View style={styles.links}>
		<QuickActions>
			{GUILD_PAGES.map(page => <QuickAction
				key={page}
				icon={AppIcons.getIcon(PAGE_ICONS[page])}
				disabled={page === "domain" && lock !== undefined}
				onPress={(): void => onPage(page)}
			>{i18n.t(`app:guild.pages.${page}`)}</QuickAction>)}
		</QuickActions>
		{lock ? <LockHint lock={lock} testID="guild-domain-lock" /> : null}
	</View>;
}

function GuildMemberTools({guild, membership, onPage}: {guild: GuildData; membership: GuildMembership; onPage: (page: GuildPage) => void}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const isChief = guild.members.some(member => member.isSelf && member.id === guild.chiefId);
	const daily = dailyLock(membership);
	const domain = domainLock(membership, isChief);
	return <>
		{message ? <Note>{message}</Note> : null}
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
		<GuildLinks {...domain ? {lock: domain} : {}} onPage={onPage} />
	</>;
}

export function GuildOverview({guild, onPage}: {guild: GuildData; onPage: (page: GuildPage) => void}): ReactNode {
	return <>
		<GuildStanding guild={guild} {...guild.membership ? {membership: guild.membership} : {}} />
		{guild.description ? <Note>{guild.description}</Note> : null}
		{guild.membership ? <GuildMemberTools guild={guild} membership={guild.membership} onPage={onPage} /> : null}
		<SectionHeader action={{hint: formatNumber(guild.members.length)}}>{i18n.t("app:guild.members")}</SectionHeader>
		{guild.members.length ? <GuildMemberList guild={guild} /> : <ExpandableList><EmptyState>{i18n.t("app:guild.noMembers")}</EmptyState></ExpandableList>}
	</>;
}
