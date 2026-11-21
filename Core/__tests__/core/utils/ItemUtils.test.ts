import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	generateRandomLootEnchantment, giveItemToPlayer, toItemWithDetails
} from '../../../src/core/utils/ItemUtils';
import InventorySlot, { InventorySlots } from '../../../src/core/database/game/models/InventorySlot';
import { InventoryInfos } from '../../../src/core/database/game/models/InventoryInfo';
import { MissionsController } from '../../../src/core/missions/MissionsController';
import { BlockingUtils } from '../../../src/core/utils/BlockingUtils';
import { crowniclesInstance } from '../../../src/app';
import { ItemCategory, ItemNature, ItemRarity } from '../../../../Lib/src/constants/ItemConstants';
import { BlockingConstants } from '../../../../Lib/src/constants/BlockingConstants';
import { CrowniclesPacket, PacketContext } from '../../../../Lib/src/packets/CrowniclesPacket';
import { ItemFoundPacket } from '../../../../Lib/src/packets/events/ItemFoundPacket';
import { ReactionCollectorInstance } from '../../../src/core/utils/ReactionsCollector';
import { RandomUtils } from '../../../../Lib/src/utils/RandomUtils';
import {
	ReactionCollectorItemChoiceDrinkPotionReaction,
	ReactionCollectorItemChoiceItemReaction,
	ReactionCollectorItemChoiceRefuseReaction
} from '../../../../Lib/src/packets/interaction/ReactionCollectorItemChoice';
import { ReactionCollectorItemAcceptDrinkPotionReaction } from '../../../../Lib/src/packets/interaction/ReactionCollectorItemAccept';
import {
	ReactionCollectorAcceptReaction, ReactionCollectorRefuseReaction
} from '../../../../Lib/src/packets/interaction/ReactionCollectorPacket';
import { NumberChangeReason } from '../../../../Lib/src/constants/LogsConstants';
import { EnchantmentConstants } from '../../../../Lib/src/constants/EnchantmentConstants';
import { Homes } from '../../../src/core/database/game/models/Home';
import { MainItem } from '../../../src/data/MainItem';
import { Potion } from '../../../src/data/Potion';

type CapturedCollector = {
	getFirstReaction: () => {
		reaction: {
			type: string;
			data?: unknown;
		};
	} | undefined;
};

let capturedCollectorCallback: ((collector: CapturedCollector, response: CrowniclesPacket[]) => Promise<void>) | undefined;
let capturedCollectorPacket: {
	data: {
		type: string;
		data: {
			itemWithDetails?: { usages?: number };
			item?: { id: number; category: ItemCategory };
		};
	};
	reactions: {
		type: string;
		data: {
			slot?: number;
			itemWithDetails?: { usages?: number };
		};
	}[];
} | undefined;
let capturedCollectorOptions: {
	allowedPlayerKeycloakIds: string[];
	reactionLimit: number;
	mainPacket: boolean;
} | undefined;
let capturedBlock: [string, string] | undefined;

/**
 * Whether the last created collector offers to drink the found potion
 */
function drinkReactionOffered(): boolean {
	return (capturedCollectorPacket?.reactions ?? []).some(reaction =>
		reaction.type === ReactionCollectorItemAcceptDrinkPotionReaction.name
		|| reaction.type === ReactionCollectorItemChoiceDrinkPotionReaction.name);
}

// Mock all external dependencies
vi.mock('../../../src/core/database/game/models/InventorySlot');
vi.mock('../../../src/core/database/game/models/InventoryInfo');
vi.mock('../../../src/core/database/game/models/Home', () => ({
	Home: class {},
	Homes: {
		getOfPlayer: vi.fn().mockResolvedValue(null)
	}
}));
vi.mock('../../../src/core/missions/MissionsController');
vi.mock('../../../src/core/utils/BlockingUtils');
vi.mock('../../../src/core/utils/ReactionsCollector', () => ({
	ReactionCollectorInstance: class {
		constructor(collector: any, context: any, options: any, callback: any) {
			capturedCollectorPacket = collector.creationPacket('test-collector', 0);
			capturedCollectorCallback = callback;
			capturedCollectorOptions = options;
		}
		block(keycloakId: string, reason: string) {
			capturedBlock = [keycloakId, reason];
			return this;
		}
		build() {
			return this;
		}
	}
}));
vi.mock('../../../../Lib/src/packets/CrowniclesPacket', () => ({
	CrowniclesPacket: class {},
	PacketContext: class {},
	PacketDirection: {
		NONE: 0,
		FRONT_TO_BACK: 1,
		BACK_TO_FRONT: 2
	},
	sendablePacket: vi.fn(() => () => {}),
	makePacket: vi.fn((PacketType, data) => ({ type: PacketType.name, data }))
}));
vi.mock('../../../src/app', () => ({
	crowniclesInstance: {
		logsDatabase: {
			logItemGain: vi.fn(),
			logItemSell: vi.fn()
		}
	}
}));
vi.mock('../../../src/data/Weapon', () => ({
	WeaponDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				getAttack: vi.fn().mockReturnValue(100),
				getDefense: vi.fn().mockReturnValue(50),
				getSpeed: vi.fn().mockReturnValue(75)
			})
		}
	}
}));
vi.mock('../../../src/data/Armor', () => ({
	ArmorDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				getAttack: vi.fn().mockReturnValue(80),
				getDefense: vi.fn().mockReturnValue(120),
				getSpeed: vi.fn().mockReturnValue(30)
			})
		}
	}
}));
vi.mock('../../../src/data/Potion', () => ({
	Potion: class {
		nature = 1;
		power = 50;
		isFightPotion() { return false; }
	},
	PotionDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				nature: 1,
				power: 50
			})
		}
	}
}));
vi.mock('../../../src/data/ObjectItem', () => ({
	ObjectItemDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				nature: 2,
				power: 25
			})
		}
	}
}));

