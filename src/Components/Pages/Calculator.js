import PropTypes from 'prop-types';
import React from 'react'
import WASMWrapper from '../../Backend/WASMWrapper';

import CalculatorSettings from '../CalculatorHelpers/CalculatorSettings'
import CalculatorInput from '../CalculatorHelpers/CalculatorInput'
import CalculatorOutput from '../CalculatorHelpers/CalculatorOutput'

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



class CalculatorComponent extends React.Component {
    static propTypes = {
        ready: PropTypes.bool.isRequired
    }

    onChanges = {
        onHistoryChange: (useHistory) => {
            this.setState({ settings: { useHistory } })
        },
        onInputUnitChange: (event) => {
            const inputUnit = event.target.value
            this.setState({ inputUnit })
        },
        onOutputUnitChange: (event) => {
            const outputUnit = event.target.value
            this.setState({ outputUnit })
        }
    }

    async onSubmit(event) {
        event.preventDefault()
        const splitChar = ' '

        const inputStr = event.target["inputValue"].value
        const input = !inputStr ? [] : inputStr.split(splitChar)
        const result = await Promise.all(
            input.map(async input => {
                return {
                    input,
                    output: await this.wrapper.getSingleValue(1, 1, 1, input)
                }
            })
        )
        this.setState({ result })
    }

    constructor(props) {
        super(props)

        this.wrapper = new WASMWrapper()

        this.onSubmit = this.onSubmit.bind(this)

        this.state = {
            settings: {
                useHisotry: false
            },
            inputUnit: Units.Inputs.Celcius,
            outputUnit: Units.Outputs['Foot Squared Over Inch'],
            result: []
        }
    }

    render() {

        const { inputUnit, outputUnit, result } = this.state
        return (
            <div>
                <CalculatorSettings onChanges={this.onChanges} inputUnits={Object.entries(Units.Inputs)} outputUnits={Object.entries(Units.Outputs)} />
                <CalculatorInput onSubmit={this.onSubmit} inputUnit={inputUnit} outputUnit={outputUnit} />
                <CalculatorOutput result={result} />

            </div>
        );
    }
}

export default CalculatorComponent;