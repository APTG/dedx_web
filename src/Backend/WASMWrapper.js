import Module from './weblibdedx.js'

//#region TODO:
function __init_wasm() { }
//#endregion TODO

//#region MOCK
//#region GET
export function getTrace(particle, propagationMedium) {
    return {
        x: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        y: Array.from(new Array(10),_=>Math.random()*100)
    }
}

export async function getParticles() {
    Module().then(mod=>{
        const programs = mod.getAllPrograms()
        for(let i=0;i<programs.size();i++){
            console.log(programs.get(i).repr)
        }
    }).catch(err=>{
        console.log(err)
    })
}

export function getMaterials() {
    return ['Water', 'Air', 'Earth', 'Fire']
}
//#endregion GET
//#endregion MOCK


