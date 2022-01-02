import React, { useMemo } from 'react'
import { useTable, useSortBy } from 'react-table'

import './ResultTable.css'
import { getInvisibleStyle } from './TableUtils'

function ResultTable({ energies, values, stoppingPowerUnit, shouldDisplay }) {

    const columns = useMemo(() => {
        return [
            { Header: 'Energy [MeV/nucl]', accessor: 'energy', sortType: 'number' },
            {
                Header: "Data" + (stoppingPowerUnit ? `[${stoppingPowerUnit}]` : ''),
                columns: values.map(child => {
                    return { Header: child.name, accessor: child.accessor, sortType: 'number' }
                })
            }]
    }, [values, stoppingPowerUnit])

    const data = useMemo(() => {
        if (energies) {
            const res = energies.map((energy, key) => {
                const row = { energy }
                values.forEach(child => {
                    if (child.precision) row[child.accessor] = Number(child.data[key]).toFixed(child.precision)
                    else row[child.accessor] = child.data[key]
                })
                return row
            })

            return res
        } else return []
    }, [energies, values])

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data }, useSortBy)

    return (
        <div style={getInvisibleStyle(shouldDisplay)} className='result-table-wrapper'>
            <table className='result-table' {...getTableProps()}>
                <thead>
                    {headerGroups.map(headerGroup => (
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            {headerGroup.headers.map(column => (
                                <th {...column.getHeaderProps(column.getSortByToggleProps())} >
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
                                        <td {...cell.getCellProps()} >
                                            {cell.render('Cell')}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>

        </div>
    )
}

export default ResultTable