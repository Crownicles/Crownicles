import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildInviteReq, GuildInvitePlayerReq, GuildKickReq, GuildPromoteReq, GuildDemoteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {JoinBoatReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerUtilityRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {GuildData, GuildMember} from "ws-packets/src/objects/Guild";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {useOwnGuild} from "@/src/store/useGuild";
import {gameRules} from "@/src/rules/GameRules";
import {Button, ButtonRow, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Lock, Refusal} from "@/src/design/Sections";
import {UserPlus, Waves} from "@/src/design/FightIcons";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {guildPacketRefusal} from "@/src/collectors/GuildOutcome";
import {utilityPacketRefusal} from "@/src/collectors/PlayerUtilityCollector";
import {i18n} from "@/src/translations/i18n";

const MEMBER_MENUS = {
	INVITE: {request: GuildInviteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal},
	KICK: {request: GuildKickReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal},
	PROMOTE: {request: GuildPromoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal},
	DEMOTE: {request: GuildDemoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes], refusal: guildPacketRefusal},
	BOAT: {request: JoinBoatReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes], refusal: utilityPacketRefusal}
} satisfies Record<string, CommandMenu>;

/** The crossing is offered where the player sees someone already sailing, rather than in a menu of its own. */
export function GuildBoatBoarding({member}: {member: GuildMember}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	if (!member.islandStatus.isOnBoat || member.isSelf) return null;
	const lock: Lock | undefined = member.islandStatus.cannotBeJoinedOnBoat ? {reason: i18n.t("app:guild.boatLock")} : undefined;
	return <>
		{message ? <Refusal>{message}</Refusal> : null}
		<ActionBanner
			icon={Waves}
			label={i18n.t("app:utilities.boat")}
			pending={pending}
			{...lock ? {lock} : {}}
			onPress={(): void => {
				open(MEMBER_MENUS.BOAT).catch(console.error);
			}}
			testID={`guild-boat-${member.id}`}
		/>
	</>;
}

export function GuildInvitation({lock}: {lock?: Lock}): ReactNode {
	const [rank, setRank] = useState("");
	const {pending, message, open, clearMessage} = useCommandMenus();
	const rankValue = Number(rank);
	const missingRank = !Number.isSafeInteger(rankValue) || rankValue <= 0;
	const blocked = lock ?? (missingRank ? {reason: i18n.t("app:guild.inviteRankMissing")} : undefined);
	return <>
		<SectionHeader>{i18n.t("app:guild.invite")}</SectionHeader>
		<FormBlock>
			<TextField label={i18n.t("app:guild.inviteRank")} value={rank} onChangeText={(value): void => {
				setRank(value);
				clearMessage();
			}} keyboardType="number-pad" editable={!pending && !lock} refusal={message} />
			<Note>{i18n.t("app:guild.inviteHint")}</Note>
			<ActionBanner
				icon={UserPlus}
				label={i18n.t("app:guild.sendInvitation")}
				pending={pending}
				{...blocked ? {lock: blocked} : {}}
				onPress={(): void => {
					open(MEMBER_MENUS.INVITE, makeFromClientPacket(GuildInviteReq, {rank: rankValue})).catch(console.error);
				}}
				testID="guild-invite"
			/>
		</FormBlock>
	</>;
}

function playerIsChief(guild: GuildData): boolean {
	return guild.members.some(entry => entry.isSelf && entry.id === guild.chiefId);
}

/** A chief with room left may invite; anyone else, or a full guild, has nothing to offer. */
function canInviteInto(guild: GuildData | undefined): guild is GuildData {
	if (!guild || !playerIsChief(guild)) return false;
	return guild.members.length < gameRules().guild.maxMembers;
}

/** A chief with room left invites, straight from their profile, a player met in a ranking. */
export function GuildInvitePlayer({playerRef, profile}: {playerRef: string; profile: ProfileRes}): ReactNode {
	const state = useOwnGuild();
	const {pending, message, open} = useCommandMenus();
	const guild = state.status === "ready" ? state.data.data : undefined;
	if (!canInviteInto(guild)) return null;
	const lock: Lock | undefined = profile.guild ? {reason: i18n.t("app:guild.memberErrors.alreadyMember")} : undefined;
	return <>
		{message ? <Refusal>{message}</Refusal> : null}
		<ActionBanner
			icon={UserPlus}
			label={i18n.t("app:guild.inviteInto", {guild: guild.name})}
			pending={pending}
			{...lock ? {lock} : {}}
			onPress={(): void => {
				open(MEMBER_MENUS.INVITE, makeFromClientPacket(GuildInvitePlayerReq, {playerRef})).catch(console.error);
			}}
			testID="profile-guild-invite"
		/>
	</>;
}

/** The chief's levers on one member, shown inside that member's own row rather than behind a separate screen. */
export function GuildMemberControls({member, guild}: {member: GuildMember; guild: GuildData}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const isElder = member.id === guild.elderId;
	if (member.isSelf || !playerIsChief(guild)) return null;
	return <>
		{message ? <Refusal>{message}</Refusal> : null}
		<ButtonRow>
			<Button disabled={pending} onPress={(): Promise<void> => isElder
				? open(MEMBER_MENUS.DEMOTE)
				: open(MEMBER_MENUS.PROMOTE, makeFromClientPacket(GuildPromoteReq, {rank: member.rank}))}
			>{i18n.t(isElder ? "app:guild.memberControls.demote" : "app:guild.memberControls.promote")}</Button>
			<Button variant="danger" disabled={pending} onPress={(): Promise<void> => open(MEMBER_MENUS.KICK, makeFromClientPacket(GuildKickReq, {rank: member.rank}))}>{i18n.t("app:guild.memberControls.kick")}</Button>
		</ButtonRow>
	</>;
}