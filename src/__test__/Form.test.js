import { fireEvent, render } from '@testing-library/react'

import Form from '../Components/Form'  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029
import React from 'react'
import StoppingPowerComponent from '../Components/Pages/StoppingPower'  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029

describe('form', () => {
    const mockFunction = jest.fn()

    test('should render form', () => {
        const { getByTestId } = render(<Form onSubmit={mockFunction} />)

        expect(getByTestId('form-1')).toBeInTheDocument()
    })

    test('should render all form fields', () => {
        const { getByLabelText } = render(<Form onSubmit={mockFunction} />)
        const texts = [
            'Name',
            'Plot using',
            'Material',
            'Particle',
        ]

        texts.forEach(t => {
            expect(getByLabelText(t)).toBeInTheDocument()
        })
    })

    test('should be rendered on the stopping power subsite', () => {
        const { getByLabelText } = render(<StoppingPowerComponent ready={false} />)

        expect(getByLabelText('Name')).toBeInTheDocument()
    })

    test('should handle text inputs', () => {
        const { getByLabelText } = render(<StoppingPowerComponent ready={false} />)

        const nameNode = getByLabelText('Name')
        expect(nameNode.value).toMatch('')

        fireEvent.change(nameNode, { target: { value: 'testName' } })
        expect(nameNode.value).toMatch('testName')
    })

    test('should handle numeric input', () => {
        const { getByLabelText } = render(<StoppingPowerComponent ready={false} />)

        testNumericInput(getByLabelText, 'Plot using')
    })

    test('should handle submit', () => {
        const { getByText } = render(<Form onSubmit={mockFunction} />)

        fireEvent.click(getByText('Submit'))
        expect(mockFunction).toBeCalledTimes(1)
        expect(mockFunction).toBeCalledWith({
            name: '',
            plot_using: '500',
            method: 0,
            particle: 'He',
            material: 'Water',
        })
    })
})

function testNumericInput(queryFunction, name) {
    const el = queryFunction(name)
    expect(el.value).not.toBeUndefined()

    const testValue = Math.floor(Math.random() * 1000)
    fireEvent.change(el, { target: { value: testValue } })
    expect(el.value).toMatch(testValue + [])
}
