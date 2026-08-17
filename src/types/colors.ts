export const EDITORIAL_COLORS = {
    // source related (warm)
    sic: "#CC3311",
    orig: "#EE7733",
    abbr: "#EE3377",

    // editorial intervention (cold)
    corr: "#0077BB",
    reg: "#33BBEE",
    expan: "#009988",
    supplied: "#332288",

    // copysts
    add: "#117733",
    del: "#882255",
    restore: "#44AA99",

    // meterial state and metadata
    unclear: "#997700",
    damage: "#664422",
    annot: "#6699CC",
    ref: "#888888",

    // apparatus readings. They sit inside the <app> container and override its color,
    // so the reader sees which of the two is on show: the preferred reading in green,
    // as the settled text, an alternative one in red, as a departure from it.
    lem: "#2E9E6B",
    rdg: "#CC6677",

    // container (desaturated, to allow children distinguisment)
    app: "#6F6F9E",
    choice: "#9E6F9E",
    subst: "#9E8A6F",
};

export const PLAYER_STAFF_COLORS = [
    "#AA3377", // staff 1 (púrpura)
    "#EE6677", // staff 2 (rosa)
    "#228833", // staff 3 (verde)
    "#B45309", // staff 4 (ocre tostado, antes mostaza)
    "#0E7490", // staff 5 (cian oscuro, antes celeste)
    "#4477AA", // staff 6 (azul)
    "#AA3377", // staff 7 (repite 1)
    "#EE6677", // staff 8 (repite 2)
]

export const playerStaffColor = (staff: number) =>
    PLAYER_STAFF_COLORS[(Math.max(1, staff) - 1) % PLAYER_STAFF_COLORS.length]
