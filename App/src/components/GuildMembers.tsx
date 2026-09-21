import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildInviteReq, GuildKickReq, GuildPromoteReq, GuildDemoteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {JoinBoatReq} from "ws-packets/src/fromClient/PlayerUtilityReq";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerUtilityRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildData, GuildMember} from "ws-packets/src/objects/Guild";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Button, ButtonRow, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Lock} from "@/src/design/Sections";
import {UserPlus, Waves} from "@/src/design/FightIcons";
import {TextField} from "@/src/design/Inputs";
import {i18n} from "@/src/translations/i18n";

const MEMBER_MENUS = {
	INVITE: {request: GuildInviteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	KICK: {request: GuildKickReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	PROMOTE: {request: GuildPromoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	DEMOTE: {request: GuildDemoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	BOAT: {request: JoinBoatReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [PlayerUtilityRes]}
} satisfies Record<string, CommandMenu>;

/** The crossing is offered where the player sees someone already sailing, rather than in a menu of its own. */
export function GuildBoatBoarding({member}: {member: GuildMember}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	if (!member.islandStatus.isOnBoat || member.isSelf) return null;
	const lock: Lock | undefined = member.islandStatus.cannotBeJoinedOnBoat ? {reason: i18n.t("app:guild.boatLock")} : undefined;
	return <>
		{message ? <Note>{message}</Note> : null}
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
	const {pending, message, open} = useCommandMenus();
	const rankValue = Number(rank);
	const missingRank = !Number.isSafeInteger(rankValue) || rankValue <= 0;
	const blocked = lock ?? (missingRank ? {reason: i18n.t("app:guild.inviteRankMissing")} : undefined);
	return <>
		<SectionHeader>{i18n.t("app:guild.invite")}</SectionHeader>
		<TextField label={i18n.t("app:guild.inviteRank")} value={rank} onChangeText={setRank} keyboardType="number-pad" editable={!pending && !lock} />
		<Note>{i18n.t("app:guild.inviteHint")}</Note>
		{message ? <Note>{message}</Note> : null}
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
	</>;
}

/** The chief's levers on one member, shown inside that member's own row rather than behind a separate screen. */
export function GuildMemberControls({member, guild}: {member: GuildMember; guild: GuildData}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const self = guild.members.find(entry => entry.isSelf);
	const isElder = member.id === guild.elderId;
	if (!self || self.id !== guild.chiefId || member.isSelf) return null;
	return <>
		{message ? <Note>{message}</Note> : null}
		<ButtonRow>
			<Button disabled={pending} onPress={(): Promise<void> => isElder
				? open(MEMBER_MENUS.DEMOTE)
				: open(MEMBER_MENUS.PROMOTE, makeFromClientPacket(GuildPromoteReq, {rank: member.rank}))}
			>{i18n.t(isElder ? "app:guild.memberControls.demote" : "app:guild.memberControls.promote")}</Button>
			<Button variant="danger" disabled={pending} onPress={(): Promise<void> => open(MEMBER_MENUS.KICK, makeFromClientPacket(GuildKickReq, {rank: member.rank}))}>{i18n.t("app:guild.memberControls.kick")}</Button>
		</ButtonRow>
	</>;
}