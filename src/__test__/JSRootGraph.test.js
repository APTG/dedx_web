import { render } from '@testing-library/react'

import JSRootGraph from '../Components/JSRootGraph'  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029, JS-0249
import React from 'react'

describe('JSRootGraphp', () => {  // skipcq: JS-0125
    const draw = jest.fn()
    const createTGraph = jest.fn()
    const createTMultiGraph = jest.fn()
    window.JSROOT = {
        draw,
        createTGraph,
        createTMultiGraph
    }

    test('should render an empty graph', () => {
        render(<JSRootGraph xAxis={0} yAxis={0} plotStyle={0} traces={[]} />)
        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledWith(1)
    })

    const cases = [
        { data: { xAxis: 1, yAxis: 0, plotStyle: 0, traces: [] }, name: 'xAxis' },
        { data: { xAxis: 1, yAxis: 1, plotStyle: 0, traces: [] }, name: 'yAxis' },
        { data: { xAxis: 1, yAxis: 1, plotStyle: 1, traces: [] }, name: 'plotStyle' },
    ]

    cases.forEach(c => {
        test(`should update the graph on prop change ${c.name}`, () => {
            render(<JSRootGraph {...c.data} />)

            expect(draw).toBeCalledTimes(1)
            expect(createTGraph).toBeCalledTimes(1)
            expect(createTGraph).toBeCalledWith(1)
        })
    })

    const traceCase = { xAxis: 0, yAxis: 0, plotStyle: 0, traces: [{ x: [1, 2, 3], y: [1, 2, 3] }] }

    test('should update the graph trace', () => {
        render(<JSRootGraph {...traceCase} />)

        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(1)
        expect(createTMultiGraph).toBeCalledTimes(1)

        expect(createTGraph).toBeCalledWith(3, [1, 2, 3], [1, 2, 3])
    })

    const multipleTraceCase = { xAxis: 0, yAxis: 0, plotStyle: 0, traces: [{ x: [1, 2, 3], y: [1, 2, 3] }, { x: [4, 5], y: [4, 5] }] }

    test('should render multiple traces', () => {
        render(<JSRootGraph {...multipleTraceCase} />)

        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(2)
        expect(createTMultiGraph).toBeCalledTimes(1)
    })
})