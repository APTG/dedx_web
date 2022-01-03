export class NonNumericError extends Error{
    constructor(){
        super('Some of the inputs are non-numeric.')
    }
}
export class ValueNotSupportedError extends Error{
    constructor(){
        super('Some of the inputs are not supported in the current version of libdEdx')
    }
}