describe('ItemUtils - giveItemToPlayer', () => {
	let mockPlayer: any;
	let mockItem: any;
	let mockInventorySlots: any[];
	let mockInventoryInfo: any;
	let mockResponse: CrowniclesPacket[];
	let mockContext: PacketContext;

	beforeEach(() => {
		// Clear all mocks
		vi.clearAllMocks();
		capturedCollectorCallback = undefined;
		capturedCollectorPacket = undefined;
		capturedCollectorOptions = undefined;
		capturedBlock = undefined;

		// Mock player
		mockPlayer = {
			id: 1,
			keycloakId: 'test-keycloak-id',
			giveItem: vi.fn(),
			addMoney: vi.fn(),
			save: vi.fn(),
			reload: vi.fn(),
			getMaxStatsValue: vi.fn().mockReturnValue(100)
		};

		// Mock basic item
		mockItem = {
			id: 100,
			rarity: ItemRarity.COMMON,
			getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
			getItemAddedValue: vi.fn().mockReturnValue(10),
			getDisplayPacket: vi.fn().mockReturnValue({
				id: 100,
				category: ItemCategory.WEAPON,
				rarity: ItemRarity.COMMON,
				detailsSupportItem: null,
				detailsMainItem: null,
				maxStats: null
			})
		};

		// Mock inventory slots
		mockInventorySlots = [
			{
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.WEAPON,
				itemId: 50,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(false),
				getItem: vi.fn().mockReturnValue({
					id: 50,
					rarity: ItemRarity.COMMON,
					getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
					getItemAddedValue: vi.fn().mockReturnValue(5),
					getDisplayPacket: vi.fn().mockReturnValue({ id: 50, name: 'Slot Item' })
				})
			}
		];

		// Mock inventory info
		mockInventoryInfo = {
			slotLimitForCategory: vi.fn().mockReturnValue(1)
		};

		// Mock response and context
		mockResponse = [];
		mockContext = {
			frontEndOrigin: 'discord',
			frontEndSubOrigin: 'test-channel'
		} as PacketContext;

		// Setup default mocks
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(mockInventorySlots);
		vi.mocked(InventoryInfos.getOfPlayer).mockResolvedValue(mockInventoryInfo);
		vi.mocked(MissionsController.update).mockResolvedValue(mockPlayer);
		vi.mocked(BlockingUtils.unblockPlayer).mockResolvedValue();

		// Mock crowniclesInstance
		vi.mocked(crowniclesInstance.logsDatabase.logItemGain).mockResolvedValue(undefined);
		vi.mocked(crowniclesInstance.logsDatabase.logItemSell).mockResolvedValue(undefined);
	});

	describe('when player has available inventory space', () => {
		it('should give item directly to player and call related functions', async () => {
			// Arrange
			mockPlayer.giveItem.mockResolvedValue(true);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem, 0, null);
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{ missionId: "findOrBuyItem" }
			);
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "haveItemRarity",
					params: { rarity: mockItem.rarity }
				}
			);
			expect(crowniclesInstance.logsDatabase.logItemGain).toHaveBeenCalledWith(
				mockPlayer.keycloakId,
				mockItem
			);
			
			// Should push ItemFoundPacket
			expect(mockResponse).toHaveLength(1);
			expect(mockResponse[0]).toEqual({
				type: 'ItemFoundPacket',
				data: {
					itemWithDetails: expect.objectContaining({
						id: mockItem.id,
						category: ItemCategory.WEAPON,
						rarity: ItemRarity.COMMON
					})
				}
			});
		});
	});

	describe('when player inventory is full', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(false);
		});

		it('should trigger auto-sell when all items in category are the same', async () => {
			// Arrange - all items in category are the same as the new item
			mockInventorySlots[0].itemId = mockItem.id;
			
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem, 0, null);
			expect(capturedCollectorCallback).toBeUndefined();
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 30 }));
		});

		it('should not auto-sell a better variant of the same item', async () => {
			mockInventorySlots[0].itemId = mockItem.id;

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, {
				itemLevel: 4,
				itemEnchantmentId: 'attack_1'
			});

			expect(capturedCollectorCallback).toBeDefined();
			expect(mockPlayer.addMoney).not.toHaveBeenCalled();
		});

		it('should create reaction collector for single slot category', async () => {
			// Arrange
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(1);
			
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
		});

		it('should preserve attributes when replacing a single-slot item', async () => {
			Object.setPrototypeOf(mockItem, MainItem.prototype);
			mockItem.getDisplayPacket.mockImplementation((level: number, enchantmentId?: string) => ({
				id: mockItem.id,
				itemLevel: level,
				itemEnchantmentId: enchantmentId
			}));

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, {
				itemLevel: 4,
				itemEnchantmentId: 'attack_1'
			});

			const callbackResponse: CrowniclesPacket[] = [];
			await capturedCollectorCallback!({
				getFirstReaction: () => ({
					reaction: { type: ReactionCollectorAcceptReaction.name }
				})
			}, callbackResponse);

			expect(InventorySlot.update).toHaveBeenCalledWith({
				itemId: mockItem.id,
				itemLevel: 4,
				itemEnchantmentId: 'attack_1',
				remainingPotionUsages: null
			}, {
				where: {
					slot: 0,
					itemCategory: ItemCategory.WEAPON,
					playerId: mockPlayer.id
				}
			});
			expect(callbackResponse[0]).toEqual({
				type: 'ItemAcceptPacket',
				data: {
					itemWithDetails: expect.objectContaining({
						itemLevel: 4,
						itemEnchantmentId: 'attack_1'
					})
				}
			});
		});

		it('should handle multi-slot categories with choice collector', async () => {
			// Arrange
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(3);
			mockInventorySlots.push(
				{
					playerId: 1,
					slot: 1,
					itemCategory: ItemCategory.WEAPON,
					itemId: 60,
					isEquipped: vi.fn().mockReturnValue(false),
					isPotion: vi.fn().mockReturnValue(false),
					getItem: vi.fn().mockReturnValue({
						id: 60,
						rarity: ItemRarity.COMMON,
						getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
						getDisplayPacket: vi.fn().mockReturnValue({ id: 60, name: 'Second Weapon' })
					})
				}
			);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
		});

		it('should preserve attributes when replacing a multi-slot item', async () => {
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);
			mockInventorySlots.push({
				playerId: 1,
				slot: 1,
				itemCategory: ItemCategory.WEAPON,
				itemId: 60,
				itemLevel: 2,
				itemEnchantmentId: null,
				remainingPotionUsages: null,
				isEquipped: vi.fn().mockReturnValue(false),
				isPotion: vi.fn().mockReturnValue(false),
				getItem: vi.fn().mockReturnValue({
					id: 60,
					rarity: ItemRarity.COMMON,
					getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
					getItemAddedValue: vi.fn().mockReturnValue(5),
					getDisplayPacket: vi.fn().mockReturnValue({ id: 60, name: 'Second Weapon' })
				})
			});

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, {
				itemLevel: 4,
				itemEnchantmentId: 'attack_1'
			});

			await capturedCollectorCallback!({
				getFirstReaction: () => ({
					reaction: {
						type: ReactionCollectorItemChoiceItemReaction.name,
						data: { slot: 1 }
					}
				})
			}, []);

			expect(InventorySlot.update).toHaveBeenCalledWith({
				itemId: mockItem.id,
				itemLevel: 4,
				itemEnchantmentId: 'attack_1',
				remainingPotionUsages: null
			}, {
				where: {
					slot: 1,
					itemCategory: ItemCategory.WEAPON,
					playerId: mockPlayer.id
				}
			});
		});
	});

	describe('when handling potions', () => {
		beforeEach(() => {
			mockItem = {
				id: 200,
				rarity: ItemRarity.RARE,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				isFightPotion: vi.fn().mockReturnValue(false),
				getDisplayPacket: vi.fn().mockReturnValue({
					id: 200,
					category: ItemCategory.POTION,
					rarity: ItemRarity.RARE,
					detailsSupportItem: null,
					detailsMainItem: null,
					maxStats: null
				})
			};
			mockPlayer.giveItem.mockResolvedValue(false);
		});

		it('should not auto-sell drinkable potions even when all are same', async () => {
			// Arrange
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: mockItem.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(mockItem)
			};

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
			expect(capturedCollectorCallback).toBeDefined();
		});

		it('should show the remaining usages of a potion when replacing a single-slot inventory', async () => {
			const existingPotion = {
				id: 50,
				getDisplayPacket: vi.fn().mockReturnValue({ usages: 2 })
			};
			Object.setPrototypeOf(existingPotion, Potion.prototype);
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: existingPotion.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: 2,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(existingPotion)
			};

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(existingPotion.getDisplayPacket).toHaveBeenCalledWith(100, 2);
			expect(capturedCollectorPacket?.data.data.itemWithDetails).toEqual({ usages: 2 });
		});

		it('should show the remaining usages of every potion in a multi-slot replacement choice', async () => {
			const firstPotion = {
				id: 50,
				getDisplayPacket: vi.fn().mockReturnValue({ usages: 2 })
			};
			const secondPotion = {
				id: 51,
				getDisplayPacket: vi.fn().mockReturnValue({ usages: 1 })
			};
			Object.setPrototypeOf(firstPotion, Potion.prototype);
			Object.setPrototypeOf(secondPotion, Potion.prototype);
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: firstPotion.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: 2,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(firstPotion)
			};
			mockInventorySlots.push({
				playerId: 1,
				slot: 1,
				itemCategory: ItemCategory.POTION,
				itemId: secondPotion.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: 1,
				isEquipped: vi.fn().mockReturnValue(false),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(secondPotion)
			});

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(firstPotion.getDisplayPacket).toHaveBeenCalledWith(100, 2);
			expect(secondPotion.getDisplayPacket).toHaveBeenCalledWith(100, 1);
			expect(capturedCollectorPacket?.reactions.slice(0, 2).map(reaction => reaction.data.itemWithDetails))
				.toEqual([{ usages: 2 }, { usages: 1 }]);
		});

		it('should auto-sell fight potions when all are same', async () => {
			// Arrange
			mockItem.isFightPotion.mockReturnValue(true);
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: mockItem.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(mockItem)
			};

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert - should trigger auto-sell
			expect(capturedCollectorCallback).toBeUndefined();
			expect(mockResponse[1]).toEqual({
				type: 'ItemRefusePacket',
				data: expect.objectContaining({ autoSell: true })
			});
		});
	});

	describe('with different resale multipliers', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(false);
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(1);
		});

		it('should pass resale multiplier to callback', async () => {
			// Arrange
			const customMultiplier = 0.5;

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: customMultiplier });

			// Assert
			expect(mockResponse).toHaveLength(2);
			await capturedCollectorCallback!({
				getFirstReaction: () => ({
					reaction: { type: ReactionCollectorRefuseReaction.name }
				})
			}, []);
			// Common weapon (20) + added value (10), sold at 50 %
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 15 }));
		});

		it('should use default multiplier of 1 when not specified', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2);
			await capturedCollectorCallback!({
				getFirstReaction: () => ({
					reaction: { type: ReactionCollectorRefuseReaction.name }
				})
			}, []);
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 30 }));
		});
	});

	describe('error handling and edge cases', () => {
		it('should handle empty inventory slots', async () => {
			// Arrange
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
			mockPlayer.giveItem.mockResolvedValue(true);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem, 0, null);
			expect(mockResponse).toHaveLength(1);
		});

		it('should handle database errors gracefully', async () => {
			// Arrange
			vi.mocked(InventorySlots.getOfPlayer).mockRejectedValue(new Error('Database error'));

			// Act & Assert
			await expect(giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem))
				.rejects.toThrow('Database error');
		});

		it('should handle missing inventory info', async () => {
			// Arrange
			vi.mocked(InventoryInfos.getOfPlayer).mockRejectedValue(new Error('Inventory info not found'));
			mockPlayer.giveItem.mockResolvedValue(false);

			// Act & Assert
			await expect(giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem))
				.rejects.toThrow('Inventory info not found');
		});
	});

	describe('mission updates', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(true);
		});

		it('should update findOrBuyItem mission', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{ missionId: "findOrBuyItem" }
			);
		});

		it('should update havePotions mission with correct count', async () => {
			// Arrange
			const potionSlots = [
				{
					isPotion: vi.fn().mockReturnValue(true),
					itemId: 1,
					getItem: vi.fn().mockReturnValue({ rarity: ItemRarity.BASIC })
				},
				{
					isPotion: vi.fn().mockReturnValue(true),
					itemId: 2,
					getItem: vi.fn().mockReturnValue({ rarity: ItemRarity.BASIC })
				},
				{
					isPotion: vi.fn().mockReturnValue(false),
					itemId: 3,
					getItem: vi.fn().mockReturnValue({ rarity: ItemRarity.BASIC })
				}
			];
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(potionSlots as any);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "havePotions",
					count: 2, // Should count only potions with non-zero itemId
					set: true
				}
			);
		});

		it('should update haveItemRarity mission with item rarity', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "haveItemRarity",
					params: { rarity: mockItem.rarity }
				}
			);
		});
	});

	describe('logging', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(true);
		});

		it('should log item gain when successfully given', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(crowniclesInstance.logsDatabase.logItemGain).toHaveBeenCalledWith(
				mockPlayer.keycloakId,
				mockItem
			);
		});
	});

	describe('toItemWithDetails helper function', () => {
		it('should correctly convert weapon item to ItemWithDetails', () => {
			// Arrange
			const weaponItem = {
				id: 1,
				rarity: ItemRarity.LEGENDARY,
				getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
				getDisplayPacket: vi.fn().mockReturnValue({
					id: 1,
					category: ItemCategory.WEAPON,
					rarity: ItemRarity.LEGENDARY,
					detailsSupportItem: null,
					detailsMainItem: { attack: 100, defense: 50, speed: 75 },
					maxStats: null
				})
			};

			// Act
			const result = toItemWithDetails(mockPlayer, weaponItem as any, 5, null);

			// Assert
			expect(result).toEqual({
				id: 1,
				category: ItemCategory.WEAPON,
				rarity: ItemRarity.LEGENDARY,
				detailsSupportItem: null,
				detailsMainItem: { attack: 100, defense: 50, speed: 75 },
				maxStats: null
			});
			// Note: Since weaponItem is not an actual instance of MainItem, it falls through to SupportItem branch
			expect(weaponItem.getDisplayPacket).toHaveBeenCalledWith(100);
		});

		it('should correctly convert potion item to ItemWithDetails', () => {
			// Arrange
			const potionItem = {
				id: 2,
				rarity: ItemRarity.RARE,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getDisplayPacket: vi.fn().mockReturnValue({
					id: 2,
					category: ItemCategory.POTION,
					rarity: ItemRarity.RARE,
					detailsSupportItem: { nature: 1, power: 50 },
					detailsMainItem: null,
					maxStats: null
				})
			};

			// Act
			const result = toItemWithDetails(mockPlayer, potionItem as any, 0, null);

			// Assert
			expect(result).toEqual({
				id: 2,
				category: ItemCategory.POTION,
				rarity: ItemRarity.RARE,
				detailsSupportItem: { nature: 1, power: 50 },
				detailsMainItem: null,
				maxStats: null
			});
			expect(potionItem.getDisplayPacket).toHaveBeenCalledWith(100);
		});
	});

	describe('selling, replacing and drinking a found item', () => {
		const oldWeapon = () => mockInventorySlots[0].getItem();

		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(false);
			mockPlayer.addHealth = vi.fn();
		});

		/**
		 * Data of the packets of the given type pushed in a response
		 */
		function packetsOf(response: CrowniclesPacket[], type: string): unknown[] {
			return (response as unknown as { type: string; data: unknown }[]) // makePacket is mocked to return { type, data }
				.filter(packet => packet.type === type)
				.map(packet => packet.data);
		}

		/**
		 * Simulate the end of the collector with the given reaction (undefined for a timeout)
		 */
		async function endCollector(reaction?: { type: string; data?: unknown }): Promise<CrowniclesPacket[]> {
			const callbackResponse: CrowniclesPacket[] = [];
			await capturedCollectorCallback!({
				getFirstReaction: () => reaction ? { reaction } : undefined
			}, callbackResponse);
			return callbackResponse;
		}

		/**
		 * Add a second weapon in the backup slot of a 2-slot weapon inventory
		 */
		function addBackupWeapon(slot: number, itemId: number): void {
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);
			mockInventorySlots.push({
				playerId: 1,
				slot,
				itemCategory: ItemCategory.WEAPON,
				itemId,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null,
				isEquipped: vi.fn().mockReturnValue(false),
				isPotion: vi.fn().mockReturnValue(false),
				getItem: vi.fn().mockReturnValue({
					id: itemId,
					rarity: ItemRarity.RARE,
					getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
					getItemAddedValue: vi.fn().mockReturnValue(3),
					getDisplayPacket: vi.fn().mockReturnValue({ id: itemId })
				})
			});
		}

		/**
		 * A drinkable health potion
		 */
		function healthPotion(): Record<string, unknown> {
			const potion = {
				id: 300,
				rarity: ItemRarity.RARE,
				nature: ItemNature.HEALTH,
				power: 40,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(0),
				isFightPotion: vi.fn().mockReturnValue(false),
				getDisplayPacket: vi.fn().mockReturnValue({ id: 300 })
			};
			Object.setPrototypeOf(potion, Potion.prototype);
			return potion;
		}

		/**
		 * Store another potion in the main slot of the inventory
		 */
		function storeOtherPotion(): void {
			mockInventorySlots[0] = {
				...mockInventorySlots[0],
				itemCategory: ItemCategory.POTION,
				itemId: 301,
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue({
					id: 301,
					rarity: ItemRarity.COMMON,
					getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
					getDisplayPacket: vi.fn().mockReturnValue({ id: 301 })
				})
			};
		}

		it('should auto-sell an identical item for its value times the resale multiplier', async () => {
			mockInventorySlots[0].itemId = mockItem.id;
			// Items of the other categories do not prevent the auto-sell
			mockInventorySlots.push({
				...mockInventorySlots[0],
				itemCategory: ItemCategory.ARMOR,
				itemId: 70
			});

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: 0.5 });

			// Common weapon (20) + added value (10), sold at 50 %
			expect(mockPlayer.addMoney).toHaveBeenCalledWith({
				amount: 15,
				response: mockResponse,
				reason: NumberChangeReason.ITEM_SELL
			});
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, mockResponse, {
				missionId: "sellItemWithGivenCost",
				params: { itemCost: 15 }
			});
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, mockResponse, { missionId: "sellItems" });
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, mockResponse, { missionId: "findOrBuyItem" });
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, mockResponse, {
				missionId: "havePotions", count: 0, set: true
			});
			expect(mockPlayer.save).toHaveBeenCalledOnce();
			expect(crowniclesInstance.logsDatabase.logItemSell).toHaveBeenCalledWith(mockPlayer.keycloakId, mockItem);
			expect(packetsOf(mockResponse, 'ItemRefusePacket')).toEqual([{
				item: {
					id: mockItem.id, category: ItemCategory.WEAPON
				},
				autoSell: true,
				soldMoney: 15
			}]);
			// Reloaded before the sale and again just before crediting the money
			expect(mockPlayer.reload).toHaveBeenCalledTimes(3);
			expect(capturedCollectorCallback).toBeUndefined();
			expect(InventorySlot.update).not.toHaveBeenCalled();
		});

		it('should not auto-sell when another item of the category differs', async () => {
			mockInventorySlots[0].itemId = mockItem.id;
			addBackupWeapon(1, 60);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(mockPlayer.addMoney).not.toHaveBeenCalled();
			expect(capturedCollectorCallback).toBeDefined();
		});

		it('should auto-sell an identical fight potion without giving money', async () => {
			const fightPotion = {
				id: 200,
				rarity: ItemRarity.RARE,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(0),
				isFightPotion: vi.fn().mockReturnValue(true),
				getDisplayPacket: vi.fn().mockReturnValue({ id: 200 })
			};
			mockInventorySlots[0] = {
				...mockInventorySlots[0],
				itemCategory: ItemCategory.POTION,
				itemId: fightPotion.id,
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(fightPotion)
			};

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, fightPotion);

			expect(mockPlayer.addMoney).not.toHaveBeenCalled();
			expect(packetsOf(mockResponse, 'ItemRefusePacket')).toEqual([{
				item: {
					id: fightPotion.id, category: ItemCategory.POTION
				},
				autoSell: true,
				soldMoney: 0
			}]);
		});

		it('should open a blocking accept collector restricted to the player', async () => {
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(capturedCollectorPacket?.data.type).toBe('ReactionCollectorItemAcceptData');
			expect(capturedCollectorOptions).toEqual({
				allowedPlayerKeycloakIds: [mockPlayer.keycloakId],
				reactionLimit: 1,
				mainPacket: false
			});
			expect(capturedBlock).toEqual([mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM]);
		});

		it('should sell the replaced item at its full value when the new item is accepted', async () => {
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: 0.5 });
			const callbackResponse = await endCollector({ type: ReactionCollectorAcceptReaction.name });

			// Replaced common weapon (20) + added value (5), the resale multiplier only applies to the found item
			expect(mockPlayer.addMoney).toHaveBeenCalledWith({
				amount: 25,
				response: callbackResponse,
				reason: NumberChangeReason.ITEM_SELL
			});
			expect(packetsOf(callbackResponse, 'ItemRefusePacket')).toEqual([{
				item: {
					id: 50, category: ItemCategory.WEAPON
				},
				autoSell: false,
				soldMoney: 25
			}]);
			expect(crowniclesInstance.logsDatabase.logItemGain).toHaveBeenCalledWith(mockPlayer.keycloakId, mockItem);
			expect(crowniclesInstance.logsDatabase.logItemSell).toHaveBeenCalledWith(mockPlayer.keycloakId, oldWeapon());
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM);
		});

		it.each([
			['refused', { type: ReactionCollectorRefuseReaction.name }],
			['ignored', undefined]
		])('should keep the inventory and sell the found item when it is %s', async (_name, reaction) => {
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: 0.5 });
			const callbackResponse = await endCollector(reaction);

			expect(InventorySlot.update).not.toHaveBeenCalled();
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 15 }));
			expect(packetsOf(callbackResponse, 'ItemRefusePacket')).toEqual([{
				item: {
					id: mockItem.id, category: ItemCategory.WEAPON
				},
				autoSell: false,
				soldMoney: 15
			}]);
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM);
		});

		it('should replace the equipped item of the category in a single-slot inventory', async () => {
			const equippedArmor = {
				...mockInventorySlots[0],
				itemCategory: ItemCategory.ARMOR,
				itemId: 70
			};
			const backupWeapon = {
				...mockInventorySlots[0],
				slot: 1,
				itemId: 80,
				isEquipped: vi.fn().mockReturnValue(false)
			};
			mockInventorySlots.unshift(equippedArmor, backupWeapon);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);
			await endCollector({ type: ReactionCollectorAcceptReaction.name });

			expect(InventorySlot.update).toHaveBeenCalledWith(expect.anything(), {
				where: {
					slot: 0,
					itemCategory: ItemCategory.WEAPON,
					playerId: mockPlayer.id
				}
			});
		});

		it('should count the home inventory bonus of the category in the available slots', async () => {
			vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce({
				getLevel: () => ({
					features: {
						inventoryBonus: {
							weapon: 1, armor: 0, potion: 0, object: 0
						}
					}
				})
			} as unknown as Awaited<ReturnType<typeof Homes.getOfPlayer>>); // Partial home fixture

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(capturedCollectorPacket?.data.type).toBe('ReactionCollectorItemChoiceData');
		});

		it('should ignore the home inventory bonus of the other categories', async () => {
			vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce({
				getLevel: () => ({
					features: {
						inventoryBonus: {
							weapon: 0, armor: 2, potion: 2, object: 2
						}
					}
				})
			} as unknown as Awaited<ReturnType<typeof Homes.getOfPlayer>>); // Partial home fixture

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(capturedCollectorPacket?.data.type).toBe('ReactionCollectorItemAcceptData');
		});

		it('should list the items to replace sorted by slot in a multi-slot inventory', async () => {
			addBackupWeapon(3, 63);
			addBackupWeapon(2, 62);
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(4);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(capturedCollectorPacket?.data.data.item).toEqual({
				id: mockItem.id, category: ItemCategory.WEAPON
			});
			expect(capturedCollectorPacket?.reactions
				.filter(reaction => reaction.type === ReactionCollectorItemChoiceItemReaction.name)
				.map(reaction => reaction.data.slot)).toEqual([0, 2, 3]);
			expect(capturedCollectorOptions).toEqual({
				allowedPlayerKeycloakIds: [mockPlayer.keycloakId],
				reactionLimit: 1,
				mainPacket: false
			});
			expect(capturedBlock).toEqual([mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM]);
		});

		it('should sell the chosen item at its full value in a multi-slot inventory', async () => {
			addBackupWeapon(1, 60);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: 0.5 });
			const callbackResponse = await endCollector({
				type: ReactionCollectorItemChoiceItemReaction.name,
				data: { slot: 1 }
			});

			// Rare weapon (250) + added value (3)
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 253 }));
			expect(packetsOf(callbackResponse, 'ItemRefusePacket')).toEqual([{
				item: {
					id: 60, category: ItemCategory.WEAPON
				},
				autoSell: false,
				soldMoney: 253
			}]);
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM);
		});

		it.each([
			['refused', { type: ReactionCollectorItemChoiceRefuseReaction.name }],
			['ignored', undefined]
		])('should sell the found item with the resale multiplier when the multi-slot choice is %s', async (_name, reaction) => {
			addBackupWeapon(1, 60);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, { resaleMultiplier: 0.5 });
			await endCollector(reaction);

			expect(InventorySlot.update).not.toHaveBeenCalled();
			expect(mockPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 15 }));
		});

		it('should drink the found potion instead of storing it in a single-slot inventory', async () => {
			const potion = healthPotion();
			storeOtherPotion();

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, potion);
			const callbackResponse = await endCollector({ type: ReactionCollectorItemAcceptDrinkPotionReaction.name });

			expect(mockPlayer.addHealth).toHaveBeenCalledWith(expect.objectContaining({ amount: 40 }));
			expect(mockPlayer.save).toHaveBeenCalledOnce();
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, callbackResponse, { missionId: "findOrBuyItem" });
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, callbackResponse, { missionId: "drinkPotion" });
			expect(mockPlayer.addMoney).not.toHaveBeenCalled();
			expect(InventorySlot.update).not.toHaveBeenCalled();
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(mockPlayer.keycloakId, BlockingConstants.REASONS.ACCEPT_ITEM);
		});

		it('should drink the found potion instead of storing it in a multi-slot inventory', async () => {
			const potion = healthPotion();
			storeOtherPotion();
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, potion);
			const callbackResponse = await endCollector({ type: ReactionCollectorItemChoiceDrinkPotionReaction.name });

			expect(mockPlayer.addHealth).toHaveBeenCalledWith(expect.objectContaining({ amount: 40 }));
			expect(mockPlayer.save).toHaveBeenCalledOnce();
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, callbackResponse, { missionId: "findOrBuyItem" });
			expect(MissionsController.update).toHaveBeenCalledWith(mockPlayer, callbackResponse, { missionId: "drinkPotion" });
			expect(mockPlayer.addMoney).not.toHaveBeenCalled();
			expect(InventorySlot.update).not.toHaveBeenCalled();
		});
	});

	// Tests for bug #3652 - Prevent drinking time potions before destination choice
	describe('canDrinkImmediately parameter (bug #3652)', () => {
		let mockTimePotion: any;

		beforeEach(() => {
			// Reset mocks
			mockPlayer.giveItem.mockResolvedValue(false);
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(1);

			// Create a TIME_SPEEDUP potion mock
			mockTimePotion = {
				id: 200,
				rarity: ItemRarity.COMMON,
				nature: ItemNature.TIME_SPEEDUP,
				power: 30,
				categoryName: 'potions',
				slot: 0,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(30),
				isFightPotion: vi.fn().mockReturnValue(false),
				getAttack: vi.fn().mockReturnValue(0),
				getDefense: vi.fn().mockReturnValue(0),
				getSpeed: vi.fn().mockReturnValue(0),
				getDisplayPacket: vi.fn().mockReturnValue({ id: 200, name: 'Time Potion' })
			};
			Object.setPrototypeOf(mockTimePotion, Potion.prototype);

			// Setup potion inventory slot
			mockInventorySlots = [
				{
					playerId: 1,
					slot: 0,
					itemCategory: ItemCategory.POTION,
					itemId: 50,
					isEquipped: vi.fn().mockReturnValue(true),
					isPotion: vi.fn().mockReturnValue(true),
					getItem: vi.fn().mockReturnValue({
						id: 50,
						rarity: ItemRarity.BASIC,
						getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
						nature: 1, // Regular potion
						isFightPotion: vi.fn().mockReturnValue(false),
						getDisplayPacket: vi.fn().mockReturnValue({ id: 50, name: 'Slot Potion' })
					})
				}
			];
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(mockInventorySlots);
		});

		it('should allow drinking regular potions when canDrinkImmediately is true (default)', async () => {
			// Arrange - Create a health potion (not TIME_SPEEDUP)
			const healthPotion = {
				id: 201,
				rarity: ItemRarity.COMMON,
				nature: ItemNature.HEALTH,
				power: 50,
				categoryName: 'potions',
				slot: 0,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(50),
				isFightPotion: vi.fn().mockReturnValue(false),
				getAttack: vi.fn().mockReturnValue(0),
				getDefense: vi.fn().mockReturnValue(0),
				getSpeed: vi.fn().mockReturnValue(0),
				getDisplayPacket: vi.fn().mockReturnValue({ id: 201, name: 'Health Potion' })
			};
			Object.setPrototypeOf(healthPotion, Potion.prototype);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, healthPotion);

			// Assert - Should allow drinking (ReactionCollectorItemAccept with canDrink = true)
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
			expect(drinkReactionOffered()).toBe(true);
		});

		it('should NOT allow drinking TIME_SPEEDUP potions when canDrinkImmediately is false', async () => {
			// Act - Call with canDrinkImmediately = false (simulates big event before destination choice)
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockTimePotion, { resaleMultiplier: 1, canDrinkImmediately: false });

			// Assert - Should NOT allow drinking (ReactionCollectorItemAccept with canDrink = false)
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
			expect(drinkReactionOffered()).toBe(false);
			// The constructor should have been called with canDrink = false
			// This ensures the "drink" option is not available in the reaction collector
		});

		it('should allow drinking TIME_SPEEDUP potions when canDrinkImmediately is true', async () => {
			// Act - Call with canDrinkImmediately = true (default behavior, normal gameplay)
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockTimePotion, { resaleMultiplier: 1, canDrinkImmediately: true });

			// Assert - Should NOT allow drinking because TIME_SPEEDUP potions cannot be drunk immediately
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
			expect(drinkReactionOffered()).toBe(true);
		});

		it('should allow drinking TIME_SPEEDUP potions by default', async () => {
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockTimePotion);

			expect(drinkReactionOffered()).toBe(true);
		});

		it('should allow drinking a potion from the multi-slot choice', async () => {
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockTimePotion);

			expect(capturedCollectorPacket?.data.type).toBe('ReactionCollectorItemChoiceData');
			expect(drinkReactionOffered()).toBe(true);
		});

		it('should never offer to drink an item that is not a potion', async () => {
			mockInventorySlots[0].itemCategory = ItemCategory.WEAPON;

			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			expect(drinkReactionOffered()).toBe(false);
		});

		it('should NOT allow drinking fight potions regardless of canDrinkImmediately', async () => {
			// Arrange - Create a fight potion
			const fightPotion = {
				id: 202,
				rarity: ItemRarity.RARE,
				nature: ItemNature.SPEED,
				power: 40,
				categoryName: 'potions',
				slot: 0,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(40),
				isFightPotion: vi.fn().mockReturnValue(true),
				getAttack: vi.fn().mockReturnValue(0),
				getDefense: vi.fn().mockReturnValue(0),
				getSpeed: vi.fn().mockReturnValue(10), // Fight potion has speed
				getDisplayPacket: vi.fn().mockReturnValue({ id: 202, name: 'Fight Potion' })
			};
			Object.setPrototypeOf(fightPotion, Potion.prototype);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, fightPotion, { resaleMultiplier: 1, canDrinkImmediately: false });

			// Assert - Fight potions cannot be drunk immediately anyway
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
			expect(drinkReactionOffered()).toBe(false);
		});

		it('should handle regular potions correctly when canDrinkImmediately is false', async () => {
			// Arrange - Create a money potion
			const moneyPotion = {
				id: 203,
				rarity: ItemRarity.COMMON,
				nature: ItemNature.MONEY,
				power: 100,
				categoryName: 'potions',
				slot: 0,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				getItemAddedValue: vi.fn().mockReturnValue(100),
				isFightPotion: vi.fn().mockReturnValue(false),
				getAttack: vi.fn().mockReturnValue(0),
				getDefense: vi.fn().mockReturnValue(0),
				getSpeed: vi.fn().mockReturnValue(0),
				getDisplayPacket: vi.fn().mockReturnValue({ id: 203, name: 'Money Potion' })
			};
			Object.setPrototypeOf(moneyPotion, Potion.prototype);

			// Act - Even with canDrinkImmediately = false, non-TIME_SPEEDUP potions should be drinkable
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, moneyPotion, { resaleMultiplier: 1, canDrinkImmediately: false });

			// Assert - Should allow drinking (not a TIME_SPEEDUP potion)
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
			expect(drinkReactionOffered()).toBe(true);
		});

		it('should work correctly in multi-slot category with TIME_SPEEDUP potion and canDrinkImmediately = false', async () => {
			// Arrange
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(3);
			mockInventorySlots = [
				{
					playerId: 1,
					slot: 0,
					itemCategory: ItemCategory.POTION,
					itemId: 100,
					isEquipped: vi.fn().mockReturnValue(false),
					getItem: vi.fn().mockReturnValue({
						id: 100,
						rarity: ItemRarity.BASIC,
						getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
						getDisplayPacket: vi.fn().mockReturnValue({ id: 100, name: 'Potion 100' })
					})
				},
				{
					playerId: 1,
					slot: 1,
					itemCategory: ItemCategory.POTION,
					itemId: 101,
					isEquipped: vi.fn().mockReturnValue(false),
					getItem: vi.fn().mockReturnValue({
						id: 101,
						rarity: ItemRarity.COMMON,
						getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
						getDisplayPacket: vi.fn().mockReturnValue({ id: 101, name: 'Potion 101' })
					})
				}
			];
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(mockInventorySlots);

			// Act - Give TIME_SPEEDUP potion with canDrinkImmediately = false
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockTimePotion, { resaleMultiplier: 1, canDrinkImmediately: false });

			// Assert - Should create collector but without drink option
			expect(capturedCollectorPacket?.data.type).toBe('ReactionCollectorItemChoiceData');
			expect(drinkReactionOffered()).toBe(false);
		});
	});
});

