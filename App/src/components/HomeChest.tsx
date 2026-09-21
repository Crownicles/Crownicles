import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {HomeChestInfoReq, HomeChestActionReq, HomePlantTransferReq} from "ws-packets/src/fromClient/HomeReq";
import {HomeChestRes} from "ws-packets/src/fromServer/home/HomeRes";
import {CHEST_ACTIONS, PLANT_TRANSFER_ACTIONS, HomeChestData, HomeItemSlot, PlayerPlantSlot} from "ws-packets/src/objects/HomeChest";
import {PlantId} from "ws-packets/src/objects/PlantId";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {HomeMutation, useHomeActions} from "@/src/store/useHomeActions";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {InventoryItemRow, inventoryItemDetails, inventoryItemEmblem} from "@/src/components/InventoryItemRow";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {ActionBanner, ExpandableEntry, ExpandableList, Fact, sectionStyles} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {plantName} from "@/src/display/Resources";
import {i18n} from "@/src/translations/i18n";

const CHEST_VIEWS = ["equipment", "plants"] as const;
type ChestView = typeof CHEST_VIEWS[number];
type ChestSource = "chest" | "inventory";
type ChestActions = {pending: boolean; submit: (action: HomeMutation) => Promise<void>};
type CarriedPlant = PlayerPlantSlot & {plantId: PlantId};

/** An item names its own transfers: a window over the chest would hide what is being moved. */
function ChestItem({item, source, data, location, actions, expanded, onToggle}: {
	item: HomeItemSlot;
	source: ChestSource;
	data: HomeChestData;
	location: string;
	actions: ChestActions;
	expanded: boolean;
	onToggle: () => void;
}): ReactNode {
	const action = source === "chest" ? CHEST_ACTIONS.WITHDRAW : CHEST_ACTIONS.DEPOSIT;
	const swappable = (source === "chest" ? data.depositableItems : data.chestItems).filter(other => other.category === item.category);
	const submit = (request: HomeChestActionReq): void => {
		onToggle();
		actions.submit({kind: "item", request}).catch(console.error);
	};
	return <ExpandableEntry
		emblem={inventoryItemEmblem(item.details)}
		label={itemDisplayName(item.details)}
		caption={inventoryItemDetails(item.details)}
		end={<Text style={sectionStyles.caption}>{location}</Text>}
		dimmed={actions.pending}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ActionBanner
			icon={Check}
			label={i18n.t(`app:homeChest.actions.${action}`)}
			pending={actions.pending}
			onPress={(): void => submit(makeFromClientPacket(HomeChestActionReq, {action, slot: item.slot, itemCategory: item.category, chestSlot: -1}))}
		/>
		{swappable.length ? <>
			<SectionHeader>{i18n.t("app:homeChest.swapWith")}</SectionHeader>
			{swappable.map(other => <InventoryItemRow
				key={other.slot}
				item={other.details}
				location={i18n.t("app:homeChest.actions.swap")}
				disabled={actions.pending}
				onPress={(): void => submit(makeFromClientPacket(HomeChestActionReq, {
					action: CHEST_ACTIONS.SWAP, itemCategory: item.category,
					slot: source === "chest" ? other.slot : item.slot,
					chestSlot: source === "chest" ? item.slot : other.slot
				}))}
			/>)}
		</> : null}
	</ExpandableEntry>;
}

function ChestEquipment({data, actions}: {data: HomeChestData; actions: ChestActions}): ReactNode {
	const [openKey, setOpenKey] = useState<string>();
	const entry = (item: HomeItemSlot, source: ChestSource, location: string): ReactNode => {
		const key = `${source}-${item.category}-${item.slot}`;
		return <ChestItem
			key={key}
			item={item}
			source={source}
			data={data}
			location={location}
			actions={actions}
			expanded={openKey === key}
			onToggle={(): void => setOpenKey(openKey === key ? undefined : key)}
		/>;
	};
	return <>
		<SectionHeader>{i18n.t("app:homeChest.chest")}</SectionHeader>
		<ExpandableList>{data.chestItems.length
			? data.chestItems.map(item => entry(item, "chest", i18n.t("app:homeChest.slot", {slot: item.slot})))
			: <Note>{i18n.t("app:homeChest.emptyChest")}</Note>}</ExpandableList>
		<SectionHeader>{i18n.t("app:homeChest.inventory")}</SectionHeader>
		<ExpandableList>{data.depositableItems.length
			? data.depositableItems.map(item => entry(item, "inventory", i18n.t(item.slot === 0 ? "app:equipment.equipped" : "app:equipment.slot", {slot: item.slot})))
			: <Note>{i18n.t("app:homeChest.emptyInventory")}</Note>}</ExpandableList>
		<SectionHeader>{i18n.t("app:homeChest.capacity")}</SectionHeader>
		<ExpandableList>{Object.entries(data.slotsPerCategory).map(([category, capacity]) => <Fact key={category} label={i18n.t(`items:${category}`, {count: capacity})} value={i18n.t("app:homeChest.capacities", {chest: capacity, inventory: data.inventoryCapacity[category as keyof HomeChestData["inventoryCapacity"]]})} />)}</ExpandableList>
	</>;
}

