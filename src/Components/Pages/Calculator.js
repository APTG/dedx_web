import PropTypes from 'prop-types'
import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'

const Units = {
    Inputs: {
        MeVPerNucleum: 'MeV/nucl',
        //        Mev: 'Mev',
    },
    Outputs: {
        SmallScale: 'keV/μm',
        LargeScale: 'MeV/cm',
        DensityDependant: 'Mev*g/cm^2'

    }
}

const OperationMode = {
    Performance: 0,
    Dynamic: 1
}


class CalculatorComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    onChanges = {
        onInputUnitChange: (event) => {
            const inputUnit = event.target.value
            this.setState({ inputUnit })
        },
        onOutputUnitChange: (event) => {
            const outputUnit = event.target.value
            //const result = this.enrichWithUnit(this.state.result, outputUnit)
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            console.log(operationMode)
            this.setState({ operationMode })
            this.forceUpdate()
        }
    }

    enrichWithUnit(results, unit = 'cm') {
        return results.map(res => Object.assign({ unit }, res))
    }

    async calculateResults(input) {

        return await Promise.all(
            input.map(async input => {

                const result = await this.wrapper.getSingleValue(1, 1, 1, input)
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

        console.log('Unit conversion: ' + (convert(0.001).from('l').toBest().val))

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
            separator: ' '
        }

    }

    render() {

        const { inputUnit, outputUnit, result, operationMode } = this.state
        const { onSubmit, onInputChange, generateDefaults, onChanges } = this

        console.log(result)
        return (
            <div>
                <CalculatorSettings
                    onChanges={onChanges}
                    inputUnits={Object.entries(Units.Inputs)}
                    outputUnits={Object.entries(Units.Outputs)}
                />
                <CalculatorInput
                    onSubmit={onSubmit}
                    onInputChange={operationMode === OperationMode.Dynamic
                        ? onInputChange
                        : undefined
                    }
                    inputUnit={inputUnit}
                    outputUnit={outputUnit}
                    generateDefaults={generateDefaults}
                />
                <CalculatorOutput result={result} energyUnit={outputUnit}/>

            </div>
        );
    }
}

export default CalculatorComponent;