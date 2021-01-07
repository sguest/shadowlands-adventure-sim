export interface spellData {
    id: number
    name: string
}

export interface combatantData {
    name: string
    boardIndex: number
    maxHealth: number
    currentHealth: number
    attack: number
    spells: {[key: number]: spellData}
}

export interface followerData extends combatantData {
    level: number
}

export interface enemyData extends combatantData {
}

export function parseFollowers(mission: missionData): {[key: number]: followerData} {
    let followers: {[key: number]: followerData} = {};

    for(let followerId in mission.followers) {
        let data = mission.followers[followerId];
        let spells: {[key: number]: spellData} = {};
        
        for(let spellData of data.spells) {
            let spell: spellData = {
                id: spellData.autoCombatSpellID,
                name: spellData.name,
            };
            spells[spell.id] = spell;
        }

        let follower: followerData = {
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

    return followers;
}

export function parseEnemies(mission: missionData): {[key: number]: enemyData} {
    let enemies: {[key: number]: enemyData} = {};

    for(let encounter of mission.encounters) {
        let spells: {[key: number]: spellData} = {};

        for(let spellData of encounter.autoCombatSpells) {
            let spell: spellData = {
                id: spellData.autoCombatSpellID,
                name: spellData.name,
            };
            spells[spell.id] = spell;
        }

        let enemy: enemyData = {
            name: encounter.name,
            boardIndex: encounter.boardIndex,
            maxHealth: encounter.maxHealth,
            currentHealth: encounter.health,
            attack: encounter.attack,
            spells,
        };
        enemies[enemy.boardIndex] = enemy;
    }

    return enemies;
}