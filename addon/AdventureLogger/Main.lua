local _, T = ...
local frame, events = CreateFrame("Frame"), {};

local function GetMissionInfo(missionID)
	local missions = C_Garrison.GetCompleteMissions(123)
	for i=1,#missions do
		if missions[i].missionID == missionID then
			return missions[i]
		end
	end
end

function events:GARRISON_MISSION_COMPLETE_RESPONSE(missionID, canComplete, success, bonusRollSuccess, followerDeaths, autoCombatResult)
    if not autoCombatResult then return end
    if not autoCombatResult.combatLog then return end
    if not C_Garrison.GetFollowerTypeByMissionID(missionID) == 123 then return end

    local logEntry = {
        result = autoCombatResult,
        missionID = missionID,
    }

    logEntry.encounters = C_Garrison.GetMissionCompleteEncounters(missionID)
    logEntry.environment = C_Garrison.GetAutoMissionEnvironmentEffect(missionID)
    logEntry.missionInfo = GetMissionInfo(missionID)

    local followers = {}

    for i=1, #logEntry.missionInfo.followers do
        local followerID = logEntry.missionInfo.followers[i]
        local followerMissionInfo = C_Garrison.GetFollowerMissionCompleteInfo(followerID)
        local stats = C_Garrison.GetFollowerAutoCombatStats(followerID)
        local spells = C_Garrison.GetFollowerAutoCombatSpells(followerID, followerMissionInfo.level)
        followers[followerID] = {
            missionInfo = followerMissionInfo,
            stats = stats,
            spells = spells,
        }
    end
    logEntry.followers = followers

    AL_Logs = AL_Logs or {}
    table.insert(AL_Logs, logEntry)
end

frame:SetScript("OnEvent", function(self, event, ...)
    events[event](self, ...); -- call one of the functions above
    end);
    for k, v in pairs(events) do
    frame:RegisterEvent(k); -- Register all events for which handlers have been defined
end