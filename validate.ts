/// <reference path="./@types/imported.d.ts" />

import * as fs from 'fs/promises';
import * as path from 'path';

import { parseFollowers, parseEnemies, combatantData } from './util/parser';
import * as spellData from './data/spells.json';
import * as troopData from './data/troops.json';
import * as companionData from './data/companions.json';
import * as enemyData from './data/enemies.json';

interface combatantInfo {
    name: string
    melee: boolean
    spells: number[]
}

interface damageSpellEffect {
    type: 'damage'
    amount: number
    targets?: string
}

interface healSpellEffect {
    type: 'heal'
    amount: number
    targets?: string
}

interface auraSpellEffect {
    type: 'aura'
    duration: number
    attackFactor?: number
    attackBonusAmount?: number
    damageTakenFactor?: number
    damageTakenBonusAmount?: number
    healthBonusAmount?: number
    counterDamageAmount?: number
    helpful?: boolean
    targets?: string
}

interface dotSpellEffect {
    type: 'dot'
    duration: number
    amount: number
    period?: number
    delay?: number
    targets?: string
}

type spellEffect = damageSpellEffect | healSpellEffect | auraSpellEffect | dotSpellEffect;

interface combatSpell {
    cooldown: number
    cooldownRemaining: number
    targets: string
    effects: spellEffect[]
}

interface combatant {
    melee: boolean
    spells: combatSpell[]
    name: string
    boardIndex: number
    currentHealth: number
    maxHealth: number
    attack: number
}

interface dotAura {
    isDot: true
    caster: combatant
    target: combatant
    duration: number
    amount: number
    delay: number
    period: number
}

interface effectAura {
    isDot: false
    caster: combatant
    target: combatant
    duration: number
    attackFactor: number
    attackBonusAmount: number
    damageTakenFactor: number
    damageTakenBonusAmount: number
    healthBonusAmount: number
    counterDamageAmount: number
}

type aura = dotAura | effectAura;

validateFile(path.resolve(__dirname, 'parsedFiles/1609725731666 - Misguided Monstrosity.json'))

let combatants: {[key: number]: combatant};
let auras: aura[] = [];
let log = '';

let enemyProximityList: {[key: number]: number[]} = {
    0: [5, 6, 10, 7, 11, 8, 12, 9],
    1: [6, 7, 11, 8, 12, 5, 9, 10],
    2: [5, 9, 6, 10, 7, 11, 8, 12],
    3: [6, 10, 7, 11, 5, 12, 8, 9],
    4: [7, 11, 8, 12, 6, 10, 5, 9],
    5: [2, 3, 0, 1, 4],
    6: [2, 3, 4, 0, 1],
    7: [3, 4, 2, 1, 0],
    8: [4, 3, 1, 0, 2],
    9: [2, 3, 0, 1, 4],
    10: [2, 3, 4, 0, 1],
    11: [2, 3, 4, 1, 0],
    12: [3, 4, 1, 0, 2],
}

let allyProximityList: {[key: number]: number[]} = {
    0: [2, 3, 1, 4],
    1: [3, 4, 0, 2],
    2: [3, 0, 4, 1],
    3: [2, 4, 0, 1],
    4: [3, 1, 2, 0],
    5: [6, 9, 10, 7, 11, 8, 12],
    6: [5, 7, 10, 9, 11, 8, 12],
    7: [6, 8, 11, 10, 12, 5, 9],
    8: [7, 12, 11, 6, 10, 5, 9],
    9: [5, 10, 6, 7, 11, 8, 12],
    10: [6, 9, 11, 5, 7, 8, 12],
    11: [7, 10, 12, 6, 8, 5, 9],
    12: [8, 11, 7, 6, 10, 5, 9],
}

