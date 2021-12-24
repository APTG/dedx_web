import DataSeriesFactory from './DataSeriesFactory.js'
import Module from './weblibdedx.js'


/**
 * @typedef {LibdedxEntity}
 * @property {number} id - the libdedx ID assigned to the entity
 * @property {string} name - name of the entity read from libdedx
 * 
 * @typedef {PlotDataSeries}
 * @property {number[]} energies - values of energy
 * @property {number[]} powers - values of power
 * 
 * @typedef {CalculatorDataSeries}
 * @property {number[]} energies - values of energy
 * @property {number[]} powers - values of power
 * @property {number[]} csda - values of CSDA range
 */
export default class WASMWrapper {
    #_wasm

    // The values used here are based on array sizes in dedx_program_const.h
    // They aren't one-to-one mapping but there's a guarantee they are always 
    // greater than or equal to the expected number of entities they describe

    #programsSize = 20
    #ionsSize = 120
    #materialsSize = 400

    async wasm() {
        if (!this.#_wasm) this.#_wasm = await Module()
        return this.#_wasm
    }

    /**
     * Fetches a list of libdedx programs and encapsulates them in the form of LibdedxEntity
     * @returns {LibdedxEntity[]} array of libdedx programs
     */
    async getPrograms() {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#programsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#programsSize)

        wasm.ccall("dedx_fill_program_list", null, ['number'], [heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#programsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_program_name', wasm)
    }

    /**
     * Fetches a list of libdedx ions avaiable for a given program
     * and encapsulates them in the form of LibdedxEntity
     * @param {number} programId - an ID of a libdedx program
     * @returns {LibdedxEntity[]} array of libdedx ions
     */
    async getIons(programId) {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#ionsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#ionsSize)

        wasm.ccall("dedx_fill_ion_list", null, ['number', 'number'], [programId, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#ionsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_ion_name', wasm)
    }

    /**
     * Fetches a list of libdedx materials avaiable for a given program
     * and encapsulates them in the form of LibdedxEntity
     * @param {number} programId - an ID of a libdedx program
     * @returns {LibdedxEntity[]} array of libdedx materials
     */
    async getMaterials(programId) {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#materialsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#materialsSize)

        wasm.ccall("dedx_fill_material_list", null, ['number', 'number'], [programId, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#materialsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_material_name', wasm)
    }

    /**
     * Creates a plotdataseries using data for a given program, ion and material
     * Chooses appropriate method of generation based on method and isLog params
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {boolean} isLog - is plot in logarithmic mode
     * @returns {PlotDataSeries} array of libdedx materials
     */
    async getStpPlotData({ program, ion, material }, isLog) {
        const wasm = await this.wasm()

        const ids = [program.id, ion.id, material.id]

        const size = this.getDefaultSize(ids, wasm)

        if (isLog) return this.getDefaultStpPlotData(ids, size, wasm)
        else return this.getArithmeticStpPlotData(ids, size, wasm)
    }

    /**
     * Creates a calculatordataseries using data for a given program, ion and material
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {number[]} energies - values of energy to calculate for
     * @returns {CalculatorDataSeries} array of libdedx materials
     */
    async getCalculatorData({ program, ion, material }, energies) {
        const wasm = await this.wasm()

        const powers = this.getPowerForEnergy([program.id, ion.id, material.id], energies, wasm)
        const csda = this.getCSDAForEnergies([program.id, ion.id, material.id], energies, wasm)

        return {
            energies,
            powers,
            csda
        }
    }

    /**
    * Calculates a single value of stopping power for a given energy value
    * @param {LibdedxEntity} program - a libdedx program object
    * @param {LibdedxEntity} ion - a libdedx ion object
    * @param {LibdedxEntity} material - a libdedx material object
    * @param {number} energy - value of energy to calculate the power for
    * @returns {number} single value of stopping power
    */
    async getSingleValue(program, ion, material, energy) {
        const wasm = await this.wasm()

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)

        const res = wasm.ccall('dedx_get_simple_stp', 'number', ['number', 'number', 'number', 'number'], [ion, material, energy, heap.byteOffset])

        const err = new Int32Array(heap.buffer, heap.byteOffset, 1)[0]

        if (err !== 0) {
            console.error(`Dedx execution error ${err}`)
            return NaN
        }

        return res
    }

    /**
     * Fetches the default energy values from libdedx - placeholder
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @returns {number[]} default values of energy
     */
    async generateDefaults({ program, ion, material }) {
        const wasm = await this.wasm()

        const ids = [program.id, ion.id, material.id]

        const size = this.getDefaultSize(ids, wasm)

        const energyPtr = wasm._malloc(size * Float32Array.BYTES_PER_ELEMENT)
        const _energies = new Float32Array(wasm.HEAPF32.buffer, energyPtr, size)
        const powerPtr = wasm._malloc(size * Float32Array.BYTES_PER_ELEMENT)
        const _powers = new Float32Array(wasm.HEAPF32.buffer, powerPtr, size)

        const err = wasm.ccall(
            'dedx_fill_default_energy_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.byteOffset, _powers.byteOffset]
        )

        const energies = !err ? Array.from(_energies) : [0]

        wasm._free(energyPtr)
        wasm._free(powerPtr)

        if (err !== 0) console.log(err)

        return energies
    }

    //#region INTERNAL
    getNames(values, func, wasm) {
        const getName = wasm.cwrap(func, 'number', ['number'])
        return values.map(val => {
            return {
                id: val,
                name: wasm.UTF8ToString(getName(val))
            }
        })
    }

    getDefaultSize(ids, wasm) {
        return wasm.ccall(
            'dedx_get_stp_table_size',
            'number',
            ['number', 'number', 'number'],
            ids
        )
    }

    getDefaultStpPlotData(ids, size, wasm) {
        const energyPtr = wasm._malloc(size * Float32Array.BYTES_PER_ELEMENT)
        const _energies = new Float32Array(wasm.HEAPF32.buffer, energyPtr, size)
        const powerPtr = wasm._malloc(size * Float32Array.BYTES_PER_ELEMENT)
        const _powers = new Float32Array(wasm.HEAPF32.buffer, powerPtr, size)

        const err = wasm.ccall(
            'dedx_fill_default_energy_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.byteOffset, _powers.byteOffset]
        )

        const energies = !err ? Array.from(_energies) : [0]
        const powers = !err ? Array.from(_powers) : [0]

        wasm._free(energyPtr)
        wasm._free(powerPtr)

        if (err !== 0) console.log(err)

        return { energies, powers }
    }

    async getArithmeticStpPlotData([programId, ionId, materialId], size, wasm) {
        const min_energy = wasm.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [programId, ionId])
        const max_energy = wasm.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [programId, ionId])

        const energies = DataSeriesFactory.getXValuesByPoints(min_energy, max_energy, size)

        const powers = this.getPowerForEnergy([programId, ionId, materialId], energies, wasm)

        return { energies, powers }
    }

    getPowerForEnergy(ids, _energies, wasm) {
        const energyPtr = wasm._malloc(_energies.length * Float32Array.BYTES_PER_ELEMENT)
        const energies = new Float32Array(wasm.HEAPF32.buffer, energyPtr, _energies.length)
        const powerPtr = wasm._malloc(_energies.length * Float32Array.BYTES_PER_ELEMENT)
        const powers = new Float32Array(wasm.HEAPF32.buffer, powerPtr, _energies.length)
        energies.set(_energies)

        const err = wasm.ccall(
            'dedx_get_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.length, energies.byteOffset, powers.byteOffset]
        )

        const resultPowers = !err ? Array.from(powers) : [0]

        wasm._free(energyPtr)
        wasm._free(powerPtr)

        if (err !== 0) console.log(err)

        return resultPowers
    }

    getCSDAForEnergies(ids, _energies, wasm) {
        const energyPtr = wasm._malloc(_energies.length * Float32Array.BYTES_PER_ELEMENT)
        const energies = new Float32Array(wasm.HEAPF32.buffer, energyPtr, _energies.length)
        const csdaPtr = wasm._malloc(_energies.length * Float64Array.BYTES_PER_ELEMENT)
        const csda = new Float64Array(wasm.HEAPF64.buffer, csdaPtr, _energies.length)
        energies.set(_energies)

        const err = wasm.ccall(
            'dedx_get_csda_range_table',
            'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.length, energies.byteOffset, csda.byteOffset]
        )

        const resultCSDA = !err ? Array.from(csda) : [0]

        wasm._free(energyPtr)
        wasm._free(csdaPtr)

        if (err !== 0) console.log(err)

        return resultCSDA
    }
    //#endregion INTERNAL
}