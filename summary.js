const readline = require('readline');

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let data = '';

function handleData(line) {
    data += line + '\n';
}

function displayName(combatant) {
    return `${combatant.name} (${combatant.boardIndex})`;
}

function printSummary(combatants) {
    for(let boardIndex in combatants) {
        let combatant = combatants[boardIndex];
        if(combatant.currentHealth <= 0) {
            console.log(`\t${displayName(combatant)} is dead`)
        }
        else {
            console.log(`\t${displayName(combatant)} has ${combatant.currentHealth}/${combatant.maxHealth} health`);
        }
    }
}

function handleEnd() {
    let mission = JSON.parse(data);

    let followers = {};

    for(let followerId in mission.followers) {
        let data = mission.followers[followerId];
        let spells = {};
        
        for(let spellData of data.spells) {
            let spell = {
                id: spellData.autoCombatSpellID,
                name: spellData.name,
            };
            spells[spell.id] = spell;
        }

        let follower = {
            name: data.missionInfo.name,
            boardIndex: data.missionInfo.boardIndex,
            level: data.missionInfo.level,
            maxHealth: data.stats.maxHealth,
            currentHealth: data.stats.currentHealth,
            attack: data.stats.attack,
            spells,
        };
        followers[follower.boardIndex] = follower;
    }
    let enemies = {};

    for(let encounter of mission.encounters) {
        let spells = {};

        for(let spellData of encounter.autoCombatSpells) {
            let spell = {
                id: spellData.autoCombatSpellID,
                name: spellData.name,
            };
            spells[spell.id] = spell;
        }

        let enemy = {
            name: encounter.name,
            boardIndex: encounter.boardIndex,
            maxHealth: encounter.maxHealth,
            currentHealth: encounter.health,
            attack: encounter.attack,
            spells,
        };
        enemies[enemy.boardIndex] = enemy;
    }

    let combatants = {...followers, ...enemies};

    printSummary(combatants);
    console.log('');
    let round = 0;
    for(let log of mission.result.combatLog) {
        round++;
        console.log(`****Round ${round}****`)
        for(let event of log.events) {
            let caster = combatants[event.casterBoardIndex];
            let casterName = displayName(caster);
            let targets = [];
            if(Array.isArray(event.targetInfo)) {
                targets = event.targetInfo.map(t => ({name: displayName(combatants[t.boardIndex]), points: t.points, oldHealth: t.oldHealth, newHealth: t.newHealth}));
                for(let target of event.targetInfo) {
                    combatants[target.boardIndex].currentHealth = target.newHealth;
                    combatants[target.boardIndex].maxHealth = target.maxHealth;
                }
            }
            let spell = caster.spells[event.spellID];

            let auraType;
            if(event.auraType === 0) {
                auraType = 'not an aura';
            }
            if(event.auraType === 4) {
                auraType = 'buff';
            }
            else if(event.auraType === 8) {
                auraType = 'debuff'
            }
            else {
                auraType = `UNKNOWN AURA TYPE ${event.auraType}`;
            }

            let effectSuffix = `(Effect Index ${event.effectIndex})`;

            switch(event.type) {
                case 0:
                case 1:
                    console.log(`${casterName} attack (Event ${event.type}, Spell ${event.spellID})`);
                    if(event.effectIndex !== 0) {
                        console.log(`\tEFFECT INDEX IS ${event.effectIndex} NOT ZERO`);
                    }
                    for(let target of targets) {
                        console.log(`\tHit ${target.name} for ${target.points}`);
                    }
                    break;
                case 2:
                case 3:
                    let attackType;
                    if(event.type === 2) {
                        attackType = 'melee';
                    }
                    else {
                        attackType = 'ranged';
                    }
                    console.log(`${casterName} cast ${attackType} spell ${spell.name} ${effectSuffix}`);
                    for(let target of targets) {
                        console.log(`\tHit ${target.name} for ${target.points}`);
                    }
                    break;
                case 4:
                    console.log(`${casterName} cast healing spell ${spell.name} ${effectSuffix}`);
                    for(let target of targets) {
                        let effectiveHeal = target.newHealth - target.oldHealth;
                        let overheal = target.points - effectiveHeal;
                        let message = `\tHealed ${target.name} for ${target.points}`;
                        if(overheal !== 0) {
                            message += ` (Overheal by ${overheal})`;
                        }
                        console.log(message);
                    }
                    break;
                case 5:
                    console.log(`${casterName} spell ${spell.name} DoT tick ${effectSuffix}`);
                    for(let target of targets) {
                        console.log(`\tHit ${target.name} for ${target.points}`);
                    }
                    break;
                case 7:
                    console.log(`${casterName} spell ${spell.name} applied ${auraType} ${effectSuffix}`);
                    for(let target of targets) {
                        console.log(`\tAffected ${target.name}`);
                    }
                    break;
                case 8:
                    console.log(`${casterName} ${spell.name} ${auraType} faded ${effectSuffix}`);
                    for(let target of targets) {
                        console.log(`\tFaded from ${target.name}`);
                    }
                    break;
                case 9:
                    console.log(`${casterName} dealt a killing blow`);
                    if(event.effectIndex !== 0) {
                        console.log(`\tEFFECT INDEX IS ${event.effectIndex} NOT ZERO`);
                    }
                    for(let target of targets) {
                        console.log(`\t${target.name} died`);
                    }
                    break;
                default:
                    console.log('Unknown event type');
                    console.log(`\tCaster: ${casterName}, spell ${spell.name}`);
                    console.log(`\tType: ${event.type}, School Mask: ${event.schoolMask}, Aura Type: ${event.auraType}, Effect Index: ${event.effectIndex}`)
                    for(let target of targets) {
                        console.log(`\tHit ${target.name} for ${target.points}`);
                    }
                    break;
            }
        }
        console.log('==End of round summary==');
        printSummary(combatants);
        console.log('');
    }
}

rl.on('line', handleData);
rl.on('close', handleEnd);