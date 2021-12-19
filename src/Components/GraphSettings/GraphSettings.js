import React from "react"
import Toggle from "../Toggle";


function GraphSetting({startValues, onChange}) {
    return (
        <div className="gridish250" style={{paddingTop:"1rem"}}>
            <Toggle onChange={onChange.xAxis} name={"X Axis:"} startValue={startValues.xAxis}>
                {"Linear"}
                {"Logarithmic"}
            </Toggle>
            <Toggle onChange={onChange.yAxis} name={"Y Axis:"} startValue={startValues.yAxis}>
                {"Linear"}
                {"Logarithmic"}
            </Toggle>
            {/* <Toggle onChange={onChange.method} name={"Plotting Method:"} startValue={startValues.method}>
                {"Line"}
                {"Points"}
            </Toggle> */}
            <Toggle onChange={onChange.gridlines} name={"Show gridlines:"} startValue={startValues.gridlines}>
                {"Off"}
                {"On"}
            </Toggle>
        </div>
    )
}

export default GraphSetting