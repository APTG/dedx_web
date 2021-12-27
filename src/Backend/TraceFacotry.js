export default class TraceFactory{
    static getXAxisByPoints(start, end, points){
        const interval = (end-start)/points
        return this.getXAxis(start,end, points,interval)
    }

    static getXAxisByInterval(start,end,interval){
        const points = Math.ceil((end-start)/interval)
        return this.getXAxis(start,end,points,interval)
    }

    static getXAxis(start,end,points,interval){
        const arr = Array.from(new Array(points-1),(_,key)=>{return (Number)((start + interval * (key+1).toFixed(3)))})
        arr.push(end)
        return arr
    }

    static getStoppingPowerValues(xs, stepFunction){
        const ys = xs.map(stepFunction)
        return {
            x: xs,
            y: ys
        }
    }
}