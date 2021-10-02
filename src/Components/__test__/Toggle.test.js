import { fireEvent, render } from '@testing-library/react'

import jest from 'jest'
import React from 'react'
import Toggle from "../Toggle"



describe('Toggle element', () => {
    const testFunc = jest.fn()
    const testToggle = <Toggle name="testToggle" onChange={testFunc}>
        {"Option 1"}
        {"Option 2"}
    </Toggle>

    test('render options', () => {
        const { getByText } = render(testToggle)
        expect(getByText('Option 1')).toBeInTheDocument()
        expect(getByText('Option 2')).toBeInTheDocument()
    })

    test('call onChange when changed', () => {
        const { getByText } = render(testToggle)
        const newChoice = getByText('Option 2')
        const oldChoice = getByText('Option 1')
        fireEvent.click(newChoice)
        fireEvent.click(oldChoice)
        fireEvent.click(oldChoice)
        expect(testFunc).toBeCalledTimes(3)
    })

    test('change color when changing state', () => {
        const { getByText } = render(testToggle)
        const newChoice = getByText('Option 2')
        const oldChoice = getByText('Option 1')

        expect(oldChoice).toHaveClass('selected')
        expect(newChoice).not.toHaveClass('selected')

        fireEvent.click(newChoice)

        expect(newChoice).toHaveClass('selected')
        expect(oldChoice).not.toHaveClass('selected')
    })
})