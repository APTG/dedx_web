import { render, screen, fireEvent } from '@testing-library/react'
import Form from '../Form'
import StoppingPowerComponent from '../Pages/StoppingPower'

describe('form', () => {
    test('should render form', () => {
        const { getByTestId } = render(<Form onSubmit={() => { }} />)

        expect(getByTestId('form-1')).toBeInTheDocument()
    })

    test('should render all form fields', () => {
        const { getByLabelText } = render(<Form onSubmit={() => { }} />)
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
        const mockfn = jest.fn();
        const { getByText } = render(<Form onSubmit={mockfn} />)

        fireEvent.click(getByText('Submit'))
        expect(mockfn).toBeCalledTimes(1)
        expect(mockfn).toBeCalledWith({
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
