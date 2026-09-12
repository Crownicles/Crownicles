import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildCreateReq, GuildDailyReq, GuildStorageReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildCommandRes, GuildStorageRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildData, GuildMember} from "ws-packets/src/objects/Guild";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCommandMenus, CommandMenu} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Hero, KeyValue, Note, Panel, QuickAction, QuickActions, Row, SectionHeader, StatBar} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

export type GuildPage = "overview" | "create" | "storage" | "shelter";
const CREATE_MENU: CommandMenu = {request: GuildCreateReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};
const DAILY_MENU: CommandMenu = {request: GuildDailyReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]};
const ISLAND_STATUSES = ["isOnPveIsland", "isOnBoat", "isPveIslandAlly", "cannotBeJoinedOnBoat"] as const;

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
		<Panel>{data.foods.map(food => <KeyValue key={food.id} label={i18n.t(`models:foods.${food.id}`, {count: food.amount, context: "capitalized"})} value={i18n.t("app:profile.formats.progress", {value: food.amount, max: food.maxAmount})} />)}</Panel>
	</>}</GameQueryContent>;
}

function memberSubtitle(member: GuildMember, guild: GuildData): string {
	const role = member.id === guild.chiefId ? "chief" : member.id === guild.elderId ? "elder" : "member";
	const locations = ISLAND_STATUSES.filter(key => member.islandStatus[key]).map(key => i18n.t(`app:guild.island.${key}`));
	return i18n.t("app:guild.memberDetails", {role: i18n.t(`app:guild.roles.${role}`), rank: member.rank, score: formatNumber(member.score), locations: locations.join(" · ")});
}

export function GuildOverview({guild, onPage}: {guild: GuildData; onPage: (page: GuildPage) => void}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const isMember = guild.members.some(member => member.isSelf);
	return <>
		<Hero eyebrow={i18n.t("app:guild.eyebrow")} title={guild.name} subtitle={i18n.t(guild.isMaxLevel ? "app:guild.maxLevel" : "app:guild.level", {level: guild.level})} />
		{guild.description ? <Note>{guild.description}</Note> : null}
		<Panel>
			<StatBar label={i18n.t("app:profile.fields.experience")} value={i18n.t("app:profile.formats.progress", {value: guild.experience.value, max: guild.experience.max})} ratio={guild.isMaxLevel ? 1 : guild.experience.value / guild.experience.max} color={Theme.colors.gold} />
			<KeyValue label={i18n.t("app:profile.fields.score")} value={formatNumber(guild.rank.score)} />
			<KeyValue label={i18n.t("app:profile.fields.rank")} value={guild.rank.rank < 0 ? i18n.t("app:profile.values.unranked") : i18n.t("app:profile.formats.progress", {value: guild.rank.rank, max: guild.rank.numberOfGuilds})} />
		</Panel>
		{isMember ? <QuickActions>
			<QuickAction icon={AppIcons.getIcon("unitValues.xp")} disabled={pending} onPress={(): Promise<void> => open(DAILY_MENU)}>{i18n.t("app:guild.daily")}</QuickAction>
			<QuickAction icon={AppIcons.getIcon("foods.commonFood")} onPress={(): void => onPage("storage")}>{i18n.t("app:guild.pages.storage")}</QuickAction>
			<QuickAction icon={AppIcons.getIcon("other.pet")} onPress={(): void => onPage("shelter")}>{i18n.t("app:guild.pages.shelter")}</QuickAction>
		</QuickActions> : null}
		{message ? <Note>{message}</Note> : null}
		<SectionHeader action={{hint: formatNumber(guild.members.length)}}>{i18n.t("app:guild.members")}</SectionHeader>
		<Panel>{guild.members.map(member => <Row key={member.id} title={member.name ?? i18n.t("app:profile.values.unknown")}
			subtitle={memberSubtitle(member, guild)} {...(member.isSelf ? {end: i18n.t("app:guild.you")} : {})}
		/>)}</Panel>
	</>;
}