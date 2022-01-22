import React from 'react'
import WASMWrapper from '../../../Backend/WASMWrapper'

import CalculatorSettings from './CalculatorSettings'
import CalculatorInput from './CalculatorInput'
import CalculatorOutput from './CalculatorOutput'

import withLibdedxEntities from '../../WithLibdedxEntities'
import { getCSVForSingleProgram, transformResultToTableData } from '../../ResultTable/TableUtils'

import withError from '../../Error/WithError'
import {NonNumericError, ValueNotSupportedError} from '../../Error/Errors'

const InputUnits = {
    MeVperNucleon: 'MeV/nucl',
    //        Mev: 'Mev',
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}

const baseState = {
    inputUnit: InputUnits.MeVPerNucleum,
    result: {},
    operationMode: OperationMode.Dynamic,
    separator: '\n',
    isRangeDensityBased: 0
}

// Some values can't be processed by libdedx (non-numeric input)
// Some other values cause errors but are part of proper input (e.g. 0)
function toNumericInput(inputArray, separator){
    return inputArray
        .split(separator)
        .map(input => Number(input))
}

function transformInputs(inputArray, separator){
    const numericInputs = toNumericInput(inputArray, separator)
    if(numericInputs.some(ni => isNaN(ni))){
        throw new NonNumericError()
    } else if (numericInputs.some(ni => ni < 0)){
        throw new ValueNotSupportedError()
    }
    return numericInputs.filter(input => input !== 0)
}

class CalculatorComponent extends React.Component {
    constructor(props) {
        super(props)

        this.wrapper = props.wrapper || new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.generateDefaults = this.generateDefaults.bind(this)
        this.onOperationModeChange = this.onOperationModeChange.bind(this)
        this.onDensityUsageChange = this.onDensityUsageChange.bind(this)
        this.onDownloadCSV = this.onDownloadCSV.bind(this)
        this.normalizeInput = this.normalizeInput.bind(this)
        this.resetInput = this.resetInput.bind(this)
        this.resetComponent = this.resetComponent.bind(this)

        this.state = baseState
    }

    //#region LIFECYCLE
    async componentDidUpdate(prevProps, prevState) {
        const { program, ion, material, stoppingPowerUnit } = this.props
        if (program !== prevProps.program
            || ion !== prevProps.ion
            || material !== prevProps.material
        ) {
            const { energies } = this.state.result
            if (energies) {
                try {
                    const result = await this.wrapper.getCalculatorData(this.props, energies , this.state.isRangeDensityBased)
                    this.setState({ result })
                } catch(error) {
                    this.props.setError({error, fallbackStrategy:()=>this.setState(baseState)})
                }
        
            }

        } else if (stoppingPowerUnit !== prevProps.stoppingPowerUnit) {
            const { stoppingPowers } = this.state.result
            if (stoppingPowers) {
                const newState = prevState
                newState.result.stoppingPowers = await this.wrapper.recalcualteStoppingPowers(
                    prevProps.stoppingPowerUnit, stoppingPowerUnit, material, stoppingPowers
                )
                this.setState(newState)
            }
        }
    }
    //#endregion LIFECYCLE

    //#region HANDLERS
    async onSubmit(event) {
        event.preventDefault()
        await this.calculateResults(event.target["calc-input"])
    }

    async onInputChange(event) {
        await this.calculateResults(event.target)
    }

    onOperationModeChange(operationMode) {
        this.setState({ operationMode })
    }

    onDownloadCSV() {
        const { result, isRangeDensityBased } = this.state
        const { energies } = result
        const { stoppingPowerUnit } = this.props

        getCSVForSingleProgram(energies, transformResultToTableData(result, stoppingPowerUnit, isRangeDensityBased), 'dedx_calculator_data.csv')
    }

    onChanges = {
        onStoppingPowerUnitChange: this.props.onStoppingPowerUnitChange,
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }

    async onDensityUsageChange(isRangeDensityBased) {
        let result = this.state.result
        result.csdaRanges = await this.wrapper.recalcualteCSDARangeForDensity(this.props.material,result.csdaRanges,isRangeDensityBased)
        this.setState({ isRangeDensityBased })
    }
    //#endregion HANDLERS

    //#region FALLBACKS - if error happned - how to fix it
    normalizeInput(target, normalizeFunc){
        const separator = this.state.separator
        const numericInputs = toNumericInput(target.value, separator)
        target.value = numericInputs.filter(normalizeFunc).join(separator)
        this.calculateResults(target)
        this.props.setError(undefined)
    }

    resetInput(target){
        target.value = ''
        this.props.setError(undefined)
    }

    // unrecoverable error - reset whole component
    resetComponent(){
        this.setState(baseState)
    }
    //#endregion

    //#region HELPERS

    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.props)).join(separator)
    }

    async calculateResults(target) {
        let result = {}
        try {
            const energies = transformInputs(target.value, this.state.separator)
            result = await this.wrapper.getCalculatorData(this.props, energies , this.state.isRangeDensityBased)
        } catch (error) {
            const setError =  this.props.setError
            if(error instanceof NonNumericError){
                setError({ error, fallbackStrategy: ()=>this.normalizeInput(target, v => !isNaN(v))})
            } else if (error instanceof ValueNotSupportedError){
                setError({ error, fallbackStrategy: ()=>this.normalizeInput(target, v => v > 0)})
            }
            else setError({ error, fallbackStrategy: ()=>this.resetInput(target)})
            result = {}
        }
        this.setState({ result })
    }
    //#endregion HELPERS

    render() {

        const { programs, ions, materials, stoppingPowerUnits, program, ion, material, stoppingPowerUnit } = this.props
        const { result, operationMode, isRangeDensityBased } = this.state
        const { onSubmit, onInputChange, generateDefaults, onOperationModeChange, onDensityUsageChange, onDownloadCSV, onChanges } = this

        // console.log(result)
        return (
            <div className='gridish row-flex flex-large gap2' >
                <div className='particle-input' style={{padding: 0}}>
                    <h2>Data Calculator</h2>
                    <CalculatorSettings
                        onChanges={onChanges}
                        // inputUnits={Object.entries(Units.Inputs)}
                        stoppingPowerUnits={stoppingPowerUnits}
                        stoppingPowerUnit={stoppingPowerUnit}
                        programs={programs}
                        ions={ions}
                        materials={materials}
                        program={program}
                        ion={ion}
                        material={material}
                    />
                    <CalculatorInput
                        onSubmit={onSubmit}
                        onInputChange={operationMode === OperationMode.Dynamic
                            ? onInputChange
                            : undefined
                        }
                        stoppingPowerUnit={stoppingPowerUnit}
                        generateDefaults={generateDefaults}
                        onOperationModeChange={onOperationModeChange}
                        onDensityUsageChange={onDensityUsageChange}
                        onDownloadCSV={onDownloadCSV}
                        displayDownload={result.energies?.length}
                    />
                </div>

                <CalculatorOutput result={result} stoppingPowerUnit={stoppingPowerUnit} isRangeDensityBased={isRangeDensityBased} />
            </div>
        );
    }
}

const defaults = {
    programId: 2, // PSTAR https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L8
    materialId: 276, // liquid WATER https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L197
    ionId: 1, // currently proton (HYDROGEN)  https://github.com/APTG/libdedx/blob/v1.2.1/libdedx/dedx_program_const.h#L244
}

export default withError(withLibdedxEntities(CalculatorComponent, defaults));