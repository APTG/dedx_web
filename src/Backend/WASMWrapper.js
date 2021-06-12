const __wasm = __init_wasm()

//#region TODO:
function __init_wasm(){}
//#endregion TODO

//#region MOCK
//#region GET
export function getTrace(particle, propagationMedium){ if(__wasm) console.log("wasm"); return[]}

export function getParticles(){
    return ['He', 'O', 'C', 'N']
}

export function getMaterials(){
    return ['Water', 'Air', 'Earth', 'Fire']
}
//#endregion GET
//#endregion MOCK


 