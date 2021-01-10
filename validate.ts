/// <reference path="./@types/imported.d.ts" />

import * as fs from 'fs/promises';
import * as path from 'path';

import { parseFollowers, parseEnemies, combatantData } from './util/parser';
import * as spellData from './data/spells.json';
import * as troopData from './data/troops.json';
import * as companionData from './data/companions.json';
import * as enemyData from './data/enemies.json';
import * as missionData from './data/missions.json';

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
    amount?: number
    percentAmount?: number
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
    id: number,
    name: string,
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

async function processFiles() {
    let directory: string = '';
    try {
        directory = path.resolve(__dirname, 'parsedFiles');
        let files = await fs.readdir(directory);
    
        for(let file of files) {
            await validateFile(path.resolve(directory, file));
        }
    }
    catch(e) {
        console.log(`Failed to read parsed files directory at ${directory}`);
        console.log(e);
    }
}

processFiles();

let combatants: {[key: number]: combatant};
let auras: aura[];
let log: string;
let missingSpells: number[] = [];
let round: number;
let mission: missionData;

let enemyProximityList: {[key: number]: number[]} = {
    0: [5, 6, 10, 7, 11, 8, 9, 12],
    1: [6, 7, 11, 8, 12, 5, 9, 10],
    2: [5, 6, 9, 10, 7, 11, 8, 12],
    3: [6, 7, 5, 10, 11, 12, 8, 9],
    4: [7, 8, 11, 12, 6, 10, 5, 9],
    5: [2, 3, 0, 1, 4],
    6: [2, 3, 0, 1, 4],
    7: [3, 4, 1, 0, 2],
    8: [4, 3, 1, 0, 2],
    9: [2, 3, 0, 1, 4],
    10: [2, 3, 4, 0, 1],
    11: [2, 3, 4, 0, 1],
    12: [3, 4, 0, 1, 2],
}

let enemyRangedProximityList: {[key: number]: number[]} = {
    0: [12, 9, 8, 11, 10, 7, 6, 5],
    1: [9, 5, 10, 12, 11, 6, 8, 7],
    2: [12, 8, 11, 7, 10, 6, 9, 5],
    3: [9, 5, 8, 12, 11, 10, 6, 7],
    4: [9, 5, 10, 6, 12, 11, 7, 8],
    5: [4, 1, 0, 3, 2],
    6: [4, 1, 0, 3, 2],
    7: [2, 0, 1, 4, 3],
    8: [2, 0, 1, 3, 4],
    9: [4, 1, 0, 3, 2],
    10: [1, 0, 4, 3, 2],
    11: [0, 1, 4, 3, 2],
    12: [2, 0, 1, 4, 3],
}

let allyProximityList: {[key: number]: number[]} = {
    0: [2, 3, 1, 4, 0],
    1: [3, 4, 0, 2, 1],
    2: [3, 0, 4, 1, 2],
    3: [2, 4, 0, 1, 3],
    4: [3, 1, 2, 0, 4],
    5: [6, 9, 10, 7, 11, 8, 12, 5],
    6: [5, 7, 10, 9, 11, 8, 12, 6],
    7: [6, 8, 11, 10, 12, 5, 9, 7],
    8: [7, 12, 11, 6, 10, 5, 9, 8],
    9: [5, 10, 6, 7, 11, 8, 12, 9],
    10: [6, 9, 11, 5, 7, 8, 12, 10],
    11: [7, 10, 12, 6, 8, 5, 9, 11],
    12: [8, 11, 7, 6, 10, 5, 9, 12],
}

