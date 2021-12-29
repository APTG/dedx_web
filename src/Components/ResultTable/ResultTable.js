import React, { useMemo } from 'react'
import { useTable, useSortBy } from 'react-table'

import './ResultTable.css'
import { getCSV } from './TableUtils'

function ResultTable({ energies, values, stoppingPowerUnit }) {

    const columns = useMemo(() => {
        return [
            { Header: 'Energy [MeV/nucl]', accessor: 'energy', sortType: 'basic' },
            {
                Header: "Data" + (stoppingPowerUnit ? `[${stoppingPowerUnit}]` : ''),
                columns: values.map(child => {
                    return { Header: child.name, accessor: child.accessor, sortType: 'basic' }
                })
            }]
    }, [values, stoppingPowerUnit])

    const data = useMemo(() => {
        const res = energies.map((energy, key) => {
            const row = { energy }
            values.forEach(child => {
                if(child.precision)  row[child.accessor] = Number(child.data[key]).toFixed(child.precision)
                else row[child.accessor] = child.data[key]
            })
            return row
        })

        return res
    }, [energies, values])

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data }, useSortBy)

    return (
        <div>
            <button onClick={()=>getCSV(energies,values)}>Download me!</button>
            <table {...getTableProps()}>
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