let enemyAdjacencyList: {[key: number]: number[][]} = {
    0: [[5, 6, 7], [9, 10, 11], [8], [12]],
    1: [[6, 7, 8], [10, 11, 12], [5], [9]],
    2: [[5, 6], [9, 10], [7], [11], [8], [12]],
    3: [[6, 7], [10, 11], [5], [9], [8], [12]],
    4: [[7, 8], [11, 12], [6], [10], [5], [9]],
    5: [[2], [3], [4], [0], [1]],
    6: [[2, 3], [4], [0], [1]],
    7: [[3, 4], [2], [1], [0]],
    8: [[4], [3], [2], [1], [0]],
    9: [[2], [3], [4], [0], [1]],
    10: [[2, 3], [4], [0], [1]],
    11: [[3, 4], [2], [1], [0]],
    12: [[4], [3], [2], [1], [0]],
}

let companionPositions = [0, 1, 2, 3, 4];
let encounterPositions = [5, 6, 7, 8, 9, 10, 11, 12];

let meleePositions = [2, 3, 4, 5, 6, 7, 8];

function mapSpell(spellId: number): combatSpell {
    let spellInfo = (spellData as any)[spellId];
    return {
        cooldown: spellInfo.cooldown,
        targets: spellInfo.targets,
        effects: spellInfo.effects.slice(0),
        cooldownRemaining: spellInfo.delay || 0
    };
}

let meleeAttack = mapSpell(11);
let rangedAttack = mapSpell(15);

function loadExtraData(baseData: combatantData, entries: combatantInfo[]): combatant {
    for(let entry of entries) {
        if(entry.name === baseData.name) {
            let spells: combatSpell[] = [];
            for(let spellId of entry.spells) {
                spells.push(mapSpell(spellId));
            }
            return {
                melee: entry.melee,
                spells,
                name: baseData.name,
                boardIndex: baseData.boardIndex,
                currentHealth: baseData.currentHealth,
                maxHealth: baseData.maxHealth,
                attack: baseData.attack,
            };
        }
    }
    return null;
}

function dealDamage(caster: combatant, target: combatant, amount: number) {
    let attackFactor = 1;
    let damageTakenFactor = 1;
    let damageTakenBonus = 0;

    let casterAuras = auras.filter(a => a.target === caster);
    let targetAuras = auras.filter(a => a.target === target);

    for(let aura of casterAuras) {
        if(!aura.isDot) {
            attackFactor += (aura as effectAura).attackFactor;
            amount += Math.floor((aura as effectAura).attackBonusAmount * aura.caster.attack);
        }
    }

    for(let aura of targetAuras) {
        if(!aura.isDot) {
            damageTakenFactor += (aura as effectAura).damageTakenFactor;
            damageTakenBonus += Math.floor((aura as effectAura).damageTakenBonusAmount * aura.caster.attack);
        }
    }

    amount = Math.floor(amount * attackFactor * damageTakenFactor) + damageTakenBonus;

    log += `\tDealing ${amount} damage to ${target.name} (${target.boardIndex})\n`;
    target.currentHealth = Math.max(0, target.currentHealth - amount);

    if(target.currentHealth === 0) {
        let auraId = 0;
        while(auraId < auras.length) {
            let aura = auras[auraId];
            if(aura.caster === target && aura.duration === -1) {
                auras.splice(auraId, 1);
            }
            else {
                auraId++;
            }
        }
    }
}

function isValidTargetId(id: number) {
    return combatants[id] && combatants[id].currentHealth > 0;
}

function firstValidTargetId(ids: number[]) {
    for(let id of ids) {
        if(isValidTargetId(id)) {
            return [combatants[id]];
        }
    }
}

