const fs = require('fs');
const path = require('path');

const petsDir = path.join(__dirname, '../Core/resources/pets');

// Define force ranges based on rarity (0-8 for ItemRarity.BASIC to MYTHICAL)
const forceRanges = {
  0: { min: 1, max: 3 },    // BASIC
  1: { min: 2, max: 5 },    // COMMON
  2: { min: 8, max: 12 },   // UNCOMMON
  3: { min: 13, max: 18 },  // EXOTIC
  4: { min: 19, max: 24 },  // RARE
  5: { min: 22, max: 27 },  // SPECIAL
  6: { min: 24, max: 28 },  // EPIC
  7: { min: 26, max: 29 },  // LEGENDARY
  8: { min: 28, max: 30 }   // MYTHICAL
};

// Define feedDelay ranges based on rarity
const feedDelayRanges = {
  0: { min: 1, max: 1 },    // BASIC
  1: { min: 1, max: 2 },    // COMMON
  2: { min: 1, max: 2 },    // UNCOMMON
  3: { min: 2, max: 3 },    // EXOTIC
  4: { min: 3, max: 4 },    // RARE
  5: { min: 3, max: 4 },    // SPECIAL
  6: { min: 4, max: 5 },    // EPIC
  7: { min: 4, max: 5 },    // LEGENDARY
  8: { min: 5, max: 5 }     // MYTHICAL
};

function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fixPetFile(filename) {
  const filepath = path.join(petsDir, filename);
  const pet = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  let modified = false;
  
  // Fix force if 0
  if (pet.force === 0) {
    const range = forceRanges[pet.rarity] || forceRanges[1];
    pet.force = getRandomInRange(range.min, range.max);
    modified = true;
    console.log(`${filename}: force 0 -> ${pet.force} (rarity ${pet.rarity})`);
  }
  
  // Fix feedDelay if 0
  if (pet.feedDelay === 0) {
    const range = feedDelayRanges[pet.rarity] || feedDelayRanges[1];
    pet.feedDelay = getRandomInRange(range.min, range.max);
    modified = true;
    console.log(`${filename}: feedDelay 0 -> ${pet.feedDelay} (rarity ${pet.rarity})`);
  }
  
  if (modified) {
    fs.writeFileSync(filepath, JSON.stringify(pet, null, 2) + '\n', 'utf8');
  }
  
  return modified;
}

// Process all pet files
const files = fs.readdirSync(petsDir).filter(f => f.endsWith('.json')).sort((a, b) => {
  const numA = parseInt(a.replace('.json', ''));
  const numB = parseInt(b.replace('.json', ''));
  return numA - numB;
});

let fixedCount = 0;
for (const file of files) {
  if (fixPetFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} pet files.`);
