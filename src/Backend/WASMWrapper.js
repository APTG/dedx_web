import Module from './weblibdedx.js'

let _wasm; // skipcq: JS-0119

async function _init_wasm(){
    _wasm = await Module()
}

// ensures WASM is loaded and the function is compiled and reachable.
async function getFromWASM(name){
    if(!_wasm) await _init_wasm()
    if(_wasm[name]) return _wasm[name]()
}

export async function getPrograms() {
    if(!_wasm) await _init_wasm()
    return getFromWASM("_dedx_get_all_programs")
}
//#region MOCK
//#region GET
export function getTrace(particle, propagationMedium) {
    return {
        x: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        y: Array.from(new Array(10),_=>Math.random()*100)
    }
}

export function getParticles() {
    return ['He', 'O', 'C', 'N']
}

export function getMaterials() {
    return ['Water', 'Air', 'Earth', 'Fire']
}
//#endregion GET
//#endregion MOCK


