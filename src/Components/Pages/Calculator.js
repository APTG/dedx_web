import PropTypes from 'prop-types'
import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper'

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

import * as convert from 'convert-units'

const Units = {
    Inputs: {
        Celcius: 'C',
        Fahrenheit: 'F',
    },
    Outputs: {
        Meter: 'm',
        ['Foot Squared Over Inch']: 'ft^2/in'
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
            this.setState({ outputUnit })
        },
        onOperationModeChange: operationMode => {
            console.log(operationMode)
            this.setState({ operationMode })
            this.forceUpdate()
        }
    }

    async calculateResults(input) {
        const { outputUnit } = this.state

        return await Promise.all(
            input.map(async input => {

                const result = await this.wrapper.getSingleValue(1, 1, 1, input)
                return {
                    input,
                    output: isNaN(result) ? 'Value unsupported' : result,
                    unit: outputUnit
                }
            })
        )
    }

    async onSubmit(event) {
        event.preventDefault()
        const {splitChar} = this.state


        console.log('Unit conversion: ' + (convert(0.001).from('l').toBest().val))

        const inputStr = event.target["inputValue"].value
        const result = !inputStr
            ? []
            : await this.calculateResults(inputStr.split(splitChar))
        this.setState({ result })
    }

    async onInputChange(event) {
        console.log(event)
        const {splitChar} = this.state
        const input = event.target.value.split(splitChar).filter(el => el!=='')
        const result = await this.calculateResults(input)
        this.setState({ result })

    }

    constructor(props) {
        super(props)

        this.wrapper = new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)
        this.onInputChange = this.onInputChange.bind(this)

        this.state = {
            inputUnit: Units.Inputs.Celcius,
            outputUnit: Units.Outputs['Foot Squared Over Inch'],
            result: [],
            operationMode: OperationMode.Performance,
            splitChar: ' '
        }

    }

    render() {

        const { inputUnit, outputUnit, result, operationMode } = this.state
        return (
            <div>
                <CalculatorSettings onChanges={this.onChanges} inputUnits={Object.entries(Units.Inputs)} outputUnits={Object.entries(Units.Outputs)} />
                <CalculatorInput
                    onSubmit={this.onSubmit}
                    onInputChange={ operationMode === OperationMode.Dynamic
                        ? this.onInputChange
                        : undefined
                        
                       
                    }
                    inputUnit={inputUnit}
                    outputUnit={outputUnit}
                />
                <CalculatorOutput result={result} />

            </div>
        );
    }
}

export default CalculatorComponent;