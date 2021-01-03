const fs = require('fs/promises');
const path = require('path');
const luainjs = require('lua-in-js');

function cleanObject(obj) {
    if(typeof obj === 'object') {
        if(obj.numValues.length > 1) {
            return obj.numValues.slice(1).map(cleanObject);
        }
        else {
            let returnValue = {};
            for(let key in obj.strValues) {
                returnValue[key] = cleanObject(obj.strValues[key]);
            }
            return returnValue;
        }
    }
    else {
        return obj;
    }
}

(async function() {
    let wowPath = undefined;
    try {
        wowPath = await fs.readFile(path.resolve(__dirname, 'wowfolder.txt'), 'utf-8');
    }
    catch(e) {
        if(e.code === 'ENOENT') {
            console.log('Unable to determine WoW installation path');
            console.log('Please ensure the root folder contains a file named wowfolder.txt whose contents are the path to your installation folder.');
        }
        else {
            console.log(e);
        }

        process.exit(1);
    }

    let accountsPath = path.resolve(wowPath, '_retail_\\WTF\\Account');
    try {
        let accounts = (await fs.readdir(accountsPath, {withFileTypes: true})).filter(x => x.isDirectory()).map(x => x.name);

        for(let account of accounts) {
            if(account !== 'SavedVariables') {
                let savedVarsPath = path.resolve(accountsPath, account, 'SavedVariables\\AdventureLogger.lua');

                try {
                    let contents = await fs.readFile(savedVarsPath, 'utf-8');

                    const luaEnv = luainjs.createEnv();
                    const luaScript = luaEnv.parse(contents + '\nreturn AL_Logs');
                    let result = cleanObject(luaScript.exec());

                    let errors = false;

                    for(let mission of result) {
                        if(mission) {
                            let missionName = mission.missionInfo.name.replace(/[^a-zA-Z0-9 ]/, '');
                            let fileName = `${Date.now()} - ${missionName}`;
                            let folderPath = path.resolve(__dirname, 'parsedFiles');
                            let filePath = path.resolve(folderPath, fileName + '.json');
                            try {
                                await fs.mkdir(folderPath, { recursive: true});
                                await fs.writeFile(filePath, JSON.stringify(mission, null, 4));
                            }
                            catch(e) {
                                console.log('Error saving result file');
                                console.log(e);
                                errors = true;
                            }
                        }
                    }

                    if(!errors) {
                        try {
                            await fs.writeFile(savedVarsPath, '');
                        }
                        catch(e) {
                            console.log('failed to clean out saved variables for account '+ account);
                            console.log(e);
                        }
                    }
                } catch(e) {
                    if(e.code === 'ENOENT') {
                        console.log(savedVarsPath);
                        console.log('No data found for account ' + account);
                    }
                    else {
                        console.log(e);
                        process.exit(1);
                    }
                }
            }
        }
    }
    catch(e) {
        console.log('Could not load data from path ' + wowPath);
        console.log(e);
        process.exit(1);
    }
}())
