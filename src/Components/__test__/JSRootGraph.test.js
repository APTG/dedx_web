import { render } from '@testing-library/react'

import JSRootGraph from '../JSRootGraph'  // skipcq: JS-E1007, JS-P1003, JS-W1028, JS-W1029

describe('JSRootGraphp', () => {
    const draw = jest.fn()
    const createTGraph = jest.fn()
    const createTMultiGraph = jest.fn()
    window.JSROOT = {
        draw,
        createTGraph,
        createTMultiGraph
    }

    test('should render an empty graph', () => {
        render(<JSRootGraph logx={0} logy={0} plotStyle={0} traces={[]} />)
        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledWith(1)
    })

    const cases = [
        { data: { logx: 1, logy: 0, plotStyle: 0, traces: [] }, name: 'logx' },
        { data: { logx: 1, logy: 1, plotStyle: 0, traces: [] }, name: 'logy' },
        { data: { logx: 1, logy: 1, plotStyle: 1, traces: [] }, name: 'plotStyle' },
    ]

    cases.forEach(c => {
        test(`should update the graph on prop change ${c.name}`, () => {
            render(<JSRootGraph {...c.data} />)

            expect(draw).toBeCalledTimes(1)
            expect(createTGraph).toBeCalledTimes(1)
            expect(createTGraph).toBeCalledWith(1)
        })
    })

    const traceCase = { logx: 0, logy: 0, plotStyle: 0, traces: [{ x: [1, 2, 3], y: [1, 2, 3] }] }

    test('should update the graph trace', () => {
        render(<JSRootGraph {...traceCase} />)

        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(1)
        expect(createTMultiGraph).toBeCalledTimes(1)

        expect(createTGraph).toBeCalledWith(3, [1, 2, 3], [1, 2, 3])
    })

    const multipleTraceCase = { logx: 0, logy: 0, plotStyle: 0, traces: [{ x: [1, 2, 3], y: [1, 2, 3] }, { x: [4, 5], y: [4, 5] }] }

    test('should render multiple traces', () => {
        render(<JSRootGraph {...multipleTraceCase} />)

        expect(draw).toBeCalledTimes(1)
        expect(createTGraph).toBeCalledTimes(2)
        expect(createTMultiGraph).toBeCalledTimes(1)
    })
})