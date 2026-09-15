import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildInviteReq, GuildKickReq, GuildPromoteReq, GuildDemoteReq} from "ws-packets/src/fromClient/GuildManagementReq";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildData, GuildMember} from "ws-packets/src/objects/Guild";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {Button, ButtonRow, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {i18n} from "@/src/translations/i18n";

const MEMBER_MENUS = {
	INVITE: {request: GuildInviteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	KICK: {request: GuildKickReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	PROMOTE: {request: GuildPromoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]},
	DEMOTE: {request: GuildDemoteReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [GuildCommandRes]}
} satisfies Record<string, CommandMenu>;

function GuildInvitation(): ReactNode {
	const [rank, setRank] = useState("");
	const {pending, message, open} = useCommandMenus();
	const rankValue = Number(rank);
	return <>
		<SectionHeader>{i18n.t("app:guild.invite")}</SectionHeader>
		<TextField label={i18n.t("app:guild.inviteRank")} value={rank} onChangeText={setRank} keyboardType="number-pad" editable={!pending} />
		{message ? <Note>{message}</Note> : null}
		<ButtonRow><Button disabled={pending || !Number.isSafeInteger(rankValue) || rankValue <= 0} onPress={(): Promise<void> => open(MEMBER_MENUS.INVITE, makeFromClientPacket(GuildInviteReq, {rank: rankValue}))}>{i18n.t("app:guild.invite")}</Button></ButtonRow>
	</>;
}

function MemberActions({member, guild}: {member: GuildMember; guild: GuildData}): ReactNode {
	const {pending, message, open} = useCommandMenus();
	const isElder = member.id === guild.elderId;
	return <>
		<SectionHeader>{member.name ?? i18n.t("app:profile.values.unknown")}</SectionHeader>
		{message ? <Note>{message}</Note> : null}
		<Panel>
			<Row title={i18n.t(isElder ? "app:guild.memberControls.demote" : "app:guild.memberControls.promote")} disabled={pending}
				onPress={(): Promise<void> => isElder ? open(MEMBER_MENUS.DEMOTE) : open(MEMBER_MENUS.PROMOTE, makeFromClientPacket(GuildPromoteReq, {rank: member.rank}))} chevron />
			<Row title={i18n.t("app:guild.memberControls.kick")} disabled={pending} tone="danger" onPress={(): Promise<void> => open(MEMBER_MENUS.KICK, makeFromClientPacket(GuildKickReq, {rank: member.rank}))} chevron />
		</Panel>
	</>;
}

export function GuildMembers({guild}: {guild: GuildData}): ReactNode {
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const currentMember = guild.members.find(member => member.isSelf);
	const selected = guild.members.find(member => member.id === selectedId);
	if (!currentMember) return null;
	const isChief = currentMember.id === guild.chiefId;
	const canInvite = isChief || currentMember.id === guild.elderId;
	return <>
		{canInvite ? <GuildInvitation /> : null}
		{isChief ? <>
			<SectionHeader>{i18n.t("app:guild.members")}</SectionHeader>
			<Panel>{guild.members.filter(member => !member.isSelf).map(member => <Row key={member.id} title={member.name ?? i18n.t("app:profile.values.unknown")} onPress={(): void => setSelectedId(member.id)} chevron />)}</Panel>
			{selected ? <MemberActions key={selected.id} member={selected} guild={guild} /> : null}
		</> : null}
	</>;
}