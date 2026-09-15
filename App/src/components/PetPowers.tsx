import {ReactNode, useDeferredValue, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetPowersReq} from "ws-packets/src/fromClient/PetReq";
import {PetPowersRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetPower} from "ws-packets/src/objects/PetPower";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Note, Panel, Row} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function PetPowersContent({powers}: {powers: PetPower[]}): ReactNode {
	const [search, setSearch] = useState("");
	const query = useDeferredValue(search).trim().toLocaleLowerCase();
	const entries = powers.map(power => ({...power, name: i18n.t(`models:pets.${power.petTypeId}`, {context: "male"})}));
	const visible = entries.filter(power => power.name.toLocaleLowerCase().includes(query)).sort((first, second) => first.name.localeCompare(second.name));
	return <>
		<TextField label={i18n.t("app:pet.powers.search")} value={search} onChangeText={setSearch} />
		<Note>{i18n.t("app:pet.powers.expedition")}</Note>
		{visible.length === 0 ? <Note>{i18n.t("app:reference.empty")}</Note> : <Panel>{visible.map(power => <Row key={power.petTypeId}
			icon={<TwemojiIcon emoji={AppIcons.getIcon(`pets.${power.petTypeId}.emoteMale`)} size={Theme.dimensions.headerIcon} />}
			title={power.name}
			subtitle={i18n.t(`app:pet.powers.effects.${power.assistanceId}`, {defaultValue: i18n.t("app:pet.powers.unknown")})}
			end={i18n.t(`items:rarities.${power.rarity}`)}
		/>)}</Panel>}
	</>;
}

export function PetPowers(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.PET_POWERS, () => GameClient.request(makeFromClientPacket(PetPowersReq, {}), PetPowersRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PET_POWERS}>{data => <PetPowersContent powers={data.powers} />}</GameQueryContent>;
}