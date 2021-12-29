import DataSeriesFactory from './DataSeriesFactory.js'
import Module from './weblibdedx.js'

import { StoppingPowerUnits } from './Utils.js'

const terminator = -1

/**
 * @typedef {LibdedxEntity}
 * @property {number} id - the libdedx ID assigned to the entity
 * @property {string} name - name of the entity read from libdedx
 * 
 * @typedef {PlotDataSeries}
 * @property {number[]} energies - values of energy
 * @property {number[]} stoppingPowers - values of power
 * 
 * @typedef {CalculatorDataSeries}
 * @property {number[]} energies - values of energy
 * @property {number[]} stoppingPowers - values of power
 * @property {number[]} csdaRanges - values of csda range
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

        const [progPtr, programs] = this._allocateI32(wasm, this.#programsSize)

        wasm.ccall("dedx_fill_program_list", null, ['number'], [programs.byteOffset])
        // for Array.subarray startIndex is inclusive but endIndex is exclusive
        const result = Array.from(programs.subarray(0, programs.indexOf(terminator)))

        this._free(wasm, progPtr)

        return this.getNames(result, 'dedx_get_program_name', wasm)
    }

    /**
     * Fetches a list of libdedx ions avaiable for a given program
     * and encapsulates them in the form of LibdedxEntity
     * @param {number} programId - an ID of a libdedx program
     * @returns {LibdedxEntity[]} array of libdedx ions
     */
    async getIons(programId) {
        const wasm = await this.wasm()

        const [ionPtr, ions] = this._allocateI32(wasm, this.#ionsSize)

        wasm.ccall("dedx_fill_ion_list", null, ['number', 'number'], [programId, ions.byteOffset])
        // for Array.subarray startIndex is inclusive but endIndex is exclusive
        const result = Array.from(ions.subarray(0, ions.indexOf(terminator)))

        wasm._free(ionPtr)

        return this.getNames(result, 'dedx_get_ion_name', wasm)
    }

    /**
     * Fetches a list of libdedx materials avaiable for a given program
     * and encapsulates them in the form of LibdedxEntity
     * @param {number} programId - an ID of a libdedx program
     * @returns {LibdedxEntity[]} array of libdedx materials
     */
    async getMaterials(programId) {
        const wasm = await this.wasm()

        const [matPtr, materials] = this._allocateI32(wasm, this.#materialsSize)

        wasm.ccall("dedx_fill_material_list", null, ['number', 'number'], [programId, materials.byteOffset])
        // for Array.subarray startIndex is inclusive but endIndex is exclusive
        const result = Array.from(materials.subarray(0, materials.indexOf(terminator)))

        wasm._free(matPtr)

        return this.getNames(result, 'dedx_get_material_name', wasm)
    }

    /**
     * Creates a plotdataseries using data for a given program, ion and material
     * Chooses appropriate method of generation based on method and isLog params
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {boolean} isLog - is plot in logarithmic mode
     * @param {LibdedxEntity} stoppingPowerUnit - Current unit of stopping power
     * @returns {PlotDataSeries} Dataseries in format suitable for Plot usage
     */
    async getStpPlotData({ program, ion, material }, isLog, stoppingPowerUnit) {
        const wasm = await this.wasm()

        const ids = [program.id, ion.id, material.id]

        const size = this.getDefaultSize(ids, wasm)

        const result = isLog
        ?  this.getDefaultStpPlotData(ids, size, wasm)
        :  this.getArithmeticStpPlotData(ids, size, wasm)

        if(stoppingPowerUnit.id !== StoppingPowerUnits.MassStoppingPower.id)
            result.stoppingPowers = await this.recalcualteStoppingPowers(StoppingPowerUnits.MassStoppingPower, stoppingPowerUnit, material, result.stoppingPowers)

        return result
    }

    /**
     * Creates a calculatordataseries using data for a given program, ion and material
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {LibdedxEntity} stoppingPowerUnit - Current unit of stopping power
     * @param {number[]} energies - values of energy to calculate for
     * @returns {CalculatorDataSeries} dataseries in a format suitable for Calculator usage
     */
    async getCalculatorData({ program, ion, material, stoppingPowerUnit }, energies) {
        const wasm = await this.wasm()

        let stoppingPowers = this.getPowerForEnergy([program.id, ion.id, material.id], energies, wasm)
        if(stoppingPowerUnit.id !== StoppingPowerUnits.MassStoppingPower.id)
            stoppingPowers = await this.recalcualteStoppingPowers(StoppingPowerUnits.MassStoppingPower, stoppingPowerUnit, material, stoppingPowers)
        const csdaRanges = this.getcsdaRangesForEnergies([program.id, ion.id, material.id], energies, wasm)
        return {
            energies,
            stoppingPowers,
            csdaRanges
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

        const buf = wasm._malloc(Uint8Array.BYTES_PER_ELEMENT)
        const heap = new Uint8Array(wasm.HEAP8.buffer, buf, Uint8Array.BYTES_PER_ELEMENT)

        const res = wasm.ccall(
            'dedx_get_simple_stp',
            'number',
            ['number', 'number', 'number', 'number'],
            [ion, material, energy, heap.byteOffset]
        )

        const err = heap[0]

        if (err !== 0) {
            console.error(`Dedx execution error ${err}`)
            return NaN
        }

        return res
    }

    /**
     * Fetches the default energy values from libdedx
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @returns {number[]} default values of energy
     */
    async generateDefaults({ program, ion, material }) {
        const wasm = await this.wasm()

        const ids = [program.id, ion.id, material.id]

        const size = this.getDefaultSize(ids, wasm)

        const [energyPtr, _energies] = this._allocateF32(wasm, size)
        const [powerPtr, _stoppingPowers] = this._allocateF32(wasm, size)

        const err = wasm.ccall(
            'dedx_fill_default_energy_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.byteOffset, _stoppingPowers.byteOffset]
        )

        //energy varies from program to program, some have only 3 digits after the decimal, some have 6, regex removes trailing zeros
        const energies = !err ? Array.from(_energies).map(energy => energy.toFixed(6).replace(/(\d)0+$/gm, '$1')) : [0]

        this._free(wasm, energyPtr, powerPtr)

        if (err !== 0) console.log(err)

        return energies
    }

    /**
    * Recalculates the values of stopping powers from oldUnit to newUnit
    * @param {LibdedxEntity} oldUnit - old stopping power unit
    * @param {LibdedxEntity} newUnit - new stopping power unit
    * @param {LibdedxEntity} material - a libdedx material object
    * @param {number} oldstoppingPowers - values of stopping power in old unit
    * @returns {number[]} values of stopping power in new unit
    */
    async recalcualteStoppingPowers(oldUnit, newUnit, material, oldstoppingPowers) {
        const wasm = await this.wasm()

        const [oldVPtr, oldValues] = this._allocateF32(wasm, oldstoppingPowers.length)
        const [newVPtr, newValues] = this._allocateF32(wasm, oldstoppingPowers.length)
        oldValues.set(oldstoppingPowers)

        const err = wasm.ccall(
            'convert_units',
            'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [oldUnit.id, newUnit.id, material.id, oldstoppingPowers.length, oldValues.byteOffset, newValues.byteOffset]
        )
        const result = !err ? Array.from(newValues).map(result => result.toFixed(10)) : [0]

        if(err) console.log(err)

        this._free(wasm, oldVPtr, newVPtr)

        return result
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
        const [energyPtr, _energies] = this._allocateF32(wasm, size)
        const [powerPtr, _stoppingPowers] = this._allocateF32(wasm, size)

        const err = wasm.ccall(
            'dedx_fill_default_energy_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.byteOffset, _stoppingPowers.byteOffset]
        )
        
        //energy varies from program to program, some have only 3 digits after the decimal, some have 6, regex removes trailing zeros
        const energies = !err ? Array.from(_energies).map(energy => energy.toFixed(6).replace(/(\d)0+$/gm, '$1')) : [0]
        const stoppingPowers = !err ? Array.from(_stoppingPowers).map(stoppingPower => stoppingPower.toFixed(10)) : [0]
        this._free(wasm, energyPtr, powerPtr)

        if (err !== 0) console.log(err)

        return { energies, stoppingPowers }
    }

    getArithmeticStpPlotData([programId, ionId, materialId], size, wasm) {
        const min_energy = wasm.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [programId, ionId])
        const max_energy = wasm.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [programId, ionId])

        const energies = DataSeriesFactory.getXValuesByPoints(min_energy, max_energy, size)

        const stoppingPowers = this.getPowerForEnergy([programId, ionId, materialId], energies, wasm)

        return { energies, stoppingPowers }
    }

    getPowerForEnergy(ids, _energies, wasm) {
        const [energyPtr, energies] = this._allocateF32(wasm, _energies.length)
        const [powerPtr, stoppingPowers] = this._allocateF32(wasm, _energies.length)
        energies.set(_energies)

        const err = wasm.ccall(
            'dedx_get_stp_table',
            'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.length, energies.byteOffset, stoppingPowers.byteOffset]
        )

        const resultstoppingPowers = !err ? Array.from(stoppingPowers).map(stoppingPower => stoppingPower.toFixed(10)) : [0]

        this._free(wasm, energyPtr, powerPtr)

        if (err !== 0) console.log(err)

        return resultstoppingPowers
    }

    getcsdaRangesForEnergies(ids, _energies, wasm) {
        const [energyPtr, energies] = this._allocateF32(wasm, _energies.length)
        const [csdaRangesPtr, csdaRanges] = this._allocateF64(wasm, _energies.length)
        energies.set(_energies)

        const err = wasm.ccall(
            'dedx_get_csda_range_table',
            'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [...ids, _energies.length, energies.byteOffset, csdaRanges.byteOffset]
        )

        const resultcsdaRanges = !err ? Array.from(csdaRanges) : [0]

        this._free(wasm, energyPtr, csdaRangesPtr)

        if (err !== 0) console.log(err)

        return resultcsdaRanges
    }

    _allocateI32(wasm, size) {
        const ptr = wasm._malloc(size * Int32Array.BYTES_PER_ELEMENT)
        const arr = new Int32Array(wasm.HEAP32.buffer, ptr, size)

        return [ptr, arr]
    }

    _allocateF32(wasm, size) {
        const ptr = wasm._malloc(size * Float32Array.BYTES_PER_ELEMENT)
        const arr = new Float32Array(wasm.HEAPF32.buffer, ptr, size)

        return [ptr, arr]
    }

    _allocateF64(wasm, size) {
        const ptr = wasm._malloc(size * Float64Array.BYTES_PER_ELEMENT)
        const arr = new Float64Array(wasm.HEAPF64.buffer, ptr, size)

        return [ptr, arr]
    }

    _free(wasm, ...args) {
        args.forEach(arg => wasm._free(arg))
    }
    //#endregion INTERNAL
}