import {mockPrograms, mockMaterials, mockIons} from '../../__test__/MockData'

export const StoppingPowerUnits = {
    MassStoppingPower: {name:'MeV*cm^2/g', id:0},
    LargeScale: {name:'MeV/cm', id:1},
    SmallScale: {name:'keV/μm', id:2}
}

export default class WASMWrapper{
    async getPrograms(){
        return await new Promise((res,rej)=>{
            res(mockPrograms)
        })
    }

    async getIons(){
        return await new Promise((res,rej)=>{
            res(mockIons)
        })
    }

    async getMaterials(){
        return await new Promise((res,rej)=>{
            res(mockMaterials)
        })
    }
}