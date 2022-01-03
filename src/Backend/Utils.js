// copied from https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid/2117523#2117523
export function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

export const StoppingPowerUnits = {
    MassStoppingPower: {name:'MeV*cm²/g', id:0},
    LargeScale: {name:'MeV/cm', id:1},
    SmallScale: {name:'keV/μm', id:2}
}