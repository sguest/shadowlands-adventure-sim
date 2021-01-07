interface followerData {
    missionInfo: followerMissionInfo
    stats: followerStats
    spells: spellInfo[]
}

interface followerMissionInfo {
    name: string
    boardIndex: number
    level: number
}

interface followerStats {
    maxHealth: number
    currentHealth: number
    attack: number
}

interface encounterData {
    name: string
    boardIndex: number
    maxHealth: number
    health: number
    attack: number
    autoCombatSpells: spellInfo[]
}

interface missionResult {
    winner: boolean
    combatLog: logRound[]
}

interface logRound {
    events: logEntry[]
}

interface logEntry {
    casterBoardIndex: number
    type: number
    schoolMask: number
    spellID: number
    auraType: number
    effectIndex: number
    targetInfo: targetInfo[]
}

interface targetInfo {
    oldHealth: number
    newHealth: number
    maxHealth: number
    boardIndex: number
    points: number
}

interface spellInfo {
    autoCombatSpellID: number
    name: string
}

interface missionData {
    missionId: number
    result: missionResult
    followers: {[key: string]: followerData}
    encounters: encounterData[]
}