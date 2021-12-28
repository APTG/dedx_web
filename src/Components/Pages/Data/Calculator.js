import React from 'react'
import WASMWrapper from '../../../Backend/WASMWrapper'

import CalculatorSettings from './CalculatorSettings'
import CalculatorInput from './CalculatorInput'
import CalculatorOutput from './CalculatorOutput'

import * as convert from 'convert-units'
import withLibdedxEntities from '../../WithLibdedxEntities'

const InputUnits = {
    MeVperNucleon: 'MeV/nucl',
    //        Mev: 'Mev',
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}

class CalculatorComponent extends React.Component {
    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.props)).join(separator)
    }

    constructor(props) {
        super(props)

        this.wrapper = props.wrapper || new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.generateDefaults = this.generateDefaults.bind(this)

        this.state = {
            inputUnit: InputUnits.MeVPerNucleum,
            result: {},
            operationMode: OperationMode.Dynamic,
            separator: ' ',
        }
    }

    //#region LIFECYCLE
    async componentDidUpdate(prevProps, oldState) {
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

        }
        else if (stoppingPowerUnit !== prevProps.stoppingPowerUnit) {
            const { stoppingPowers } = this.state.result
            if (stoppingPowers) {
                const newState = oldState
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

        const { separator } = this.state
        const input = event.target["calc-input"].value.split(separator).filter(el => el !== '').map(el => Number(el))
        const result = await this.calculateResults(input)

        this.setState({ result })
    }

    async onInputChange(event) {
        const { separator } = this.state
        const input = event.target.value.split(separator).filter(el => el !== '').map(el => Number(el))
        const result = await this.calculateResults(input)

        this.setState({ result })
    }

    onChanges = {
        onOperationModeChange: operationMode => {
            this.setState({ operationMode })
            this.forceUpdate()
        },
        onStoppingPowerUnitChange: this.props.onStoppingPowerUnitChange,
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }
    //#endregion HANDLERS

    //#region HELPERS
    async calculateResults(energies) {
        const result = await this.wrapper.getCalculatorData(this.props, energies)
        Object.assign(result, this.calculateUnits(result.csdaRanges))
        return result
    }

    calculateUnits(_csdaRanges) {
        const units = new Array(_csdaRanges.length)
        const csdaRanges = _csdaRanges.map((range, key) => {
            const converted = convert(range).from('cm').toBest()
            units[key] = converted.unit
            return converted.val
        })
        return { csdaRanges, units }
    }
    //#endregion HELPERS

    render() {

        const { programs, ions, materials, stoppingPowerUnits, program, ion, material, stoppingPowerUnit } = this.props
        const { result, operationMode } = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        return (
            <div>
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
                />
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

export default withLibdedxEntities(CalculatorComponent, defaults);