let enemyAdjacencyList: {[key: number]: number[][]} = {
    0: [[5, 6, 7], [9, 10, 11], [8], [12]],
    1: [[6, 7, 8], [10, 11, 12], [5], [9]],
    2: [[5, 6], [9, 10], [7], [11], [8], [12]],
    3: [[6, 7], [9, 10, 11], [5], [8], [12]],
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

let allyAdjacencyList: {[key: number]: number[][]} = {
    0: [[2, 3, 1], [4]],
    1: [[0, 3, 4], [2]],
    2: [[0, 3], [1, 4]],
    3: [[0, 1, 2, 4]],
    4: [[1, 3], [0, 2]],
    5: [[6, 9, 10], [7, 11], [8, 12]],
    6: [[5, 7, 9, 10, 11], [8, 12]],
    7: [[6, 8, 10, 11, 12], [5, 9]],
    8: [[7, 11, 12], [6, 10], [5, 9]],
    9: [[5, 6, 10], [7, 11], [8, 12]],
    10: [[5, 6, 7, 9, 11], [8, 12]],
    11: [[6, 7, 8, 10, 12], [5, 9]],
    12: [[7, 8, 11], [6, 10], [5, 9]],
}

let companionPositions = [0, 1, 2, 3, 4];
let encounterPositions = [5, 6, 7, 8, 9, 10, 11, 12];

let meleePositions = [2, 3, 4, 5, 6, 7, 8];

let linePositions: {[key: number]: number[]} = {
    5: [5, 9],
    6: [6, 10],
    7: [7, 11],
    8: [8, 12],
    9: [5, 9],
    10: [6, 10],
    11: [7, 11],
    12: [8, 12],
};

let conePositions: {[key: number]: number[]} = {
    0: [0],
    1: [1],
    2: [0, 2],
    3: [0, 1, 3],
    4: [1, 4],
    5: [5, 9, 10],
    6: [6, 9, 10, 11],
    7: [7, 10, 11, 12],
    8: [8, 11, 12],
    9: [9],
    10: [10],
    11: [11],
    12: [12],
};

function mapSpell(spellId: number): combatSpell {
    let spellInfo = (spellData as any)[spellId];
    if(!spellInfo) {
        missingSpells.push(spellId);
        return {
            id: spellId,
            name: '',
            cooldown: 0,
            targets: '',
            effects: [],
            cooldownRemaining: 0,
        }
    }
    return {
        id: spellId,
        name: spellInfo.name,
        cooldown: spellInfo.cooldown,
        targets: spellInfo.targets,
        effects: spellInfo.effects.slice(0),
        cooldownRemaining: spellInfo.delay || 0,
    };
}

let meleeAttack = mapSpell(11);
let rangedAttack = mapSpell(15);

function loadMissingCombatant(missionData: missionData, combatantData: combatantData) {
    let boardIndex = combatantData.boardIndex;
    let melee: boolean;

    for(let entry of missionData.result.combatLog[0].events) {
        if(entry.casterBoardIndex === boardIndex && (entry.spellID === 11 || entry.spellID === 15)) {
            melee = (entry.spellID === 11);
        }
    }

    for(let spellId in combatantData.spells) {
        mapSpell(parseInt(spellId));
    }

    return {
        name: combatantData.name,
        melee,
        spells: Object.keys(combatantData.spells).map(parseInt),
    }
}

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

function dealDamage(caster: combatant, target: combatant, amount: number, allowCounter?: boolean) {
    let attackFactor = 1;
    let damageTakenFactor = 1;
    let damageTakenBonus = 0;

    let casterAuras = auras.filter(a => a.target === caster);
    let targetAuras = auras.filter(a => a.target === target);

    for(let aura of casterAuras) {
        if(!aura.isDot) {
            attackFactor += (aura as effectAura).attackFactor;
            amount += Math.trunc((aura as effectAura).attackBonusAmount * aura.caster.attack);
        }
    }

    for(let aura of targetAuras) {
        if(!aura.isDot) {
            damageTakenFactor += (aura as effectAura).damageTakenFactor;
            damageTakenBonus += Math.trunc((aura as effectAura).damageTakenBonusAmount * aura.caster.attack);
        }
    }

    amount = Math.max(Math.floor(amount * attackFactor * damageTakenFactor) + damageTakenBonus, 0);

    if(!target) {
        console.log('Caster: ' + JSON.stringify(caster) + ' amount: ' + amount);
    }
    log += `\tDealing ${amount} damage to ${target.name} (${target.boardIndex})\n`;
    target.currentHealth = Math.max(0, target.currentHealth - amount);

    if(target.currentHealth === 0) {
        log += `\t${target.name} (${target.boardIndex}) dies\n`;
        let auraId = 0;
        while(auraId < auras.length) {
            let aura = auras[auraId];
            if(aura.caster === target && aura.duration === -1) {
                log += `\tAura cast by ${aura.caster.name} (${aura.caster.boardIndex}) faded from ${aura.target.name} (${aura.target.boardIndex})\n`;
                auras.splice(auraId, 1);
            }
            else {
                auraId++;
            }
        }
    }
    else if(allowCounter) {
        let counterDamageAmount = 0;
        for(let aura of auras.filter(a => a.target === target)) {
            if(!aura.isDot) {
                counterDamageAmount += Math.trunc((aura as effectAura).counterDamageAmount * target.attack);
            }
        }
        if(counterDamageAmount > 0) {
            log += '\tCounterattack\n';
            dealDamage(target, caster, counterDamageAmount);
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

const targetFunctions: {[key: string]: (caster: combatant, spellId?: number, effectIndex?: number) => combatant[]} = {
    'self': (caster) => {
        return [caster];
    },
    'closest-enemy': (caster) => {
        return firstValidTargetId(enemyProximityList[caster.boardIndex]);
    },
    'farthest-enemy': (caster) => {
        return firstValidTargetId(enemyRangedProximityList[caster.boardIndex]);
    },
    'random-enemy': (caster: combatant, spellId: number, effectIndex: number) => {
        for(let event of mission.result.combatLog[round].events) {
            if(event.casterBoardIndex === caster.boardIndex && event.spellID === spellId && event.effectIndex === effectIndex) {
                return [combatants[event.targetInfo[0].boardIndex]];
            }
        }
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
    'all-ranged-enemies': (caster) => {
        let allEnemies = targetFunctions['all-enemies'](caster);
        let rangedEnemies = allEnemies.filter(a => meleePositions.indexOf(a.boardIndex) === -1);
        if(rangedEnemies.length) {
            return rangedEnemies;
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
        let closest = targetFunctions['closest-enemy'](caster);
        return conePositions[closest[0].boardIndex].filter(isValidTargetId).map(e => combatants[e]);
    },
    'closest-enemy-line': (caster) => {
        let closestEnemy = targetFunctions['closest-enemy'](caster)[0];
        return linePositions[closestEnemy.boardIndex].filter(isValidTargetId).map(e => combatants[e]);
    },
    'closest-ally': (caster) => {
        return firstValidTargetId(allyProximityList[caster.boardIndex]);
    },
    'random-ally': (caster: combatant, spellId: number, effectIndex: number) => {
        for(let event of mission.result.combatLog[round].events) {
            if(event.casterBoardIndex === caster.boardIndex && event.spellID === spellId && event.effectIndex === effectIndex) {
                return [combatants[event.targetInfo[0].boardIndex]];
            }
        }
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
    },
    'all-other-melee-allies': caster => {
        let allAllies = targetFunctions['all-allies'](caster);
        let meleeAllies = allAllies.filter(a => meleePositions.indexOf(a.boardIndex) !== -1);
        if(meleeAllies.length === 1 && meleeAllies[0] === caster) {
            return meleeAllies;
        }
        meleeAllies = meleeAllies.filter(a => a !== caster);
        if(meleeAllies.length) {
            return meleeAllies;
        }
        if(allAllies.length === 1 && allAllies[0] === caster) {
            return allAllies;
        }
        return allAllies.filter(a => a !== caster);
    },
    'all-adjacent-allies': (caster) => {
        let list = allyAdjacencyList[caster.boardIndex];
        for(let subList of list) {
            let results = subList.filter(isValidTargetId).map(e => combatants[e]);
            if(results.length) {
                return results;
            }
        }
    },
    'all-ranged-allies': (caster) => {
        let allAllies = targetFunctions['all-allies'](caster);
        let rangedAllies = allAllies.filter(a => meleePositions.indexOf(a.boardIndex) === -1);
        if(rangedAllies.length) {
            return rangedAllies;
        }
        return allAllies;
    }
};

function getTargets(caster: combatant, targetType: string, spellId: number, effectIndex: number) {
    if(!targetFunctions[targetType]) {
        log += `Unrecognized target type ${targetType}\n`;
        return [];
    }
    return targetFunctions[targetType](caster, spellId, effectIndex) || [];
}

const effectFunctions: {[key: string]: (caster: combatant, target: combatant, effect: spellEffect) => void} = {
    damage: (caster, target, effect: damageSpellEffect) => {
        let damageAmount = Math.floor(effect.amount * caster.attack);
        dealDamage(caster, target, damageAmount, true);
    },
    heal: (caster, target, effect: healSpellEffect) => {
        let healAmount = 0;
        if(effect.amount) {
            healAmount = effect.amount * caster.attack;
        }
        else if(effect.percentAmount) {
            healAmount = effect.percentAmount * target.maxHealth
        }
        else {
            log += 'ERROR: Invalid healing spell without amount or percent amount specified\n';
        }
        healAmount = Math.max(Math.floor(healAmount), 0);
        target.currentHealth = Math.min(target.maxHealth, target.currentHealth + healAmount);
        log += `\tHealing ${target.name} (${target.boardIndex}) for ${healAmount}\n`;
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
        let maxHealthAmount = Math.trunc(caster.attack * aura.healthBonusAmount);
        target.maxHealth += maxHealthAmount;
        target.currentHealth += maxHealthAmount;
        log += `\tAdding aura to ${target.name} (${target.boardIndex})\n`;
        auras.push(aura);
    },
};

function useSpell(caster: combatant, spell: combatSpell) {
    let spellTargetType = spell.targets;

    for(let effectIndex = 0; effectIndex < spell.effects.length; effectIndex++) {
        let effect = spell.effects[effectIndex];
        let effectTargetType = effect.targets || spellTargetType;
        let effectTargets = getTargets(caster, effectTargetType, spell.id, effectIndex)

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
    if(!checkFinished()) {
        log += `Starting turn for ${combatant.name} (${combatant.boardIndex})\n`;
        let auraId = 0;
        while(auraId < auras.length) {
            let aura = auras[auraId];
            if(aura.caster === combatant) {
                if(aura.isDot) {
                    aura.delay--;
                    if(aura.delay === 0) {
                        if(aura.target.currentHealth > 0) {
                            log += '\tDot tick:\n'
                            dealDamage(aura.caster, aura.target, aura.amount);    
                        }
                        aura.delay = aura.period;
                    }
                }
                if(aura.duration > 0) {
                    aura.duration--;
                }
                if(aura.duration === 0) {
                    // Max health is only removed when aura fades if target is still alive. Feels like a bug, but that's how logs show it
                    if(!aura.isDot && aura.target.currentHealth > 0) {
                        aura.target.maxHealth -= Math.trunc(aura.caster.attack * (aura as effectAura).healthBonusAmount);
                    }
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
            if(combatant.melee) {
                log +='\tMelee attack:\n'
                useSpell(combatant, meleeAttack);
            }
            else {
                log +='\tRanged attack:\n'
                useSpell(combatant, rangedAttack);
            }

            for(let spell of combatant.spells) {
                // Have to check this each time, it's possible to die mid-turn to counterattacks
                if(combatant.currentHealth > 0 && !checkFinished()) {
                    if(spell.cooldown !== 0 && spell.cooldownRemaining <= 0) {
                        log += `\tCasting spell ${spell.name}:\n`
                        useSpell(combatant, spell);
                    }
                    else {
                        spell.cooldownRemaining--;
                    }
                }
            }
        }
    }
}

function sortTurnOrder(combatants: combatant[]) {
    return combatants.sort((a, b) => b.currentHealth - a.currentHealth || a.boardIndex - b.boardIndex);
}

function checkFinished() {
    let allyAlive = false;
    let enemyAlive = false;

    for(let id in combatants) {
        if(combatants[id].currentHealth > 0) {
            if(parseInt(id) <= 4) {
                allyAlive = true;
            }
            else {
                enemyAlive = true;
            }
        }
    }

    return !allyAlive || !enemyAlive;
}

async function validateFile(fileName: string) {
    auras = [];
    log = '';
    missingSpells = [];
    mission = JSON.parse(await fs.readFile(fileName, 'utf-8')) as missionData;

    let trackedFollowers = parseFollowers(mission);
    let followers: {[key: number]: combatant} = {};

    let missingFollowers: any[] = [];
    for(let i in trackedFollowers) {
        let fullFollower = loadExtraData(trackedFollowers[i], companionData.companions);
        if(!fullFollower) {
            fullFollower = loadExtraData(trackedFollowers[i], troopData.troops);
        }
        if(!fullFollower) {
            if(!missingFollowers.some(f => f.name === trackedFollowers[i].name)) {
                missingFollowers.push(loadMissingCombatant(mission, trackedFollowers[i]));
            }
        }
        else {
            followers[i] = fullFollower;
        }
    }
    let trackedEnemies = parseEnemies(mission);
    let enemies: {[key: number]: combatant} = {};
    let missingEnemies: any[] = [];
    for(let i in trackedEnemies) {
        enemies[i] = loadExtraData(trackedEnemies[i], enemyData.enemies);
        if(!enemies[i]) {
            if(!missingEnemies.some(f => f.name === trackedEnemies[i].name)) {
                missingEnemies.push(loadMissingCombatant(mission, trackedEnemies[i]));
            }
        }
    }

    let missingMission = false;
    if(!(missionData as any)[mission.missionID]) {
        missingMission = true;
    }

    if(missingMission || missingEnemies.length || missingFollowers.length || missingSpells.length) {
        await writeMissingData(fileName, missingMission, mission, missingEnemies, missingFollowers, missingSpells);
        return;
    }

    combatants = {...followers, ...enemies};
    let trackedCombatants = {...trackedFollowers, ...trackedEnemies};

    round = 0;
    let finished = false;

    let followerOrder = sortTurnOrder(Object.values(followers));
    for(let follower of followerOrder) {
        for(let spell of follower.spells) {
            if(spell.cooldown === 0) {
                log += `${follower.name} (${follower.boardIndex}) using pre-buff spell ${spell.name}\n`;
                useSpell(follower, spell);
            }
        }
    }
    let enemyOrder = sortTurnOrder(Object.values(enemies));
    for(let enemy of enemyOrder) {
        for(let spell of enemy.spells) {
            if(spell.cooldown === 0) {
                log += `${enemy.name} (${enemy.boardIndex}) using pre-buff spell ${spell.name}\n`;
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

        finished = checkFinished();

        log += '==End of round summary==\n'
        for(let id in combatants) {
            let combatant = combatants[id];
            log += `\t${combatant.name} (${combatant.boardIndex}) has ${combatant.currentHealth}/${combatant.maxHealth} health\n`;
        }
        log += '\n';

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
                log += `Desync after round ${round}. Combatant ID ${id} health should be ${tracked.currentHealth}/${tracked.maxHealth} but is ${simulated.currentHealth}/${simulated.maxHealth}`;
                await writeFailureData(fileName, log);
                return;
            }
        }
    }

    await writeSuccessData(fileName);
}

async function writeSuccessData(fileName: string) {
    let successFolder = path.resolve(fileName, '../../successFiles');
    await fs.mkdir(successFolder, {recursive: true});
    let basename = path.basename(fileName);
    await fs.rename(fileName, path.resolve(successFolder, basename));
}

async function writeFailureData(fileName: string, log: string) {
    let failureFolder = path.resolve(fileName, '../../failedFiles');
    await fs.mkdir(failureFolder, {recursive: true});
    let basename = path.basename(fileName);
    await fs.writeFile(path.resolve(failureFolder, basename.replace(/\.json$/, '') + '.log.txt'), log);
    await fs.rename(fileName, path.resolve(failureFolder, basename));
}

async function writeMissingData(fileName: string, missingMission: boolean, mission: missionData, missingEnemies: any[], missingFollowers: any[], missingSpells: number[]) {
    let missingFolder = path.resolve(fileName, '../../missingFiles');
    await fs.mkdir(missingFolder, {recursive: true});
    let basename = path.basename(fileName);
    let rootname = basename.replace(/\.json$/, '');
    if(missingMission) {
        let missionData: {[key: number]: any} = {};
        missionData[mission.missionID] = {
            name: mission.missionInfo.name,
            enemies: mission.encounters.map(e => ({name: e.name, position: e.boardIndex})).sort((a, b) => a.position - b.position),
        }
        await fs.writeFile(path.resolve(missingFolder, rootname + '.missions.json'), JSON.stringify(missionData, null, 4));
    }
    if(missingEnemies.length) {
        await fs.writeFile(path.resolve(missingFolder, rootname + '.enemies.json'), JSON.stringify({enemies: missingEnemies}, null, 4));
    }
    if(missingFollowers.length) {
        await fs.writeFile(path.resolve(missingFolder, rootname + '.followers.json'), JSON.stringify({followers: missingFollowers}, null, 4));
    }
    if(missingSpells.length) {
        let spellObj: {[key: number]: any} = {};
        for(let spell of missingSpells) {
            spellObj[spell] = {};
        }
        await fs.writeFile(path.resolve(missingFolder, rootname + '.spells.json'), JSON.stringify(spellObj, null, 4));
    }
    await fs.rename(fileName, path.resolve(missingFolder, basename));
}