import DataSeriesFactory from './DataSeriesFactory.js'
import Module from './weblibdedx.js'

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
                code: val,
                name: wasm.UTF8ToString(getName(val))
            }
        })
    }

    async getPrograms() {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#programsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#programsSize)

        wasm.ccall("dedx_get_program_list", null, ['number'], [heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#programsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_program_name')
    }

    async getIons(program) {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#ionsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#ionsSize)

        wasm.ccall("dedx_get_ion_list", null, ['number', 'number'], [program, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#ionsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_ion_name')
    }

    async getMaterials(program) {
        const wasm = await this.wasm()

        const buf = wasm._malloc(this.#materialsSize * Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint32Array(wasm.HEAP32.buffer, buf, this.#materialsSize)

        wasm.ccall("dedx_get_material_list", null, ['number', 'number'], [program, heap.byteOffset])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#materialsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf)

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_material_name')
    }

    async getDataSeries({program, ion, material, method, plotUsing}, isLog){
        switch (method){
            case 1: return this.getDataSeriesByIntervals(program, ion, material, plotUsing, isLog)

            default: 
            case 0: return this.getDataSeriesByPoints(program,ion,material,plotUsing, isLog)
        }
    }

    async getDataSeriesByPoints(program, ion, material, points, isLog) {
        const wasm = await this.wasm()
        const min_energy = wasm.ccall('dedx_get_min_energy', 'number', ['number','number'],[program,ion])
        const max_energy = wasm.ccall('dedx_get_max_energy', 'number', ['number','number'],[program,ion])

        console.log(`start: ${min_energy}\tend: ${max_energy}`)

        const xs = isLog
            ? DataSeriesFactory.getLogXValuesByPoints(min_energy,max_energy,points) 
            : DataSeriesFactory.getXValuesByPoints(min_energy,max_energy,points)

        const stepFunction = wasm.cwrap('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'])

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT)
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)


        const boundStepFuntion = (x=>{
            const res = stepFunction(ion,material,x,heap.byteOffset)
            const err =  new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
            if(err !== 0)console.log(err)
            return res
        })

        return DataSeriesFactory.getYValues(xs, boundStepFuntion)
    }

    async getDataSeriesByIntervals(program, ion, material, intervals, isLog){
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
}