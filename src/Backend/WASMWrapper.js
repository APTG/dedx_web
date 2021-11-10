import Module from './weblibdedx.js'

export default class WASMWrapper {
    #_wasm;
    #programsSize = 20
    #ionsSize = 20
    #materialsSize = 200

    async wasm() {
        if (!this.#_wasm) this.#_wasm = await Module()
        return this.#_wasm
    }

    async getNames(values, func) {
        const wasm = await this.wasm()
        const getName = wasm.cwrap(func, 'number', ['number'])
        return values.map(val => {
            return {
                code: val,
                name: wasm.UTF8ToString(getName(val))
            }
        })
    }

    async getPrograms() {
        const wasm = await this.wasm()

        const pointer = new Int32Array(new Array(this.#programsSize))
        const buf = this.#_wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(this.#_wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

        wasm.ccall("dedx_get_program_list", null, ['number'], [heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#programsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf);

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_program_name')
    }

    async getIons(program) {
        const wasm = await this.wasm()

        const pointer = new Int32Array(new Array(this.#ionsSize))
        const buf = this.#_wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(this.#_wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

        wasm.ccall("dedx_get_ion_list", null, ['number', 'number'], [heap.byteOffset, program])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#ionsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf);

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_ion_name')
    }

    async getMaterials(program) {
        const wasm = await this.wasm()

        const pointer = new Int32Array(new Array(this.#materialsSize))
        const buf = this.#_wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(this.#_wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

        wasm.ccall("dedx_get_material_list", null, ['number', 'number'], [heap.byteOffset, program])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#materialsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf);

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_material_name')
    }

    getTrace(program, ion, material) {
        return {
            x: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            y: Array.from(new Array(10), _ => Math.random() * 100)
        }
    }
}