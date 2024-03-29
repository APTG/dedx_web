import React from "react"

import '../../Styles/Form.css'

function Dropdown({ name, data, value, onChange, elementDisplayFunc }) {
    return (
        <label className="input-wrapper column-flex">
            {name}
            <select value={value} onChange={onChange} id={`${name}Select`} name={name} className="input-box">
                {data.map(elementDisplayFunc(name))}
            </select>
        </label>
    )
}

export function renderElementName(name) {
    return (element, key) => <option value={element.id} key={`${name}_${key}`}>{element.name}</option>
}

export function renderElementNameAndId(name) {
    return (element, key) => <option value={element.id} key={`${name}_${key}`}>{element.id} {element.name}</option>
}

export default Dropdown