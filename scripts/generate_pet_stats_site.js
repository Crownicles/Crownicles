const fs = require('fs');
const path = require('path');

const PETS_DIR = path.join(__dirname, '../Core/resources/pets');
const LANG_FILE = path.join(__dirname, '../Lang/fr/models.json');
const OUTPUT_FILE = path.join(__dirname, '../docs/pet_stats.html');

const PET_FORCE_BALANCE = {
    COEFF_QUADRATIC: 0.005,
    COEFF_LINEAR: 0.15
};

function calculatePetStat(force, level) {
    const normalizedForce = Math.max(0, force);
    const multiplier = PET_FORCE_BALANCE.COEFF_QUADRATIC * normalizedForce * normalizedForce + 
                      PET_FORCE_BALANCE.COEFF_LINEAR * normalizedForce;
    return Math.floor(level * multiplier);
}

async function generateSite() {
    console.log('Reading translation file...');
    const langData = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8'));
    const petNames = langData.pets;

    console.log('Reading pet files...');
    const petFiles = fs.readdirSync(PETS_DIR).filter(file => file.endsWith('.json'));
    
    const pets = [];

    for (const file of petFiles) {
        const petId = parseInt(file.replace('.json', ''));
        const petData = JSON.parse(fs.readFileSync(path.join(PETS_DIR, file), 'utf8'));
        
        // Get name (prefer male, fallback to female or ID)
        const nameKey = `${petId}_male`;
        const name = petNames[nameKey] || petNames[`${petId}_female`] || `Unknown Pet ${petId}`;

        pets.push({
            id: petId,
            name: name,
            ...petData
        });
    }

    // Sort by ID
    pets.sort((a, b) => a.id - b.id);

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crownicles - Statistiques des Familiers</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.4/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <style>
        body { padding: 20px; background-color: #f8f9fa; }
        .container { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .rarity-1 { color: #888; } /* Common */
        .rarity-2 { color: #28a745; } /* Uncommon */
        .rarity-3 { color: #007bff; } /* Rare */
        .rarity-4 { color: #6f42c1; } /* Special */
        .rarity-5 { color: #ffc107; text-shadow: 1px 1px 1px #333; } /* Epic */
        .rarity-6 { color: #dc3545; font-weight: bold; } /* Legendary */
        .rarity-7 { color: #fd7e14; font-weight: bold; } /* Mythical */
        .rarity-8 { color: #000; font-weight: bold; text-shadow: 0 0 5px #dc3545; } /* Unique */
        
        #levelInput { width: 100px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">Statistiques des Familiers Crownicles</h1>
        
        <div class="mb-4 p-3 bg-light border rounded">
            <label for="levelInput" class="form-label me-2">Niveau du joueur :</label>
            <input type="number" id="levelInput" class="form-control" value="100" min="1" max="200">
            <span class="text-muted ms-2">Modifiez le niveau pour mettre à jour la puissance calculée.</span>
        </div>

        <table id="petsTable" class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Rareté</th>
                    <th>Régime</th>
                    <th>Force (Base)</th>
                    <th>Puissance Calculée</th>
                    <th>Délai (h)</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.4/js/dataTables.bootstrap5.min.js"></script>
    <script>
        const petsData = ${JSON.stringify(pets)};
        const PET_FORCE_BALANCE = ${JSON.stringify(PET_FORCE_BALANCE)};

        function calculatePetStat(force, level) {
            const normalizedForce = Math.max(0, force);
            const multiplier = PET_FORCE_BALANCE.COEFF_QUADRATIC * normalizedForce * normalizedForce + 
                              PET_FORCE_BALANCE.COEFF_LINEAR * normalizedForce;
            return Math.floor(level * multiplier);
        }

        function getRarityName(rarity) {
            const rarities = {
                1: "Commun",
                2: "Inhabituel",
                3: "Rare",
                4: "Spécial",
                5: "Épique",
                6: "Légendaire",
                7: "Mythique",
                8: "Unique"
            };
            return rarities[rarity] || rarity;
        }

        $(document).ready(function() {
            const table = $('#petsTable').DataTable({
                data: petsData,
                columns: [
                    { data: 'id' },
                    { 
                        data: 'name',
                        render: function(data, type, row) {
                            return \`<span class="fw-bold">\${data}</span>\`;
                        }
                    },
                    { 
                        data: 'rarity',
                        render: function(data, type, row) {
                            return \`<span class="rarity-\${data}">\${getRarityName(data)} (\${data})</span>\`;
                        }
                    },
                    { data: 'diet' },
                    { data: 'force' },
                    { 
                        data: null,
                        render: function(data, type, row) {
                            const level = parseInt($('#levelInput').val()) || 100;
                            return calculatePetStat(row.force, level);
                        }
                    },
                    { data: 'feedDelay' }
                ],
                pageLength: 25,
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/fr-FR.json'
                }
            });

            $('#levelInput').on('change keyup', function() {
                table.rows().invalidate().draw();
            });
        });
    </script>
</body>
</html>
    `;

    fs.writeFileSync(OUTPUT_FILE, htmlContent);
    console.log(`Website generated at ${OUTPUT_FILE}`);
}

generateSite().catch(console.error);
