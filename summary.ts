/// <reference path="./@types/imported.d.ts" />
import * as readline from 'readline';
import { parseFollowers, parseEnemies, combatantData, spellData } from './util/parser';

interface enhancedTargetInfo {
    name: string
    points: number
    oldHealth: number
    newHealth: number
}

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let data = '';

function handleData(line: string) {
    data += line + '\n';
}

function displayName(combatant: combatantData) {
    return `${combatant.name} (${combatant.boardIndex})`;
}

function printSummary(combatants: {[key: number]: combatantData}) {
    for(let boardIndex in combatants) {
        if(boardIndex !== '-1') {
            let combatant = combatants[boardIndex];
            if(combatant.currentHealth <= 0) {
                console.log(`\t${displayName(combatant)} is dead`)
            }
            else {
                console.log(`\t${displayName(combatant)} has ${combatant.currentHealth}/${combatant.maxHealth} health`);
            }
        }
    }
}

function handleEnd() {
    let mission = JSON.parse(data) as missionData;

    let followers = parseFollowers(mission);
    let enemies = parseEnemies(mission);

    let combatants = {...followers, ...enemies};

    let allSpells: {[key: string]: spellData} = {};
    for(let id in combatants) {
        allSpells = {...allSpells, ...combatants[id].spells};
    }

    if(mission.environment) {
        let environmentSpells: {[key: number]: spellData} = {};
        let spellId = mission.environment.autoCombatSpellInfo.autoCombatSpellID;
        environmentSpells[spellId] = {
            id: spellId,
            name: mission.environment.autoCombatSpellInfo.name
        }
        allSpells[spellId] = environmentSpells[spellId];
        combatants[-1] = {
            name: `${mission.environment.name} (Environment)`,
            boardIndex: -1,
            spells: environmentSpells,
            maxHealth: 0,
            currentHealth: 0,
            attack: 0,
        }
    }

    printSummary(combatants);
    console.log('');
    let round = 0;
    for(let log of mission.result.combatLog) {
        round++;
        console.log(`****Round ${round}****`)
        for(let event of log.events) {
            let caster = combatants[event.casterBoardIndex];
            let casterName = displayName(caster);
            let targets: enhancedTargetInfo[] = [];
            if(Array.isArray(event.targetInfo)) {
                targets = event.targetInfo.map(t => ({name: displayName(combatants[t.boardIndex]), points: t.points, oldHealth: t.oldHealth, newHealth: t.newHealth}));
                for(let target of event.targetInfo) {
                    combatants[target.boardIndex].currentHealth = target.newHealth;
                    combatants[target.boardIndex].maxHealth = target.maxHealth;
                }
            }
            let spell = allSpells[event.spellID];

            let auraType: string;
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
                    let attackType: string;
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