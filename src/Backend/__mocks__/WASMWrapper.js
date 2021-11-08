import {mockPrograms, mockMaterials, mockIons} from '../../__test__/MockData'

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