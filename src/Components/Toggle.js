import React, { useState } from 'react';
import '../Styles/Toggle.css'
import PropTypes from 'prop-types'

const Toggle = ({ name, children, startValue, onChange }) => {
    const [selected, setSelected] = useState(startValue);

    const exportChange = (newState) => {
        setSelected(newState);
        onChange(newState);
    }

    return (
        <div className="toggle-body">
            {name && <div className="toggle-name">{name}</div>}
            <div className="option-container">
                {children.map((c, k) => {
                    return (
                        <div key={`toggle-${name}-${k}`} onClick={() => exportChange(k)} className={`toggle-option${selected === k ? " selected" : ""}`}>
                            {c}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

Toggle.propTypes = {
    name: PropTypes.string.isRequired,
    children: PropTypes.arrayOf(PropTypes.node).isRequired,
    startValue: PropTypes.number,
    onChange: PropTypes.func.isRequired,
}

Toggle.defaultProps = {
    startValue: 0
}

export default Toggle;