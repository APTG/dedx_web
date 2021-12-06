import React from "react"

import '../../Styles/Form.css'


function Dropdown({ name, data, value, onchange }) {
    return (
        <label className="input-wrapper">
            {name}
            <select value={value} onChange={onchange} id={`${name}Select`} name={name} className="input-box">
                {data.map((element, key) => <option value={element.code} key={`${name}_${key}`}>{element.name}</option>)}
            </select>
        </label>
    )
}

export default Dropdown