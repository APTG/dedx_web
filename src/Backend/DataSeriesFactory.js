export default class TraceFactory {
    static getXValuesByPoints(min_energy, max_energy, pointNumber) {
        const interval = (max_energy - min_energy) / (pointNumber - 1)
        return this.getXAxis(min_energy, max_energy, pointNumber, interval)
    }

    static getXValuesByInterval(min_energy, max_energy, interval) {
        // I know +0.01 is cheating but it works for steps as small as 0.1 which generates 2.5k points
        // and it's the simplest solution to the problem of generating x-values much larger than the max_energy
        // currently we still go above max by min, ie. if max is 250 and min is 0.00025
        // the last value is 250.00025 - this allows to keep the intervals constant
        const pointNumber = Math.ceil((max_energy - min_energy + 0.01) / interval)
        return this.getXAxis(min_energy, max_energy, pointNumber, interval)
    }

    static getXValues(min_energy, max_energy, pointNumber, interval) {
        // ~~ ensures pointNumber is an integer 
        const arr = Array.from(new Array(~~pointNumber), (_, key) => { return min_energy + interval * key })
        return arr
    }

    static getYValues(xs, stepFunction) {
        const ys = xs.map(stepFunction)
        return {
            x: xs,
            y: ys
        }
    }
}