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
            <div className="toggle-name">{name}</div>
            <div>
                {children.map((c,k)=>{
                return(
                    <div onClick={()=>exportChange(k)} className={`toggle-option${selected===k?" selected":""}`}>{c}</div>
                )
            })}
            </div>
            
        </div>
    )
}

export default Toggle;