const targetFunctions: {[key: string]: (caster:combatant) => combatant[]} = {
    'self': (caster) => {
        return [caster];
    },
    'closest-enemy': (caster) => {
        return firstValidTargetId(enemyProximityList[caster.boardIndex]);
    },
    'farthest-enemy': (caster) => {
        return firstValidTargetId(enemyProximityList[caster.boardIndex].slice(0).reverse());
    },
    'all-enemies': (caster) => {
        let possible = [];
        if(caster.boardIndex <= 4) {
            possible = encounterPositions;
        }
        else {
            possible = companionPositions;
        }
        return possible.filter(isValidTargetId).map(e => combatants[e]);
    },
    'all-melee-enemies': (caster) => {
        let allEnemies = targetFunctions['all-enemies'](caster);
        let meleeEnemies = allEnemies.filter(e => meleePositions.indexOf(e.boardIndex) !== -1);
        if(meleeEnemies.length) {
            return meleeEnemies;
        }
        return allEnemies;
    },
    'all-adjacent-enemies': (caster) => {
        let list = enemyAdjacencyList[caster.boardIndex];
        for(let subList of list) {
            let results = subList.filter(isValidTargetId).map(e => combatants[e]);
            if(results.length) {
                return results;
            }
        }
    },
    'closest-enemy-cone': (caster) => {
        return targetFunctions['closest-enemy'](caster);    //This needs more work, once data is available
    },
    'closest-ally': (caster) => {
        return firstValidTargetId(allyProximityList[caster.boardIndex]);
    },
    'all-allies': (caster) => {
        let possible = [];
        if(caster.boardIndex <= 4) {
            possible = companionPositions;
        }
        else {
            possible = encounterPositions;
        }
        return possible.filter(isValidTargetId).map(e => combatants[e]);
    },
    'all-other-allies': (caster) => {
        return targetFunctions['all-allies'](caster).filter(a => a !== caster);
    }
};

function getTargets(caster: combatant, targetType: string) {
    if(!targetFunctions[targetType]) {
        console.log('Unrecognized target type ' + targetType);
        process.exit(1);
    }
    return targetFunctions[targetType](caster) || [];
}

const effectFunctions: {[key: string]: (caster: combatant, target: combatant, effect: spellEffect) => void} = {
    damage: (caster, target, effect: damageSpellEffect) => {
        let damageAmount = Math.floor(effect.amount * caster.attack);
        dealDamage(caster, target, damageAmount);
    },
    heal: (caster, target, effect: healSpellEffect) => {
        let healAmount = effect.amount * caster.attack;
        target.currentHealth = Math.min(target.maxHealth, target.currentHealth + healAmount);
        log += `\tHealing ${target.name} (${target.boardIndex}) for ${healAmount}`;
    },
    dot: (caster, target, effect: dotSpellEffect) => {
        let damageAmount = Math.floor(effect.amount * caster.attack);
        let aura: dotAura = {
            isDot: true,
            target: target,
            caster: caster,
            duration: effect.duration,
            period: effect.period || 1,
            amount: damageAmount,
            delay: effect.delay || 0
        };
        auras.push(aura);

        log += `\tAdding dot to ${target.name} (${target.boardIndex})\n`;

        if(aura.delay === 0) {
            dealDamage(caster, target, damageAmount);
            aura.delay = aura.period;
        }
    },
    aura: (caster, target, effect: auraSpellEffect) => {
        let aura: effectAura = {
            isDot: false,
            target: target,
            caster: caster,
            duration: effect.duration,
            attackFactor: effect.attackFactor || 0,
            attackBonusAmount: effect.attackBonusAmount || 0,
            damageTakenFactor: effect.damageTakenFactor || 0,
            damageTakenBonusAmount: effect.damageTakenBonusAmount || 0,
            healthBonusAmount: effect.healthBonusAmount || 0,
            counterDamageAmount: effect.counterDamageAmount || 0,
        }
        target.maxHealth += aura.healthBonusAmount;
        log += `\tAdding aura to ${target.name} (${target.boardIndex})\n`;
        auras.push(aura);
    },
};

function useSpell(caster: combatant, spell: combatSpell) {
    let spellTargets = getTargets(caster, spell.targets);

    for(let effect of spell.effects) {
        let effectTargets: combatant[];
        if(effect.targets) {
            effectTargets = getTargets(caster, effect.targets);
        }
        else {
            effectTargets = spellTargets;
        }

        if(!effectTargets.length) {
            log += 'No valid targets found\n';
        }

        for(let target of effectTargets) {
            effectFunctions[effect.type](caster, target, effect);
        }
    }
    spell.cooldownRemaining = spell.cooldown;
}

