import {getParticles} from '../Backend/WASMWrapper'

// There isn't really a good way of testing this locally - one needs to generate the wasm package for themselves.

describe('WASMWrapper', () => {
    test('_dedx_get_all_programs', ()=>{
        const programs = getParticles()
        expect(programs).toBeInstanceOf([])
    })
})