function PlantTransfer({plantId, caption, location, request, actions, expanded, onToggle}: {
	plantId: PlantId;
	caption: string;
	location: string;
	request: HomePlantTransferReq;
	actions: ChestActions;
	expanded: boolean;
	onToggle: () => void;
}): ReactNode {
	return <ExpandableEntry
		label={plantName(plantId)}
		caption={caption}
		end={<Text style={sectionStyles.caption}>{location}</Text>}
		dimmed={actions.pending}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ActionBanner
			icon={Check}
			label={location}
			pending={actions.pending}
			onPress={(): void => {
				onToggle();
				actions.submit({kind: "plant", request}).catch(console.error);
			}}
		/>
	</ExpandableEntry>;
}

function ChestPlants({data, actions}: {data: HomeChestData; actions: ChestActions}): ReactNode {
	const [openKey, setOpenKey] = useState<string>();
	const carried = data.playerPlantSlots?.filter((plant): plant is CarriedPlant => plant.plantId !== 0) ?? [];
	const stored = data.plantStorage ?? [];
	const toggle = (key: string) => (): void => setOpenKey(openKey === key ? undefined : key);
	return <>
		<SectionHeader>{i18n.t("app:homeChest.chest")}</SectionHeader>
		<ExpandableList>{stored.length ? stored.map(plant => <PlantTransfer
			key={`stored-${plant.plantId}`}
			plantId={plant.plantId}
			caption={i18n.t("app:equipment.capacity", {count: plant.quantity, max: plant.maxCapacity})}
			location={i18n.t("app:homeChest.actions.plantWithdraw")}
			request={makeFromClientPacket(HomePlantTransferReq, {action: PLANT_TRANSFER_ACTIONS.WITHDRAW, plantId: plant.plantId, playerSlot: 0})}
			actions={actions}
			expanded={openKey === `stored-${plant.plantId}`}
			onToggle={toggle(`stored-${plant.plantId}`)}
		/>) : <Note>{i18n.t("app:homeChest.noStoredPlants")}</Note>}</ExpandableList>
		<SectionHeader>{i18n.t("app:homeChest.inventory")}</SectionHeader>
		<ExpandableList>{carried.length ? carried.map(plant => <PlantTransfer
			key={`carried-${plant.slot}`}
			plantId={plant.plantId}
			caption={i18n.t("app:inventory.plantSlot", {slot: plant.slot})}
			location={i18n.t("app:homeChest.actions.plantDeposit")}
			request={makeFromClientPacket(HomePlantTransferReq, {action: PLANT_TRANSFER_ACTIONS.DEPOSIT, plantId: 0, playerSlot: plant.slot})}
			actions={actions}
			expanded={openKey === `carried-${plant.slot}`}
			onToggle={toggle(`carried-${plant.slot}`)}
		/>) : <Note>{i18n.t("app:inventory.noPlants")}</Note>}</ExpandableList>
		{data.plantMaxCapacity === undefined ? null : <Note>{i18n.t("app:homeChest.plantCapacity", {count: data.plantMaxCapacity})}</Note>}
	</>;
}

function ChestContent({data}: {data: HomeChestData}): ReactNode {
	const [view, setView] = useState<ChestView>("equipment");
	const {pending, message, submit} = useHomeActions();
	return <>
		<SegmentedControl options={CHEST_VIEWS.map(value => ({value, label: i18n.t(`app:homeChest.views.${value}`)}))} value={view} onChange={setView} label={i18n.t("app:homeChest.title")} />
		{message ? <Note>{message}</Note> : null}
		{view === "equipment" ? <ChestEquipment data={data} actions={{pending, submit}} /> : <ChestPlants data={data} actions={{pending, submit}} />}
	</>;
}

export function HomeChest(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.HOME_CHEST, () => GameClient.request(makeFromClientPacket(HomeChestInfoReq, {}), HomeChestRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.HOME_CHEST}>{packet => packet.success ? <ChestContent data={packet.data} /> : <Note>{i18n.t("app:homeChest.unavailable")}</Note>}</GameQueryContent>;
}
