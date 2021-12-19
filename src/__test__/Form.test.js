import { fireEvent, render } from '@testing-library/react'

import Form from '../Components/Form/Form'  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029
import React from 'react'

import Enzyme,{mount} from 'enzyme'
import Adapter from '@wojtekmaj/enzyme-adapter-react-17'

import {mockPrograms, mockMaterials, mockIons} from './MockData'

Enzyme.configure({adapter: new Adapter()})

jest.mock('../Backend/WASMWrapper.js')

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
            'Material',
            'Ion',
            'Program'
        ]

        texts.forEach(t => {
            expect(getByLabelText(t)).toBeInTheDocument()
        })
    })

    test('should render all programs', ()=>{
        const wrapper = mount(<Form onSubmit={mockFunction} />)

        wrapper.setState({
            programs: mockPrograms
        })

        const options = wrapper.find('option').map((option)=>option.text())
        expect(options).toEqual(mockPrograms.map(x=>x.name))
    })

    test('should render all ions', ()=>{
        const wrapper = mount(<Form onSubmit={mockFunction} />)

        wrapper.setState({
            programs: mockIons
        })

        const options = wrapper.find('option').map((option)=>option.text())
        expect(options).toEqual(mockIons.map(x=>x.name))
    })

    test('should render all materials', ()=>{
        const wrapper = mount(<Form onSubmit={mockFunction} />)

        wrapper.setState({
            programs: mockMaterials
        })

        const options = wrapper.find('option').map((option)=>option.text())
        expect(options).toEqual(mockMaterials.map(x=>x.name))
    })

    test('should handle text inputs', () => {
        const { getByLabelText } = render(<Form onSubmit={mockFunction} />)

        const nameNode = getByLabelText('Name')
        expect(nameNode.value).toMatch('')

        fireEvent.change(nameNode, { target: { value: 'testName' } })
        expect(nameNode.value).toMatch('testName')
    })

    // test('should handle numeric input', () => {
    //     const { getByLabelText } = render(<Form onSubmit={mockFunction} />)

    //     testNumericInput(getByLabelText, 'Plot using')
    // })
})

// function testNumericInput(queryFunction, name) {
//     const el = queryFunction(name)
//     expect(el.value).not.toBeUndefined()

//     const testValue = Math.floor(Math.random() * 1000)
//     fireEvent.change(el, { target: { value: testValue } })
//     expect(el.value).toMatch(testValue + [])
// }
