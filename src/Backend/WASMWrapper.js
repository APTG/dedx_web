import Module from './weblibdedx.js'

let _wasm;

async function _init_wasm(){
    _wasm = await Module()
}

//#region MOCK
//#region GET
export function getTrace(particle, propagationMedium) {
    return {
        x: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        y: Array.from(new Array(10),_=>Math.random()*100)
    }
}

export async function getPrograms() {
    if(!_wasm) await _init_wasm()
    return _wasm._dedx_get_all_programs()
}

export function getParticles() {
    return ['He', 'O', 'C', 'N']
}

export function getMaterials() {
    return ['Water', 'Air', 'Earth', 'Fire']
}
//#endregion GET
//#endregion MOCK


