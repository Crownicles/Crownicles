import {ReactNode, useState} from "react";
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
import {InventoryItemRow} from "@/src/components/InventoryItemRow";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const CHEST_VIEWS = ["equipment", "plants"] as const;
type ChestView = typeof CHEST_VIEWS[number];
type ChestSelection = {source: "chest" | "inventory"; item: HomeItemSlot};
type ChestActions = {pending: boolean; submit: (action: HomeMutation) => Promise<void>};
type SelectedPlant = {plantId: PlantId; request: HomePlantTransferReq};
type CarriedPlant = PlayerPlantSlot & {plantId: PlantId};

function ItemTransfer({selection, data, onClose, actions}: {selection: ChestSelection; data: HomeChestData; onClose: () => void; actions: ChestActions}): ReactNode {
	const {item, source} = selection;
	const action = source === "chest" ? CHEST_ACTIONS.WITHDRAW : CHEST_ACTIONS.DEPOSIT;
	const otherItems = source === "chest" ? data.depositableItems : data.chestItems;
	const submit = (request: HomeChestActionReq): void => {
		onClose();
		actions.submit({kind: "item", request}).catch(console.error);
	};
	const swap = (other: HomeItemSlot): void => submit(makeFromClientPacket(HomeChestActionReq, {
		action: CHEST_ACTIONS.SWAP, itemCategory: item.category,
		slot: source === "chest" ? other.slot : item.slot, chestSlot: source === "chest" ? item.slot : other.slot
	}));
	return <Confirmation title={i18n.t("app:homeChest.itemActions")} message={itemDisplayName(item.details)} onRequestClose={onClose}>
		<InventoryItemRow item={item.details} location={i18n.t(`app:homeChest.${source}`)} />
		<ButtonRow>
			<Button variant="primary" disabled={actions.pending} onPress={(): void => submit(makeFromClientPacket(HomeChestActionReq, {action, slot: item.slot, itemCategory: item.category, chestSlot: -1}))}>{i18n.t(`app:homeChest.actions.${action}`)}</Button>
			<Button onPress={onClose}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
		<SectionHeader>{i18n.t("app:homeChest.swapWith")}</SectionHeader>
		{otherItems.filter(other => other.category === item.category).map(other => <InventoryItemRow key={other.slot} item={other.details} location={i18n.t("app:homeChest.actions.swap")} onPress={(): void => swap(other)} disabled={actions.pending} />)}
	</Confirmation>;
}

function ChestEquipment({data, actions}: {data: HomeChestData; actions: ChestActions}): ReactNode {
	const [selection, setSelection] = useState<ChestSelection | null>(null);
	return <>
		<SectionHeader>{i18n.t("app:homeChest.chest")}</SectionHeader>
		<Panel>{data.chestItems.length ? data.chestItems.map(item => <InventoryItemRow key={`${item.category}-${item.slot}`} item={item.details} location={i18n.t("app:homeChest.slot", {slot: item.slot})} onPress={(): void => setSelection({source: "chest", item})} disabled={actions.pending} />) : <Note>{i18n.t("app:homeChest.emptyChest")}</Note>}</Panel>
		<SectionHeader>{i18n.t("app:homeChest.inventory")}</SectionHeader>
		<Panel>{data.depositableItems.length ? data.depositableItems.map(item => <InventoryItemRow key={`${item.category}-${item.slot}`} item={item.details} location={i18n.t(item.slot === 0 ? "app:equipment.equipped" : "app:equipment.slot", {slot: item.slot})} onPress={(): void => setSelection({source: "inventory", item})} disabled={actions.pending} />) : <Note>{i18n.t("app:homeChest.emptyInventory")}</Note>}</Panel>
		<SectionHeader>{i18n.t("app:homeChest.capacity")}</SectionHeader>
		<Panel>{Object.entries(data.slotsPerCategory).map(([category, capacity]) => <KeyValue key={category} label={i18n.t(`items:${category}`, {count: capacity})} value={i18n.t("app:homeChest.capacities", {chest: capacity, inventory: data.inventoryCapacity[category as keyof HomeChestData["inventoryCapacity"]]})} />)}</Panel>
		{selection ? <ItemTransfer selection={selection} data={data} actions={actions} onClose={(): void => setSelection(null)} /> : null}
	</>;
}

function ChestPlants({data, actions}: {data: HomeChestData; actions: ChestActions}): ReactNode {
	const [selection, setSelection] = useState<SelectedPlant | null>(null);
	const carried = data.playerPlantSlots?.filter((plant): plant is CarriedPlant => plant.plantId !== 0) ?? [];
	const stored = data.plantStorage ?? [];
	const confirm = (): void => {
		if (!selection) return;
		setSelection(null);
		actions.submit({kind: "plant", request: selection.request}).catch(console.error);
	};
	return <>
		<SectionHeader>{i18n.t("app:homeChest.chest")}</SectionHeader>
		<Panel>{stored.length ? stored.map(plant => <Row key={plant.plantId} title={`${AppIcons.getIcon(`plants.${plant.plantId}`)} ${i18n.t(`models:plants.${plant.plantId}`)}`} subtitle={i18n.t("app:equipment.capacity", {count: plant.quantity, max: plant.maxCapacity})} end={i18n.t("app:homeChest.actions.plantWithdraw")} disabled={actions.pending} onPress={(): void => setSelection({plantId: plant.plantId, request: makeFromClientPacket(HomePlantTransferReq, {action: PLANT_TRANSFER_ACTIONS.WITHDRAW, plantId: plant.plantId, playerSlot: 0})})} />) : <Note>{i18n.t("app:homeChest.noStoredPlants")}</Note>}</Panel>
		<SectionHeader>{i18n.t("app:homeChest.inventory")}</SectionHeader>
		<Panel>{carried.length ? carried.map(plant => <Row key={plant.slot} title={`${AppIcons.getIcon(`plants.${plant.plantId}`)} ${i18n.t(`models:plants.${plant.plantId}`)}`} subtitle={i18n.t("app:inventory.plantSlot", {slot: plant.slot})} end={i18n.t("app:homeChest.actions.plantDeposit")} disabled={actions.pending} onPress={(): void => setSelection({plantId: plant.plantId, request: makeFromClientPacket(HomePlantTransferReq, {action: PLANT_TRANSFER_ACTIONS.DEPOSIT, plantId: 0, playerSlot: plant.slot})})} />) : <Note>{i18n.t("app:inventory.noPlants")}</Note>}</Panel>
		{data.plantMaxCapacity === undefined ? null : <Note>{i18n.t("app:homeChest.plantCapacity", {count: data.plantMaxCapacity})}</Note>}
		{selection ? <Confirmation title={i18n.t(`app:homeChest.actions.${selection.request.action}`)} message={i18n.t(`models:plants.${selection.plantId}`)} onRequestClose={(): void => setSelection(null)}><ButtonRow><Button variant="primary" disabled={actions.pending} onPress={confirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation> : null}
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