function processTurn(combatant: combatant) {
    log += `Starting turn for ${combatant.name} (${combatant.boardIndex})\n`;
    let auraId = 0;
    while(auraId < auras.length) {
        let aura = auras[auraId];
        if(aura.caster === combatant) {
            if(aura.isDot) {
                aura.delay--;
                if(aura.delay === 0) {
                    log += '\tDot tick: '
                    dealDamage(aura.caster, aura.target, aura.amount);
                    aura.delay = aura.period;
                }
            }
            if(aura.duration > 0) {
                aura.duration--;
            }
            if(aura.duration === 0) {
                auras.splice(auraId, 1);
                log += '\tAura fades\n'
            }
            else {
                auraId++;
            }
        }
        else {
            auraId++;
        }
    }

    if(combatant.currentHealth > 0) {
        log +='\tAttacking:\n'
        if(combatant.melee) {
            useSpell(combatant, meleeAttack);
        }
        else {
            useSpell(combatant, rangedAttack);
        }

        for(let spell of combatant.spells) {
            if(spell.cooldown !== 0 && spell.cooldownRemaining <= 0) {
                log += '\tCasting spell:\n'
                useSpell(combatant, spell);
            }
            else {
                spell.cooldownRemaining--;
            }
        }
    }
}

function sortTurnOrder(combatants: combatant[]) {
    return combatants.sort((a, b) => b.currentHealth - a.currentHealth || a.boardIndex - b.boardIndex);
}

async function validateFile(fileName: string) {
    let mission = JSON.parse(await fs.readFile(fileName, 'utf-8')) as missionData;

    let trackedFollowers = parseFollowers(mission);
    let followers: {[key: number]: combatant} = {};

    for(let i in trackedFollowers) {
        let fullFollower = loadExtraData(trackedFollowers[i], companionData.companions);
        if(!fullFollower) {
            fullFollower = loadExtraData(trackedFollowers[i], troopData.troops);
        }
        followers[i] = fullFollower;
    }
    let trackedEnemies = parseEnemies(mission);
    let enemies: {[key: number]: combatant} = {};
    for(let i in trackedEnemies) {
        enemies[i] = loadExtraData(trackedEnemies[i], enemyData.enemies);
    }

    combatants = {...followers, ...enemies};
    let trackedCombatants = {...trackedFollowers, ...trackedEnemies};

    let round = 0;
    let finished = false;

    let followerOrder = sortTurnOrder(Object.values(followers));
    for(let follower of followerOrder) {
        for(let spell of follower.spells) {
            if(spell.cooldown === 0) {
                useSpell(follower, spell);
            }
        }
    }
    let enemyOrder = sortTurnOrder(Object.values(enemies));
    for(let enemy of enemyOrder) {
        for(let spell of enemy.spells) {
            if(spell.cooldown === 0) {
                useSpell(enemy, spell);
            }
        }
    }

    while(!finished) {
        log += (`****Round ${round + 1} ****\n`);
        let followerOrder = sortTurnOrder(Object.values(followers));
        let enemyOrder = sortTurnOrder(Object.values(enemies));

        for(let follower of followerOrder) {
            processTurn(follower);
        }

        for(let enemy of enemyOrder) {
            processTurn(enemy);
        }

        let alive = false;
        for(let follower of followerOrder) {
            if(follower.currentHealth > 0) {
                alive = true;
            }
        }
        if(!alive) {
            finished = true;
        }

        alive = false;
        for(let enemy of enemyOrder) {
            if(enemy.currentHealth > 0) {
                alive = true;
            }
        }
        if(!alive) {
            finished = true;
        }

        for(let event of mission.result.combatLog[round].events) {
            for(let target of event.targetInfo) {
                trackedCombatants[target.boardIndex].currentHealth = target.newHealth;
                trackedCombatants[target.boardIndex].maxHealth = target.maxHealth;
            }
        }
        round++;

        for(let id in combatants) {
            let tracked = trackedCombatants[id];
            let simulated = combatants[id];
            if(tracked.currentHealth !== simulated.currentHealth || tracked.maxHealth !== simulated.maxHealth) {
                console.log(log);
                console.log(`Desync after round ${round}. Combatant ID ${id} health should be ${tracked.currentHealth}/${tracked.maxHealth} but is ${simulated.currentHealth}/${simulated.maxHealth}`);
                process.exit(1);
            }
        }
    }

    console.log(`Done, valid after ${round} rounds`);
}