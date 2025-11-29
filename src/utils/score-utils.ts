const getReverseTransposition = (transposition?: string) => {
    if (transposition?.startsWith("-")) {
        return "+" + transposition.substring(1);
    } else if (transposition?.startsWith("+") || (transposition && transposition.length > 1)) {
        return "-" + transposition.substring(1);
    }
    return "";
};

export { getReverseTransposition };
