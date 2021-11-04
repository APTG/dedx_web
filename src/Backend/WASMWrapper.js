import Module from './weblibdedx.js'

export default class WASMWrapper{
    static #_wasm;
    static #programsSize = 20

    static async wasm(){
        if(!this.#_wasm) this.#_wasm = await Module()
        return this.#_wasm
    }

    static async getPrograms(){
        const wasm = await this.wasm()

        const pointer = new Int32Array(new Array(this.#programsSize))
        const buf = this.#_wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(this.#_wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

        wasm.ccall("dedx_get_program_list",null,['number'],[heap.byteOffset])

        const result = new Int32Array(heap.buffer,heap.byteOffset,this.#programsSize)
        wasm._free(buf);

        const untyped = Array.from(result.subarray(0,result.indexOf(-1)))

        return untyped
    }
}

let _wasm; // skipcq: JS-0119



// ensures WASM is loaded and the function is compiled and reachable.
async function getFromWASM(name,return_t,params_t){
    
}

export async function getPrograms() {

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