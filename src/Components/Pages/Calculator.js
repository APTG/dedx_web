import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'
import withLibdedxEntities from '../WithLibdedxEntities'

const Units = {
    Inputs: {
        MeVperNucleon: 'MeV/nucl',
        //        Mev: 'Mev',
    },
    Outputs: {
        SmallScale: 'keV/μm',
        LargeScale: 'MeV/cm',
        MassStoppingPower: 'MeV*g/cm^2'

    }
}

const OperationMode = {
    Dynamic: 0,
    Performance: 1,
}

class CalculatorComponent extends React.Component {


    onChanges = {
        // onInputUnitChange: ({ target }) => {
        //     const inputUnit = target.value
        //     this.setState({ inputUnit })
        // },
        onOutputUnitChange: ({ target }) => {
            const outputUnit = target.value
            //const result = this.enrichWithUnit(this.state.result, outputUnit)
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            this.setState({ operationMode })
            this.forceUpdate()
        },
        onProgramChange: this.props.onProgramChange,
        onIonChange: this.props.onIonChange,
        onMaterialChange: this.props.onMaterialChange,
    }

    enrichWithUnit(results, unit = 'cm') {
        return results.map(res => Object.assign({ unit }, res))
    }

    async calculateResults(input) {
        const { program, ion, material } = this.state

        return await Promise.all(
            input.map(async input => {
                const result = await this.wrapper.getSingleValue(
                    program.id,
                    ion.id,
                    material.id,
                    input
                )
                return {
                    input,
                    energy: isNaN(result) ? 'Value unsupported' : result,
                    csdaRange: 'Work in progress'
                }
            })
        )
    }

    async onSubmit(event) {
        event.preventDefault()

        const { separator } = this.state
        const input = event.target["calc-input"].value.split(separator).filter(el => el !== '')
        const values = await this.calculateResults(input)
        const result = this.enrichWithUnit(values)

        this.setState({ result })
    }

    async onInputChange(event) {
        const { separator } = this.state
        const input = event.target.value.split(separator).filter(el => el !== '')
        const values = await this.calculateResults(input)
        const result = this.enrichWithUnit(values)

        this.setState({ result })
    }

    async generateDefaults() {
        const { separator } = this.state
        return (await this.wrapper.generateDefaults(this.state)).join(separator)
    }

    constructor(props) {
        super(props)

        this.wrapper = new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.generateDefaults = this.generateDefaults.bind(this)

        this.state = {
            inputUnit: Units.Inputs.MeVPerNucleum,
            outputUnit: Units.Outputs.SmallScale,
            result: [],
            operationMode: OperationMode.Dynamic,
            separator: ' ',
        }

    }

    render() {

        const { programs, ions, materials, program, ion, material } = this.props
        const { outputUnit, result, operationMode} = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        return (
            <div>
                <CalculatorSettings
                    onChanges={onChanges}
                    // inputUnits={Object.entries(Units.Inputs)}
                    outputUnits={Object.entries(Units.Outputs)}
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
                    // inputUnit={inputUnit}
                    outputUnit={outputUnit}
                    generateDefaults={generateDefaults}
                />
                <CalculatorOutput result={result} energyUnit={outputUnit} />
            </div>
        );
    }
}

const defaults = {
    programId: 4,
    materialId: 1,
    ionId: 1,
}

export default withLibdedxEntities(CalculatorComponent, defaults);