describe('generateRandomLootEnchantment', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return null for potions', () => {
		const mockPotion = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.POTION)
		};
		vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive').mockReturnValue(0);
		expect(generateRandomLootEnchantment(mockPotion as any)).toBeNull();
	});

	it('should return null for objects', () => {
		const mockObject = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.OBJECT)
		};
		expect(generateRandomLootEnchantment(mockObject as any)).toBeNull();
	});

	it('should return null for weapons when roll is above enchantment chance', () => {
		const mockWeapon = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
		};
		vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive').mockReturnValue(0.10);
		expect(generateRandomLootEnchantment(mockWeapon as any)).toBeNull();
	});

	it('should return null for weapons when roll is exactly the enchantment chance', () => {
		const mockWeapon = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
		};
		vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive').mockReturnValue(EnchantmentConstants.LOOT_ENCHANTMENT_CHANCE);
		expect(generateRandomLootEnchantment(mockWeapon as any)).toBeNull();
	});

	it('should return an enchantment id for weapons when roll is below enchantment chance', () => {
		const mockWeapon = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
		};
		vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive').mockReturnValue(0.01);
		const result = generateRandomLootEnchantment(mockWeapon as any);
		expect(result).not.toBeNull();
		expect(typeof result).toBe('string');
	});

	it('should return an enchantment id for armors when roll is below enchantment chance', () => {
		const mockArmor = {
			getCategory: vi.fn().mockReturnValue(ItemCategory.ARMOR)
		};
		vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive').mockReturnValue(0.01);
		const result = generateRandomLootEnchantment(mockArmor as any);
		expect(result).not.toBeNull();
		expect(typeof result).toBe('string');
	});
});
