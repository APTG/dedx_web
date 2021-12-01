import React, { useMemo } from 'react'
import { useTable, useSortBy } from 'react-table'

function transformTraces(traces) {
    const values = {}
    traces.forEach(trace => {
        values[trace.name] = {}
        trace.x.forEach((enery, index) => {
            values[trace.name][enery + []] = trace.y[index]
        })
    })
    const keys = new Set(traces.map(t => t.x).flat(1))
    const res = [...keys].map(energy => {
        const res = { energy }
        traces.forEach((trace, index) =>
            res[`Power_${index}`] = values[trace.name][energy + []].toFixed(3)
        )
        return res
    })
    return res
}

function ResultTable({ traces }) {
    const columns = useMemo(() => {
        return [{ Header: 'Energy', accessor: 'energy' }].concat(
            traces.map((trace, key) => {
                return { Header: `Power - ${trace.name}`, accessor: `Power_${key}` }
            })
        )
    }, [traces])

    const data = useMemo(() => transformTraces(traces), [traces])

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data }, useSortBy)

    console.log(data)

    return (
        <table {...getTableProps()}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th
                                {...column.getHeaderProps(column.getSortByToggleProps())}
                                style={{
                                    borderBottom: 'solid 3px red',
                                    background: 'aliceblue',
                                    color: 'black',
                                    fontWeight: 'bold',
                                }}

                            >
                                {column.render('Header')}
                                <span>
                                    {column.isSorted
                                        ? column.isSortedDesc
                                            ? ' 🔽'
                                            : ' 🔼'
                                        : ''}
                                </span>
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map(row => {
                    prepareRow(row)
                    return (
                        <tr {...row.getRowProps()}>
                            {row.cells.map(cell => {
                                return (
                                    <td {...cell.getCellProps()}
                                        style={{
                                            padding: '10px',
                                            border: 'solid 1px gray',
                                            background: 'papayawhip',
                                        }}
                                    >
                                        {cell.render('Cell')}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

export default ResultTable