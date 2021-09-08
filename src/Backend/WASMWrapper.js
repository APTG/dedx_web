const __wasm = __init_wasm()

//#region TODO:
function __init_wasm() { }
//#endregion TODO

//#region MOCK
//#region GET
export function getTrace(particle, propagationMedium) {
    if (__wasm) 
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


