import TraceFactory from './TraceFacotry.js';
import Module from './weblibdedx.js'

export default class WASMWrapper {
    #_wasm;
    #programsSize = 20
    #ionsSize = 20
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
        const buf = wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

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
        const buf = wasm._malloc(pointer.length * pointer.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, pointer.length * pointer.BYTES_PER_ELEMENT)

        wasm.ccall("dedx_get_material_list", null, ['number', 'number'], [heap.byteOffset, program])

        const result = new Int32Array(heap.buffer, heap.byteOffset, this.#materialsSize)
            .filter(x => x !== 0) // TODO: Once the new wasm is generated in the dev-precompiled delete this line

        wasm._free(buf);

        const untyped = Array.from(result.subarray(0, result.indexOf(-1)))

        return this.getNames(untyped, 'dedx_get_material_name')
    }

    async getTrace(program, ion, material, method, plot_using){
        if(method === 0)
            return await this.getTraceByInterval(program,ion,material,plot_using)
        else
            return await this.getTraceByPoints(program,ion,material,plot_using)
    }

    async getTraceByPoints(program, ion, material, points) {
        const wasm = await this.wasm()
        const start = wasm.ccall('dedx_get_min_energy', 'number', ['number','number'],[program,ion])
        const end = wasm.ccall('dedx_get_max_energy', 'number', ['number','number'],[program,ion])

        const xs = TraceFactory.getXAxisByPoints(start,end,points)

        const stepFunction = wasm.cwrap('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'])

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)


        const boundStepFuntion = (x=>{
            const res = stepFunction(ion,material,x,heap.byteOffset)
            const err =  new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
            if(err !== 0)console.log(err)
            return res
        })

        return TraceFactory.getStoppingPowerValues(xs, boundStepFuntion)
    }

    async getTraceByInterval(program, ion, material, interval){
        const wasm = await this.wasm()
        const start = wasm.ccall('dedx_get_min_energy', 'number', ['number','number'],[program,ion])
        const end = wasm.ccall('dedx_get_max_energy', 'number', ['number','number'],[program,ion])

        const xs = TraceFactory.getXAxisByInterval(start,end,interval)

        const stepFunction = wasm.cwrap('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'])

        const buf = wasm._malloc(Int32Array.BYTES_PER_ELEMENT);
        const heap = new Uint8Array(wasm.HEAP32.buffer, buf, Int32Array.BYTES_PER_ELEMENT)


        const boundStepFuntion = (x=>{
            const res = wasm.ccall('dedx_get_simple_stp','number',['number', 'number', 'number', 'number'], [ion,material,x,heap.byteOffset])
            const err =  new Int32Array(heap.buffer, heap.byteOffset, 1)[0]
            if(err !== 0)console.log(err)
            return res
        })

        return TraceFactory.getStoppingPowerValues(xs, boundStepFuntion)
    }
}