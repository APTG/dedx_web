import React, { useState } from 'react';
import '../Styles/Toggle.css'

const Toggle = ({name, children, onChange, startValue})=>{
    const [selected, setSelected] = useState(startValue??0);

    const exportChange = (newState) => {
        setSelected(newState);
        onChange(newState);
    }

    return(
        <div className="toggle-body">
            {name && <div className="toggle-name">{name}</div>}
            <div className="option-container">
                {children.map((c,k)=>{
                return(
                    <div key={`toggle-${name}-${k}`} onClick={()=>exportChange(k)} className={`toggle-option${selected===k?" selected":""}`}>{c}</div>
                )
            })}
            </div>
            
        </div>
    )
}

export default Toggle;