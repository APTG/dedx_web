import DataSeriesFactory from './DataSeriesFactory.js'
import Module from './weblibdedx.js'


/**
 * @typedef {LibdedxEntity}
 * @property {number} id - the libdedx ID assigned to the entity
 * @property {string} name - name of the entity read from libdedx
 */

/**
 * @typedef {DataSeries}
 * @property {number[]} x - values to place on the X axis
 * @property {number[]} y - values to place on the Y axis
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

    async getNames(values, func) {
        const wasm = await this.wasm()
        const getName = wasm.cwrap(func, 'number', ['number'])
        return values.map(val => {
            return {
                id: val,
                name: wasm.UTF8ToString(getName(val))
            }
        })
    }

    /**
     * Fetches a list of libdedx programs and encapsulates them in the form of LibdedxEntity
     * @returns {LibdedxEntity[]} array of libdedx programs
     */
    async getPrograms() {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#programsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#programsSize)

        wasm.ccall("dedx_get_program_list", null, ['number'], [heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#programsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_program_name')
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

        wasm.ccall("dedx_get_ion_list", null, ['number', 'number'], [programId, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#ionsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_ion_name')
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

        wasm.ccall("dedx_get_material_list", null, ['number', 'number'], [programId, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#materialsSize)

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_material_name')
    }

    /**
     * Creates a dataseries using data for a given program ion and material
     * Chooses appropriate method of generation based on method and isLog params
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {number} method - data series generation method
     * @param {number} pointQuantity - number of points to generate the plot for
     * @param {boolean} isLog - is plot in logarithmic mode
     * @returns {DataSeries} array of libdedx materials
     */
    async getDataSeries({ program, ion, material, method, pointQuantity }, isLog) {
        switch (method) {
            case 1: return this.getDataSeriesByIntervals(program.id, ion.id, material.id, pointQuantity, isLog)

            default:
            case 0: return this.getDataSeriesByPoints(program.id, ion.id, material.id, pointQuantity, isLog)
        }
    }

     /**
     * Creates a dataseries by number of points
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {number} pointQuantity - number of points to generate the plot for
     * @param {boolean} isLog - is plot in logarithmic mode
     * @returns {DataSeries} Dataseries to be plotted
     */
    async getDataSeriesByPoints(program, ion, material, points, isLog) {
        const wasm = await this.wasm()
        const min_energy = wasm.ccall('dedx_get_min_energy', 'number', ['number', 'number'], [program, ion])
        const max_energy = wasm.ccall('dedx_get_max_energy', 'number', ['number', 'number'], [program, ion])

        console.log(`start: ${min_energy}\tend: ${max_energy}`)

        const xs = isLog
            ? DataSeriesFactory.getLogXValuesByPoints(min_energy, max_energy, points)
            : DataSeriesFactory.getXValuesByPoints(min_energy, max_energy, points)

        const stepFunction = wasm.cwrap('dedx_get_simple_stp', 'number', ['number', 'number', 'number', 'number'])

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)


        const boundStepFuntion = (x => {
            const res = stepFunction(ion, material, x, heap.byteOffset)
            const err = new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
            if (err !== 0) console.log(err)
            return res
        })

        return DataSeriesFactory.getYValues(xs, boundStepFuntion)
    }

    /**
     * Creates a dataseries by number of intervals
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {number} pointQuantity - number of points to generate the plot for
     * @param {boolean} isLog - is plot in logarithmic mode
     * @returns {DataSeries} Dataseries to be plotted
     */
    async getDataSeriesByIntervals(program, ion, material, intervals, isLog) {
        return await this.getDataSeriesByPoints(program, ion, material, intervals + 1, isLog)
    }

    // async getDataSeriesByStep(program, ion, material, interval){
    //     const wasm = await this.wasm()
    //     const min_energy = wasm.ccall('dedx_get_min_energy', 'number', ['number','number'],[program,ion])
    //     const max_energy = wasm.ccall('dedx_get_max_energy', 'number', ['number','number'],[program,ion])

    //     console.log(`start: ${min_energy}\tend: ${max_energy}`)

    //     const xs = DataSeriesFactory.getXValuesByInterval(min_energy,max_energy,interval)

    //     const stepFunction = wasm.cwrap('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'])

    //     const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT)
    //     const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)

    //     const boundStepFuntion = (x=>{
    //         const res = stepFunction(ion,material,x,heap.byteOffset)
    //         const err =  new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
    //         if(err !== 0)console.log(err)
    //         return res
    //     })

    //     return DataSeriesFactory.getYValues(xs, boundStepFuntion)
    // }

     /**
     * Calculates a single value of stopping power for a given energy value
     * @param {LibdedxEntity} program - a libdedx program object
     * @param {LibdedxEntity} ion - a libdedx ion object
     * @param {LibdedxEntity} material - a libdedx material object
     * @param {number} energy - value of energy to calculate the power for
     * @returns {number} single value of stopping power
     */
    async getSingleValue(program, ion, material, energy){
        const wasm = await this.wasm()

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)

        const res =  wasm.ccall('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'],[ion,material,energy, heap.byteOffset])

        const err =  new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
        
        if(err !== 0){
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
    async generateDefaults({program, ion, material}){
        return [1,2,5,10,20,50,100, 200, 500, 1000, 2000, 5000]
    }
}