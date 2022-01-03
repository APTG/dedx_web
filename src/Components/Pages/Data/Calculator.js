import React from 'react'
import WASMWrapper from '../../../Backend/WASMWrapper'

import CalculatorSettings from './CalculatorSettings'
import CalculatorInput from './CalculatorInput'
import CalculatorOutput from './CalculatorOutput'

import configureMeasurements, { allMeasures } from 'convert-units';
import withLibdedxEntities from '../../WithLibdedxEntities'
import { getCSV, transformResultToTableData } from '../../ResultTable/TableUtils'
import withError from '../../Error/WithError'

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
        throw EvalError("Some of the inputs are non-numeric.")
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
        this.onDownloadCSV = this.onDownloadCSV.bind(this)
        this.normalizeInput = this.normalizeInput.bind(this)
        this.resetInput = this.resetInput.bind(this)
        this.resetComponent = this.resetComponent.bind(this)

        this.state = baseState

        this.convert = configureMeasurements(allMeasures);
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
                this.setState({
                    result: await this.calculateResults(energies)
                })
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
        else return null
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
        this.forceUpdate()
    }

    onDownloadCSV() {
        const { energies } = this.state.result
        const { stoppingPowerUnit } = this.props

        getCSV(energies, transformResultToTableData(this.state.result, stoppingPowerUnit))
    }

    onChanges = {
        onStoppingPowerUnitChange: this.props.onStoppingPowerUnitChange,
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }
    //#endregion HANDLERS

    //#region FALLBACKS - if error happned - how to fix it
    normalizeInput(target){
        const separator = this.state.separator
        const numericInputs = toNumericInput(target.value, separator)
        target.value = numericInputs.filter(ni => !isNaN(ni)).join(separator)
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
            result = await this.wrapper.getCalculatorData(this.props, energies)
            Object.assign(result, this.calculateUnits(result.csdaRanges))
        } catch (error) {
            if(error instanceof EvalError){
                this.props.setError({ error, fallbackStrategy: ()=>this.normalizeInput(target)})
            }
            else this.props.setError({ error, fallbackStrategy: ()=>this.resetInput(target)})
            result = {}
        }
        this.setState({ result })
    }

    calculateUnits(_csdaRanges) {
        const units = new Array(_csdaRanges.length)
        const csdaRanges = _csdaRanges.map((range, key) => {
            const converted = this.convert(range).from('cm').toBest()
            units[key] = converted.unit
            return converted.val
        })
        return { csdaRanges, units }
    }

    //#endregion HELPERS

    render() {

        const { programs, ions, materials, stoppingPowerUnits, program, ion, material, stoppingPowerUnit } = this.props
        const { result, operationMode } = this.state
        const { onSubmit, onInputChange, generateDefaults, onOperationModeChange, onDownloadCSV, onChanges } = this

        return (
            <div className='gridish row-flex flex-large gap2' >
                <div className='particle-input'>
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
                        onDownloadCSV={onDownloadCSV}
                        displayDownload={result.energies?.length}
                    />
                </div>

                <CalculatorOutput result={result} stoppingPowerUnit={stoppingPowerUnit} />
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