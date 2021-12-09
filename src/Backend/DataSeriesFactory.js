export default class TraceFactory {
    static getXValuesByPoints(minValue, maxValue, numberOfPoints) {
        if(numberOfPoints === 1) return [(maxValue + minValue)/2.0]
        
        const interval = (maxValue - minValue) / (numberOfPoints - 1)
        return Array.from(new Array(numberOfPoints), (_, key) => { return minValue + interval * key })
    }

    static getLogXValuesByPoints(minValue, maxValue, numberOfPoints){
        if(numberOfPoints === 1) return [Math.sqrt(minValue*maxValue)]

        const values = new Array(numberOfPoints);
        const step = Math.pow(maxValue/minValue, 1/(numberOfPoints-1))
        values[0] = minValue;
        for(let i=1;i<values.length;i++){
            values[i]=values[i-1]*step
        }
        return values
    }

    // static getXValuesByInterval(minValue, maxValue, interval) {
    //     // I know +0.01 is cheating but it works for steps as small as 0.1 which generates 2.5k points
    //     // and it's the simplest solution to the problem of generating x-values much larger than the maxValue
    //     // currently we still go above max by min, ie. if max is 250 and min is 0.00025
    //     // the last value is 250.00025 - this allows to keep the intervals constant
    //     const numberOfPoints = Math.ceil((maxValue - minValue + 0.01) / interval)
    //     return this.getXAxis(minValue, maxValue, numberOfPoints, interval)
    // }

    static getYValues(xs, stepFunction) {
        const ys = xs.map(stepFunction)
        return {
            x: xs,
            y: ys
        }
    }
}